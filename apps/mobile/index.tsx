import { registerRootComponent } from 'expo'
import { AutocompleteDropdownContextProvider } from 'react-native-autocomplete-dropdown'

import { MobileShell } from './src/MobileShell'

function RootApp() {
  return (
    <AutocompleteDropdownContextProvider>
      <MobileShell />
    </AutocompleteDropdownContextProvider>
  )
}

registerRootComponent(RootApp)