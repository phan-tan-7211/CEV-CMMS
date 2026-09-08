import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, StyleSheet, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { EquipmentDetailScreen } from '../screens/EquipmentDetailScreen'
import { EquipmentListScreen } from '../screens/EquipmentListScreen'
import { EquipmentRegistrationScreen } from '../screens/EquipmentRegistrationScreen'
import { EquipmentStatusScreen } from '../screens/EquipmentStatusScreen'
import { EquipmentHierarchyScreen } from '../screens/EquipmentHierarchyScreen'
import { CreateWorkOrderScreen } from '../screens/CreateWorkOrderScreen'
import { PartDetailsScreen } from '../screens/PartDetailsScreen'
import { PartInventoryScreen } from '../screens/PartInventoryScreen'
import { PartsListScreen } from '../screens/PartsListScreen'
import { PartFormScreen } from '../screens/PartFormScreen'
import { PartWorkOrderScreen } from '../screens/PartWorkOrderScreen'
import { CreateRequestScreen } from '../screens/CreateRequestScreen'
import { RequestDetailScreen } from '../screens/RequestDetailScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { MoreScreen } from '../screens/MoreScreen'
import { RequestsScreen } from '../screens/RequestsScreen'
import { ScanAssetScreen } from '../screens/ScanAssetScreen'
import { SimpleScannerScreen } from '../screens/SimpleScannerScreen'
import { WorkOrderDetailScreen } from '../screens/WorkOrderDetailScreen'
import { WorkOrdersScreen } from '../screens/WorkOrdersScreen'
import { LocationsScreen } from '../screens/LocationsScreen'
import { InventoryScreen } from '../screens/InventoryScreen'
import { MetersScreen } from '../screens/MetersScreen'
import { VendorsScreen } from '../screens/VendorsScreen'
import { PeopleScreen } from '../screens/PeopleScreen'
import { PreventiveMaintenanceScreen } from '../screens/PreventiveMaintenanceScreen'
import { LocationFormScreen } from '../screens/LocationFormScreen'
import { CompanyFormScreen } from '../screens/CompanyFormScreen'
import { AccountSettingsScreen } from '../screens/settings/AccountSettingsScreen'
import {
  getCurrentSession,
  signInWithPassword,
  signOutCurrentSession,
  subscribeAuthState,
} from '../features/auth'
import { revalidateEquipmentDetail } from '../features/equipment'

type Route = 'home' | 'registration' | 'equipment' | 'equipment-detail' | 'equipment-status' | 'equipment-hierarchy' | 'scan' | 'simple-scan' | 'create-work-order' | 'create-request' | 'part-list' | 'part-scan' | 'part-form' | 'part-detail' | 'part-inventory' | 'part-work-order' | 'work-orders' | 'work-order-detail' | 'requests' | 'request-detail' | 'more' | 'locations' | 'location-form' | 'inventory' | 'meters' | 'vendors' | 'company-form' | 'people' | 'preventive-maintenance' | 'settings'

type RouteEntry = {
  name: Route
  equipmentId?: string
  equipmentStatus?: string
  workOrderId?: string
  requestId?: string
  operatorFlow?: boolean
  workOrderScope?: 'pending' | 'completed'
  barcode?: string
  partId?: string
}

const HOME_ENTRY: RouteEntry = { name: 'home' }

function sessionRole(session: Session) {
  const metadata = session.user.user_metadata || {}
  return String(metadata.role || metadata.app_role || '').trim().toLowerCase()
}

function isAdminSession(session: Session) {
  const role = sessionRole(session)
  return role === 'admin' || role === 'administrator' || role === 'super_admin' || role === 'superadmin'
}

function isOperatorSession(session: Session) {
  const role = sessionRole(session)
  return role === 'operator' || role === 'production_operator' || role === 'machine_operator'
}

