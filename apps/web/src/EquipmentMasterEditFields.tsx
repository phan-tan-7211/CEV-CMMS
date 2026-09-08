import { useEffect, useMemo, useRef, useState } from 'react'
import './EquipmentEditUnified.css'
import { SmartAutocomplete } from './components/SmartAutocomplete'
import type { EquipmentMasterEditInput } from './data/equipmentMasterEdit'
import { buildEquipmentMasterSuggestions, canonicalizeMasterValue, type EquipmentMasterSuggestionKey, type EquipmentMasterSuggestions } from './data/equipmentMasterFields'
import { loadLiveEquipment } from './data/liveEquipment'
import { getOrgAutocompleteOptions, loadOrgMaster } from './data/orgMaster'

type Props = {
  value: EquipmentMasterEditInput
  suggestions: EquipmentMasterSuggestions
  onChange: (next: EquipmentMasterEditInput) => void
}

export function EquipmentMasterEditFields({ value, suggestions, onChange }: Props) {
  const hydratedEquipmentId = useRef('')
  const [responsibleSuggestions, setResponsibleSuggestions] = useState<string[]>([])
  const [, setOrgReady] = useState(0)

  useEffect(() => {
    let active = true
    void loadOrgMaster().then(() => { if (active) setOrgReady((currentCount) => currentCount + 1) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    const equipmentId = value.equipmentId.trim()
    if (!equipmentId || hydratedEquipmentId.current === equipmentId) return
    hydratedEquipmentId.current = equipmentId
    let active = true
    void loadLiveEquipment({ force: true }).then((rows) => {
      if (!active) return
      const managerSuggestions = buildEquipmentMasterSuggestions(rows.map((row) => ({ ...row, department: row.usingDepartment })))
      setResponsibleSuggestions(Array.from(new Set([...managerSuggestions.managementResponsiblePrimary, ...managerSuggestions.managementResponsibleSecondary])))
      const current = rows.find((row) => row.equipmentId === equipmentId)
      if (!current) return
      onChange({
        ...value,
        distributor: value.distributor || current.distributor || '',
        managementResponsiblePrimary: current.managementResponsiblePrimary || value.managementResponsiblePrimary || '',
        managementResponsibleSecondary: current.managementResponsibleSecondary || value.managementResponsibleSecondary || '',
        managingDepartment: current.managingDepartment || value.managingDepartment || '',
      })
    }).catch(() => undefined)
    return () => { active = false }
  }, [onChange, value])

  const mergedSuggestions = useMemo<EquipmentMasterSuggestions>(() => {
    const context = { managingDepartment: value.managingDepartment }
    const orgDepartments = getOrgAutocompleteOptions('managingDepartment', context)
    const orgPrimaryPeople = getOrgAutocompleteOptions('managementResponsiblePrimary', context)
    const orgSecondaryPeople = getOrgAutocompleteOptions('managementResponsibleSecondary', context)
    const orgAreas = getOrgAutocompleteOptions('currentArea', context)
    const orgLines = getOrgAutocompleteOptions('currentLine', context)
    return {
      ...suggestions,
      managingDepartment: orgDepartments.length ? orgDepartments : suggestions.managingDepartment,
      managementResponsiblePrimary: orgPrimaryPeople.length ? orgPrimaryPeople : responsibleSuggestions.length ? responsibleSuggestions : suggestions.managementResponsiblePrimary,
      managementResponsibleSecondary: orgSecondaryPeople.length ? orgSecondaryPeople : responsibleSuggestions.length ? responsibleSuggestions : suggestions.managementResponsibleSecondary,
      currentArea: orgAreas.length ? orgAreas : suggestions.currentArea,
      currentLine: orgLines.length ? orgLines : suggestions.currentLine,
    }
  }, [responsibleSuggestions, suggestions, value.managingDepartment])

  function setField<K extends keyof EquipmentMasterEditInput>(key: K, nextValue: EquipmentMasterEditInput[K]) {
    onChange({ ...value, [key]: nextValue })
  }

  function textField(key: keyof EquipmentMasterEditInput, label: string, suggestionKey?: EquipmentMasterSuggestionKey, wide = false, required = false) {
    return <label className={wide ? 'equipment-edit-wide' : undefined}><span>{label}{required ? ' *' : ''}</span>{suggestionKey ? <SmartAutocomplete required={required} value={String(value[key] || '')} options={mergedSuggestions[suggestionKey]} onChange={(nextValue) => setField(key, nextValue as never)} onBlur={() => setField(key, canonicalizeMasterValue(String(value[key] || ''), mergedSuggestions[suggestionKey]) as never)} /> : <input required={required} value={String(value[key] || '')} onChange={(event) => setField(key, event.target.value as never)} />}</label>
  }

  return <div className="equipment-edit-grid equipment-edit-grid-unified">
    <label><span>Loại thiết bị *</span><input value={value.equipmentType === 'MEASUREMENT' ? 'Thiết bị đo kiểm' : 'Thiết bị sản xuất'} readOnly /></label>
    <label><span>Trạng thái *</span><select required value={value.status} onChange={(event) => setField('status', event.target.value)}><option value="RUNNING">Hoạt động</option><option value="DOWN">Sự cố</option><option value="MAINTENANCE">Bảo trì</option><option value="STOPPED">Dừng</option><option value="DISPOSED">Thanh lý</option></select></label>
    {textField('equipmentName','Tên thiết bị','equipmentName',true,true)}
    {textField('equipmentCategory','Nhóm thiết bị','equipmentCategory')}
    {textField('manufacturer','Hãng / nhà sản xuất','manufacturer')}
    {textField('distributor','Nhà phân phối','distributor')}
    {textField('model','Mẫu máy','model')}
    {textField('serialNumber','Số sê-ri')}
    {textField('managingDepartment','Bộ phận quản lý','managingDepartment')}
    {textField('managementResponsiblePrimary','Người phụ trách quản lý · Chính','managementResponsiblePrimary',false,true)}
    {textField('managementResponsibleSecondary','Người phụ trách quản lý · Phụ','managementResponsibleSecondary')}
    {textField('currentArea','Khu vực','currentArea')}
    {textField('currentLine','Dây chuyền','currentLine')}
    {textField('origin','Xuất xứ','origin')}
    {textField('accuracy','Độ chính xác','accuracy')}
    <label><span>Ngày sản xuất</span><input type="date" value={value.manufactureDate} onChange={(event) => setField('manufactureDate', event.target.value)} /></label>
    <label><span>Ngày đưa vào sử dụng</span><input type="date" value={value.inServiceDate} onChange={(event) => setField('inServiceDate', event.target.value)} /></label>
    <label><span>Bảo hành đến ngày</span><input type="date" value={value.warrantyUntil} onChange={(event) => setField('warrantyUntil', event.target.value)} /></label>
    {textField('warrantyContact','Liên hệ bảo hành','warrantyContact')}
    {textField('technicalSpecification','Thông số kỹ thuật','technicalSpecification')}
    {textField('description','Mô tả / chức năng chính','description')}
    {textField('note','Ghi chú','note')}
    {textField('relatedDocuments','Tài liệu liên quan','relatedDocuments')}
    <label className="equipment-edit-system-id"><span>Mã thiết bị · hệ thống quản lý</span><input value={value.equipmentId} readOnly /></label>
  </div>
}
