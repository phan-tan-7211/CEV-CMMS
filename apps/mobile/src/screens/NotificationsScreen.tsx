import { ModulePlaceholderScreen } from '../components/ModulePlaceholderScreen'

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ModulePlaceholderScreen
      title="Thông báo"
      subtitle="Thông báo native sẽ được nối vào service riêng; Home không còn phải chứa logic module này."
      icon="notifications-outline"
      onBack={onBack}
    />
  )
}
