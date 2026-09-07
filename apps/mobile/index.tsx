import { registerRootComponent } from 'expo'
import { AutocompleteDropdownContextProvider } from 'react-native-autocomplete-dropdown'

import App from './App'

function RootApp() {
  return (
    <AutocompleteDropdownContextProvider>
      <App />
    </AutocompleteDropdownContextProvider>
  )
}

registerRootComponent(RootApp)
