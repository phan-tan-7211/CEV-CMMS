import { registerRootComponent } from 'expo'
import { AutocompleteDropdownContextProvider } from 'react-native-autocomplete-dropdown'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { MobileShell } from './src/navigation/MobileShell'

function RootApp() {
  return (
    <SafeAreaProvider>
      <AutocompleteDropdownContextProvider>
        <MobileShell />
      </AutocompleteDropdownContextProvider>
    </SafeAreaProvider>
  )
}

registerRootComponent(RootApp)
