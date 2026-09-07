import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import App from '../../App'

/**
 * Transitional boundary around the existing registration form.
 * Registration internals remain in App.tsx until the dedicated extraction batch.
 *
 * The legacy form still owns its internal step-back button. This boundary overlays
 * the step-0 back control so MobileShell can exit registration without signing out.
 */
export function EquipmentRegistrationScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      <App />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thoát thêm thiết bị"
        onPress={onBack}
        style={({ pressed }) => [
          styles.exitButton,
          { top: insets.top + 14 },
          pressed && styles.exitButtonPressed,
        ]}
      >
        <Ionicons name="chevron-back" size={22} color="#101828" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  exitButton: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    elevation: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4F7',
  },
  exitButtonPressed: {
    opacity: 0.72,
  },
})
