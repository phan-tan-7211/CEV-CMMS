import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, StyleSheet, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { EquipmentDetailScreen } from '../screens/EquipmentDetailScreen'
import { EquipmentListScreen } from '../screens/EquipmentListScreen'
import { EquipmentRegistrationScreen } from '../screens/EquipmentRegistrationScreen'
import { EquipmentStatusScreen } from '../screens/EquipmentStatusScreen'
import { EquipmentHierarchyScreen } from '../screens/EquipmentHierarchyScreen'
import { CreateWorkOrderScreen } from '../screens/CreateWorkOrderScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { MoreScreen } from '../screens/MoreScreen'
import { RequestsScreen } from '../screens/RequestsScreen'
import { ScanAssetScreen } from '../screens/ScanAssetScreen'
import { SimpleScannerScreen } from '../screens/SimpleScannerScreen'
import { WorkOrderDetailScreen } from '../screens/WorkOrderDetailScreen'
import { WorkOrdersScreen } from '../screens/WorkOrdersScreen'
import { AccountSettingsScreen } from '../screens/settings/AccountSettingsScreen'
import {
  getCurrentSession,
  signInWithPassword,
  signOutCurrentSession,
  subscribeAuthState,
} from '../features/auth'
import { revalidateEquipmentDetail } from '../features/equipment'

type Route = 'home' | 'registration' | 'equipment' | 'equipment-detail' | 'equipment-status' | 'equipment-hierarchy' | 'scan' | 'simple-scan' | 'create-work-order' | 'work-orders' | 'work-order-detail' | 'requests' | 'more' | 'settings'

type RouteEntry = {
  name: Route
  equipmentId?: string
  equipmentStatus?: string
  workOrderId?: string
  operatorFlow?: boolean
  workOrderScope?: 'pending' | 'completed'
  barcode?: string
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
  if (route === 'requests') return <RequestsScreen onBack={goBack} equipmentId={scopedEquipmentId || undefined} />
  if (route === 'more') {
    return (
      <MoreScreen
        onHome={resetNavigation}
        onOpenWorkOrders={() => navigate({ name: 'work-orders' })}
        onOpenRequests={() => navigate({ name: 'requests' })}
        onCreateEquipment={() => navigate({ name: 'registration' })}
        onOpenOperatorScan={() => navigate({ name: 'scan', operatorFlow: true })}
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
