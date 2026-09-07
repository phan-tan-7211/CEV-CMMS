import { ModulePlaceholderScreen } from '../components/ModulePlaceholderScreen'

export function WorkOrdersScreen({ onBack }: { onBack: () => void }) {
  return (
    <ModulePlaceholderScreen
      title="Công việc"
      subtitle="Danh sách Work Order native đã có screen boundary riêng; dữ liệu thật sẽ nối vào service/cache sau."
      icon="clipboard-outline"
      onBack={onBack}
    />
  )
}
