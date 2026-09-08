import { RegistrationScreen } from '../../App'

/**
 * Dedicated route boundary for equipment registration.
 * The form owns one contextual Back control; MobileShell owns the route stack.
 */
export function EquipmentRegistrationScreen({ onBack, initialBarcode, onCreated }: { onBack: () => void; initialBarcode?: string; onCreated?: (equipmentId: string) => void }) {
  return <RegistrationScreen onBack={onBack} initialBarcode={initialBarcode} onCreated={onCreated} />
}
