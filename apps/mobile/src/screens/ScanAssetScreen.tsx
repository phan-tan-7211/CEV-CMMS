import { ModulePlaceholderScreen } from '../components/ModulePlaceholderScreen'

export function ScanAssetScreen({ onBack }: { onBack: () => void }) {
  return (
    <ModulePlaceholderScreen
      title="Quét QR"
      subtitle="Màn hình quét QR native đã được tách riêng để nối camera và equipment_id ở batch tiếp theo."
      icon="scan-outline"
      onBack={onBack}
    />
  )
}
