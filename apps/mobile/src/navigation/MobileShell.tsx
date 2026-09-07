import { useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { EquipmentRegistrationScreen } from '../screens/EquipmentRegistrationScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { supabase } from '../supabase'

type Route = 'home' | 'registration'

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
    if (route !== 'registration') return undefined
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

  if (!session) return <EquipmentRegistrationScreen />

  if (route === 'registration') {
    return <EquipmentRegistrationScreen />
  }

  return (
    <HomeScreen
      onCreateEquipment={() => setRoute('registration')}
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
