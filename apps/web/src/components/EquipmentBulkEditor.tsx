import { useMemo, useState } from 'react'
import './EquipmentBulkEditor.css'
import type { EquipmentMasterSuggestions } from '../data/equipmentMasterFields'
import type { EquipmentBulkPatch } from '../data/equipmentBulkEdit'

type FieldKey = keyof EquipmentBulkPatch

const FIELD_OPTIONS: Array<{ value: FieldKey; label: string }> = [
  { value: 'department', label: 'Bộ phận sử dụng' },
  { value: 'managingDepartment', label: 'Bộ phận quản lý' },
  { value: 'currentArea', label: 'Khu vực' },
  { value: 'currentLine', label: 'Dây chuyền' },
  { value: 'equipmentCategory', label: 'Nhóm thiết bị' },
  { value: 'status', label: 'Trạng thái' },
]

const STATUS_OPTIONS = [
  ['RUNNING','Hoạt động'],['DOWN','Sự cố'],['MAINTENANCE','Bảo trì'],['STOPPED','Dừng'],['DISPOSED','Thanh lý'],['UNKNOWN','Chưa rõ'],
]

export function EquipmentBulkEditor({ selectedCount, suggestions, saving, onApply, onExit }: {
  selectedCount: number
  suggestions: EquipmentMasterSuggestions
  saving: boolean
  onApply: (patch: EquipmentBulkPatch) => Promise<void> | void
  onExit: () => void
}) {
  const [field, setField] = useState<FieldKey>('department')
  const [value, setValue] = useState('')
  const listId = `bulk-${field}`
  const options = useMemo(() => {
    if (field === 'department') return suggestions.department
    if (field === 'managingDepartment') return suggestions.managingDepartment
    if (field === 'currentArea') return suggestions.currentArea
    if (field === 'currentLine') return suggestions.currentLine
    if (field === 'equipmentCategory') return suggestions.equipmentCategory
    return []
  }, [field, suggestions])

  return <div className="equipment-bulk-editor" role="region" aria-label="Chỉnh sửa hàng loạt">
    <div className="equipment-bulk-editor-title"><strong>Chế độ sửa hàng loạt</strong><span>{selectedCount} thiết bị đã chọn</span></div>
    <select value={field} onChange={(event) => { setField(event.target.value as FieldKey); setValue('') }} aria-label="Trường cần cập nhật">
      {FIELD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    {field === 'status'
      ? <select value={value} onChange={(event) => setValue(event.target.value)} aria-label="Giá trị mới"><option value="">Chọn trạng thái…</option>{STATUS_OPTIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
      : <><input value={value} onChange={(event) => setValue(event.target.value)} list={listId} placeholder="Chọn gợi ý hoặc nhập giá trị mới…" aria-label="Giá trị mới"/><datalist id={listId}>{options.map((item) => <option key={item} value={item}/>)}</datalist></>}
    <button className="equipment-bulk-apply" type="button" disabled={saving || !selectedCount || !value.trim()} onClick={() => void onApply({ [field]: value } as EquipmentBulkPatch)}>{saving ? 'Đang cập nhật…' : `Áp dụng cho ${selectedCount} máy`}</button>
    <button type="button" disabled={saving} onClick={onExit}>Thoát</button>
  </div>
}
