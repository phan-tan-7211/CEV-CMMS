import type { EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import { booleanSelectValue, parseBooleanSelect, type ColumnKey } from './useEquipmentPanelController'

const questions: [ColumnKey, string][] = [
  ['controlsProductQuality', '1. Thiết bị trực tiếp tạo / kiểm soát đặc tính chất lượng?'],
  ['specialCharacteristicImpact', '2. Liên quan đặc tính đặc biệt / an toàn sản phẩm?'],
  ['stopsProduction', '3. Mất chức năng có dừng công đoạn / dây chuyền?'],
  ['hasBackup', '4. Có thiết bị / phương án dự phòng dùng ngay?'],
  ['capacityImpact', '5. Mất chức năng có rủi ro sản lượng / giao hàng?'],
]

export function EquipmentCriticalityEditor({ editing, setEditing, result }: { editing: EquipmentMasterEditInput; setEditing: (value: EquipmentMasterEditInput) => void; result: string }) {
  return <fieldset className="equipment-edit-criticality">
    <legend>Mức độ quan trọng thiết bị · tự tính A/B/C/D</legend>
    <p>Trả lời 5 sự thật của quá trình. Hệ thống tự tính lại cấp khi lưu.</p>
    <div className="equipment-edit-criticality-grid">
      {questions.map(([key, label]) => <label key={key}><span>{label}</span><select value={booleanSelectValue(editing[key as keyof EquipmentMasterEditInput] as boolean | undefined)} onChange={(event) => setEditing({ ...editing, [key]: parseBooleanSelect(event.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>)}
    </div>
    <div className={`equipment-edit-criticality-result${result ? ` level-${result.toLowerCase()}` : ''}`}><span>Kết quả tự động</span><strong>{result ? `Cấp ${result}` : 'Trả lời đủ 5 câu'}</strong></div>
  </fieldset>
}