function currentUserFilterKeys(session: Session) {
  const metadata = session.user.user_metadata || {}
  return [
    session.user.id,
    session.user.email || '',
    String(metadata.display_name || metadata.full_name || metadata.name || ''),
  ].map((value) => String(value || '').trim()).filter(Boolean)
}

export function MobileShell() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [routeStack, setRouteStack] = useState<RouteEntry[]>([HOME_ENTRY])

  const currentEntry = routeStack[routeStack.length - 1] || HOME_ENTRY
  const route = currentEntry.name

  const resetNavigation = useCallback(() => {
    setRouteStack([HOME_ENTRY])
  }, [])

  const navigate = useCallback((entry: RouteEntry) => {
    setRouteStack((current) => [...current, entry])
  }, [])

  const goBack = useCallback(() => {
    setRouteStack((current) => current.length > 1 ? current.slice(0, -1) : current)
  }, [])

  useEffect(() => {
    let mounted = true
    void getCurrentSession()
      .then((currentSession) => {
        if (mounted) setSession(currentSession)
      })
      .catch(() => {
        if (mounted) setSession(null)
      })

    const unsubscribe = subscribeAuthState((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) resetNavigation()
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [resetNavigation])

  useEffect(() => {
    if (routeStack.length <= 1) return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack()
      return true
    })
    return () => subscription.remove()
  }, [goBack, routeStack.length])

  async function handleSignIn(email: string, password: string) {
    const nextSession = await signInWithPassword(email, password)
    setSession(nextSession)
    resetNavigation()
  }

  async function handleSignOut() {
    await signOutCurrentSession()
    resetNavigation()
    setSession(null)
  }

  const selectedEquipmentId = useMemo(
    () => (route === 'equipment-detail' || route === 'equipment-status' || route === 'equipment-hierarchy') ? String(currentEntry.equipmentId || '') : '',
    [currentEntry.equipmentId, route],
  )
  const selectedWorkOrderId = route === 'work-order-detail' ? String(currentEntry.workOrderId || '') : ''
  const selectedRequestId = route === 'request-detail' ? String(currentEntry.requestId || '') : ''
  const selectedPartId = String(currentEntry.partId || '')
  const scopedEquipmentId = String(currentEntry.equipmentId || '')

  if (session === undefined) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#155EEF" />
      </View>
    )
  }

  if (!session) return <LoginScreen onSignIn={handleSignIn} />

  const operatorFlow = isOperatorSession(session)
  const adminSession = isAdminSession(session)

  if (route === 'registration') return <EquipmentRegistrationScreen onBack={goBack} initialBarcode={currentEntry.barcode} onCreated={(equipmentId) => navigate({ name: 'equipment-detail', equipmentId })} />
  if (route === 'equipment') {
    return (
      <EquipmentListScreen
        onBack={goBack}
        onOpenScan={() => navigate({ name: 'simple-scan' })}
        onOpenEquipment={(equipmentId) => navigate({ name: 'equipment-detail', equipmentId })}
        currentUserKeys={currentUserFilterKeys(session)}
      />
    )
  }
  if (route === 'equipment-detail' && selectedEquipmentId) {
    return (
      <EquipmentDetailScreen
        equipmentId={selectedEquipmentId}
        onBack={goBack}
        onOpenStatus={(equipmentStatus) => navigate({ name: 'equipment-status', equipmentId: selectedEquipmentId, equipmentStatus })}
      />
    )
  }
  if (route === 'equipment-status' && selectedEquipmentId) {
    return (
      <EquipmentStatusScreen
        equipmentId={selectedEquipmentId}
        currentStatus={String(currentEntry.equipmentStatus || '')}
        onBack={goBack}
        onSaved={() => goBack()}
      />
    )
  }
  if (route === 'equipment-hierarchy' && selectedEquipmentId) {
    return <EquipmentHierarchyScreen equipmentId={selectedEquipmentId} onBack={goBack} />
  }
  if (route === 'create-work-order' && scopedEquipmentId) {
    return <CreateWorkOrderScreen equipmentId={scopedEquipmentId} onBack={goBack} onCreated={(workOrderId) => navigate({ name: 'work-order-detail', workOrderId })} />
  }
  if (route === 'part-detail' && selectedPartId) return <PartDetailsScreen partId={selectedPartId} onBack={goBack} />
  if (route === 'part-inventory' && selectedPartId) return <PartInventoryScreen partId={selectedPartId} onBack={goBack} />
  if (route === 'part-work-order' && selectedPartId) return <PartWorkOrderScreen partId={selectedPartId} onBack={goBack} onCreated={(workOrderId) => navigate({ name: 'work-order-detail', workOrderId })} />
  if (route === 'part-form') return <PartFormScreen partId={selectedPartId} onBack={goBack} onSaved={(partId) => navigate({ name: 'part-detail', partId })} />
  if (route === 'part-list') return <PartsListScreen onBack={goBack} onScan={() => navigate({ name: 'part-scan' })} onCreate={() => navigate({ name: 'part-form' })} onOpenPart={(partId) => navigate({ name: 'part-detail', partId })} />
  if (route === 'part-scan') return <SimpleScannerScreen title="Quét mã phụ tùng" onBack={goBack} onResult={async (code) => {
    const { searchSparePartsByBarcode } = await import('../features/scan/api/partSearchService')
    const matches = await searchSparePartsByBarcode(code)
    if (matches.length === 1 && matches[0]) { navigate({ name: 'part-detail', partId: matches[0].partId }); return true }
    Alert.alert(matches.length ? 'Có nhiều kết quả' : 'Không tìm thấy phụ tùng', matches.length ? 'Hãy dùng tìm kiếm trong danh sách Phụ tùng.' : `Chưa có phụ tùng có mã “${code}”.`)
    return false
  }} />
  if (route === 'create-request' && scopedEquipmentId) return <CreateRequestScreen equipmentId={scopedEquipmentId} sourceId={currentEntry.barcode} onBack={goBack} onCreated={() => navigate({ name: 'requests', equipmentId: scopedEquipmentId })} />
  if (route === 'scan') {
    return (
      <ScanAssetScreen
        onBack={goBack}
        onOpenEquipment={(equipmentId) => navigate({ name: 'equipment-detail', equipmentId })}
        onOpenHierarchy={(equipmentId) => navigate({ name: 'equipment-hierarchy', equipmentId })}
        onOpenPendingWorkOrders={(equipmentId) => navigate({ name: 'work-orders', equipmentId, workOrderScope: 'pending' })}
        onOpenPendingRequests={(equipmentId) => navigate({ name: 'requests', equipmentId })}
        onOpenCompletedWorkOrders={(equipmentId) => navigate({ name: 'work-orders', equipmentId, workOrderScope: 'completed' })}
        onCreateAsset={(code) => navigate({ name: 'registration', barcode: code })}
        onCreateWorkOrder={(equipmentId) => navigate({ name: 'create-work-order', equipmentId })}
        onOpenPart={(partId) => navigate({ name: 'part-detail', partId })}
        onOpenPartInventory={(partId) => navigate({ name: 'part-inventory', partId })}
        onCreatePartWorkOrder={(partId) => navigate({ name: 'part-work-order', partId })}
        onCreatePortalWorkOrder={(equipmentId) => navigate({ name: 'create-work-order', equipmentId })}
        onCreatePortalRequest={(equipmentId, sourceId) => navigate({ name: 'create-request', equipmentId, barcode: sourceId })}
        isOperatorFlow={Boolean(currentEntry.operatorFlow)}
      />
    )
  }
  if (route === 'simple-scan') {
    return (
      <SimpleScannerScreen
        title="Quét mã thiết bị"
        onBack={goBack}
        onResult={async (code) => {
          try {
            const asset = await revalidateEquipmentDetail(code, { force: true })
            navigate({ name: 'equipment-detail', equipmentId: asset.equipmentId })
            return true
          } catch {
            Alert.alert('Không tìm thấy tài sản', `Chưa có tài sản nào có mã “${code}”.`, [
              { text: 'Quét lại', style: 'cancel' },
              { text: 'Tạo tài sản', onPress: () => navigate({ name: 'registration', barcode: code }) },
            ])
            return false
          }
        }}
      />
    )
  }
  if (route === 'work-orders') {
    return <WorkOrdersScreen onBack={goBack} equipmentId={scopedEquipmentId || undefined} scope={currentEntry.workOrderScope} onOpenWorkOrder={(workOrderId) => navigate({ name: 'work-order-detail', workOrderId })} />
  }
  if (route === 'work-order-detail' && selectedWorkOrderId) {
    return <WorkOrderDetailScreen workOrderId={selectedWorkOrderId} onBack={goBack} />
  }
  if (route === 'requests') return <RequestsScreen onBack={goBack} equipmentId={scopedEquipmentId || undefined} onOpenRequest={(requestId) => navigate({ name: 'request-detail', requestId })} />
  if (route === 'request-detail' && selectedRequestId) return <RequestDetailScreen requestId={selectedRequestId} onBack={goBack} />
  if (route === 'locations') return <LocationsScreen onBack={goBack} onAdd={() => navigate({ name: 'location-form' })} />
  if (route === 'location-form') return <LocationFormScreen onBack={goBack} />
  if (route === 'inventory') return <InventoryScreen onBack={goBack} />
  if (route === 'meters') return <MetersScreen onBack={goBack} />
  if (route === 'vendors') return <VendorsScreen onBack={goBack} onAdd={() => navigate({ name: 'company-form' })} />
  if (route === 'company-form') return <CompanyFormScreen onBack={goBack} />
  if (route === 'people') return <PeopleScreen onBack={goBack} />
  if (route === 'preventive-maintenance') return <PreventiveMaintenanceScreen onBack={goBack} />
  if (route === 'more') {
    return (
      <MoreScreen
        onHome={resetNavigation}
        onOpenWorkOrders={() => navigate({ name: 'work-orders' })}
        onOpenRequests={() => navigate({ name: 'requests' })}
        onOpenEquipment={() => navigate({ name: 'equipment' })}
        onCreateEquipment={() => navigate({ name: 'registration' })}
        onOpenOperatorScan={() => navigate({ name: 'scan', operatorFlow: true })}
        onOpenParts={() => navigate({ name: 'part-list' })}
        onOpenLocations={() => navigate({ name: 'locations' })}
        onOpenInventory={() => navigate({ name: 'inventory' })}
        onOpenMeters={() => navigate({ name: 'meters' })}
        onOpenVendors={() => navigate({ name: 'vendors' })}
        onOpenPeople={() => navigate({ name: 'people' })}
        onOpenPreventiveMaintenance={() => navigate({ name: 'preventive-maintenance' })}
        isAdmin={adminSession}
        isOperatorFlow={operatorFlow}
      />
    )
  }
  if (route === 'settings') {
    return <AccountSettingsScreen session={session} onBack={goBack} onSignOut={handleSignOut} />
  }

  return (
    <HomeScreen
      onCreateEquipment={() => navigate({ name: 'registration' })}
      onOpenScan={() => navigate({ name: 'scan' })}
      onOpenOperatorScan={() => navigate({ name: 'scan', operatorFlow: true })}
      onOpenWorkOrders={() => navigate({ name: 'work-orders' })}
      onOpenEquipment={() => navigate({ name: 'equipment' })}
      onOpenRequests={() => navigate({ name: 'requests' })}
      onOpenMore={() => navigate({ name: 'more' })}
      onOpenSettings={() => navigate({ name: 'settings' })}
      isAdmin={adminSession}
      isOperatorFlow={operatorFlow}
    />
  )
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FB',
  },
})
