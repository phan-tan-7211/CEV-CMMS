import { useEffect } from 'react'
import { AppState } from 'react-native'
import { registerRootComponent } from 'expo'
import { AutocompleteDropdownContextProvider } from 'react-native-autocomplete-dropdown'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { MobileShell } from './src/navigation/MobileShell'
import { syncQueuedWorkOrderDrafts } from './src/features/work-orders'

function RootApp() {
  useEffect(() => {
    let active = true
    const sync = () => { if (active) void syncQueuedWorkOrderDrafts() }
    sync()
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') sync() })
    const interval = setInterval(sync, 30_000)
    return () => {
      active = false
      appState.remove()
      clearInterval(interval)
    }
  }, [])

  return (
    <SafeAreaProvider>
      <AutocompleteDropdownContextProvider>
        <MobileShell />
      </AutocompleteDropdownContextProvider>
    </SafeAreaProvider>
  )
}

registerRootComponent(RootApp)
