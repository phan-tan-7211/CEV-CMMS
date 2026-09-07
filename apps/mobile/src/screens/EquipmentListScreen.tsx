import { ModulePlaceholderScreen } from '../components/ModulePlaceholderScreen'

export function EquipmentListScreen({ onBack, onCreateEquipment }: { onBack: () => void; onCreateEquipment: () => void }) {
  return (
    <ModulePlaceholderScreen
      title="Thiết bị"
      subtitle="Danh sách thiết bị native sẽ được nối vào repository/cache hiện có ở batch kế tiếp."
      icon="cube-outline"
      onBack={onBack}
      primaryLabel="Thêm thiết bị"
      onPrimary={onCreateEquipment}
    />
  )
}
