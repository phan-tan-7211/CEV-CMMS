import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { EquipmentDetailScreen } from '../screens/EquipmentDetailScreen'
import { EquipmentListScreen } from '../screens/EquipmentListScreen'
import { EquipmentRegistrationScreen } from '../screens/EquipmentRegistrationScreen'
import { EquipmentStatusScreen } from '../screens/EquipmentStatusScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { MoreScreen } from '../screens/MoreScreen'
import { RequestsScreen } from '../screens/RequestsScreen'
import { ScanAssetScreen } from '../screens/ScanAssetScreen'
import { WorkOrderDetailScreen } from '../screens/WorkOrderDetailScreen'
import { WorkOrdersScreen } from '../screens/WorkOrdersScreen'
import { AccountSettingsScreen } from '../screens/settings/AccountSettingsScreen'
import {
  getCurrentSession,
  signInWithPassword,
  signOutCurrentSession,
  subscribeAuthState,
} from '../features/auth'

type Route = 'home' | 'registration' | 'equipment' | 'equipment-detail' | 'equipment-status' | 'scan' | 'work-orders' | 'work-order-detail' | 'requests' | 'more' | 'settings'

type RouteEntry = {
  name: Route
  equipmentId?: string
  equipmentStatus?: string
  workOrderId?: string
}

const HOME_ENTRY: RouteEntry = { name: 'home' }

function isAdminSession(session: Session) {
  const metadata = session.user.user_metadata || {}
  const role = String(metadata.role || metadata.app_role || '').trim().toLowerCase()
  return role === 'admin' || role === 'administrator' || role === 'super_admin' || role === 'superadmin'
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
    () => (route === 'equipment-detail' || route === 'equipment-status') ? String(currentEntry.equipmentId || '') : '',
    [currentEntry.equipmentId, route],
  )
  const selectedWorkOrderId = route === 'work-order-detail' ? String(currentEntry.workOrderId || '') : ''

  if (session === undefined) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#155EEF" />
      </View>
    )
  }

  if (!session) return <LoginScreen onSignIn={handleSignIn} />

  if (route === 'registration') return <EquipmentRegistrationScreen onBack={goBack} />
  if (route === 'equipment') {
    return (
      <EquipmentListScreen
        onBack={goBack}
        onCreateEquipment={() => navigate({ name: 'registration' })}
        onOpenEquipment={(equipmentId) => navigate({ name: 'equipment-detail', equipmentId })}
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
  if (route === 'scan') return <ScanAssetScreen onBack={goBack} />
  if (route === 'work-orders') {
    return <WorkOrdersScreen onBack={goBack} onOpenWorkOrder={(workOrderId) => navigate({ name: 'work-order-detail', workOrderId })} />
  }
  if (route === 'work-order-detail' && selectedWorkOrderId) {
    return <WorkOrderDetailScreen workOrderId={selectedWorkOrderId} onBack={goBack} />
  }
  if (route === 'requests') return <RequestsScreen onBack={goBack} />
  if (route === 'more') return <MoreScreen onBack={goBack} />
  if (route === 'settings') {
    return <AccountSettingsScreen session={session} onBack={goBack} onSignOut={handleSignOut} />
  }

  return (
    <HomeScreen
      onCreateEquipment={() => navigate({ name: 'registration' })}
      onOpenScan={() => navigate({ name: 'scan' })}
      onOpenWorkOrders={() => navigate({ name: 'work-orders' })}
      onOpenEquipment={() => navigate({ name: 'equipment' })}
      onOpenRequests={() => navigate({ name: 'requests' })}
      onOpenMore={() => navigate({ name: 'more' })}
      onOpenSettings={() => navigate({ name: 'settings' })}
      isAdmin={isAdminSession(session)}
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
