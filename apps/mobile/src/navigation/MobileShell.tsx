import { useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { EquipmentListScreen } from '../screens/EquipmentListScreen'
import { EquipmentRegistrationScreen } from '../screens/EquipmentRegistrationScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { MoreScreen } from '../screens/MoreScreen'
import { ScanAssetScreen } from '../screens/ScanAssetScreen'
import { WorkOrdersScreen } from '../screens/WorkOrdersScreen'
import { supabase } from '../supabase'

type Route = 'home' | 'registration' | 'equipment' | 'scan' | 'work-orders' | 'more'

export function MobileShell() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [route, setRoute] = useState<Route>('home')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setRoute('home')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (route === 'home') return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setRoute('home')
      return true
    })
    return () => subscription.remove()
  }, [route])

  if (session === undefined) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#155EEF" />
      </View>
    )
  }

  if (!session) return <LoginScreen />

  if (route === 'registration') return <EquipmentRegistrationScreen />
  if (route === 'equipment') return <EquipmentListScreen onBack={() => setRoute('home')} onCreateEquipment={() => setRoute('registration')} />
  if (route === 'scan') return <ScanAssetScreen onBack={() => setRoute('home')} />
  if (route === 'work-orders') return <WorkOrdersScreen onBack={() => setRoute('home')} />
  if (route === 'more') return <MoreScreen onBack={() => setRoute('home')} />

  return (
    <HomeScreen
      onCreateEquipment={() => setRoute('registration')}
      onOpenScan={() => setRoute('scan')}
      onOpenWorkOrders={() => setRoute('work-orders')}
      onOpenEquipment={() => setRoute('equipment')}
      onOpenMore={() => setRoute('more')}
      onSignOut={() => { void supabase.auth.signOut() }}
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
