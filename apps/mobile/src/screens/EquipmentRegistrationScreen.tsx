import { RegistrationScreen } from '../../App'

/**
 * Dedicated route boundary for equipment registration.
 * The form owns one contextual Back control; MobileShell owns the route stack.
 */
export function EquipmentRegistrationScreen({ onBack }: { onBack: () => void }) {
  return <RegistrationScreen onBack={onBack} />
}
