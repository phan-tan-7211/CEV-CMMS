import App from '../../App'

export function EquipmentRegistrationScreen({ onBack }: { onBack: () => void }) {
  return <App onRegistrationExit={onBack} />
}
