import { ModulePlaceholderScreen } from '../components/ModulePlaceholderScreen'

export function MoreScreen({ onBack }: { onBack: () => void }) {
  return (
    <ModulePlaceholderScreen
      title="Thêm"
      subtitle="Khu vực thông báo, cài đặt và các module phụ sẽ được tách vào đây thay vì dồn vào Home/App.tsx."
      icon="menu-outline"
      onBack={onBack}
    />
  )
}
