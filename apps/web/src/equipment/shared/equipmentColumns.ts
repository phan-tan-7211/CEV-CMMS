import type { EquipmentRowPatch } from '../../data/equipmentBulkEdit'
import type { LiveEquipment } from '../../data/liveEquipment'

export const statusLabel: Record<string, string> = { RUNNING: 'Hoạt động', DOWN: 'Sự cố', MAINTENANCE: 'Bảo trì', STOPPED: 'Dừng', DISPOSED: 'Thanh lý', UNKNOWN: 'Chưa rõ' }
export const labelSizeLabel: Record<string, string> = { tiny: '15 × 25 mm', standard: '30 × 50 mm', large: '45 × 80 mm' }

export type PhotoInfo = { state: 'loading' | 'yes' | 'no' | 'error'; url: string }
export type PhotoHover = { url: string; name: string; x: number; y: number; size: number }
export type SortDirection = 'asc' | 'desc'
export type ColumnKey =
  | 'equipmentId' | 'equipmentName' | 'equipmentType' | 'equipmentCategory' | 'manufacturer' | 'distributor' | 'model' | 'serialNumber'
  | 'usingDepartment' | 'managingDepartment' | 'managementResponsiblePrimary' | 'managementResponsibleSecondary' | 'currentArea' | 'currentLine' | 'status' | 'defaultLabelSize'
  | 'technicalSpecification' | 'description' | 'accuracy' | 'criticality'
  | 'controlsProductQuality' | 'specialCharacteristicImpact' | 'stopsProduction' | 'hasBackup' | 'capacityImpact'
  | 'origin' | 'manufactureDate' | 'inServiceDate' | 'warrantyUntil' | 'warrantyContact'
  | 'note' | 'relatedDocuments' | 'qrCode' | 'active' | 'updatedAt'
export type ColumnGroup = 'Nhận diện'|'Quản lý'|'Kỹ thuật'|'Vòng đời'|'Tài liệu'|'Hệ thống'
export type ColumnDef = { key: ColumnKey; label: string; defaultVisible?: boolean; group: ColumnGroup }
export type ColumnFilters = Partial<Record<ColumnKey, string[]>>
export type InlineChanges = Record<string, EquipmentRowPatch>

// v6 resets the old "show all 35 columns" preference after the desktop layout containment pass.
// Users can still re-enable every field from the column picker.
export const COLUMN_STORAGE_KEY = 'cev-equipment-visible-columns-v6'
export const COLUMNS: ColumnDef[] = [
  { key:'equipmentId',label:'Mã thiết bị',defaultVisible:true,group:'Nhận diện' },
  { key:'equipmentName',label:'Tên thiết bị',defaultVisible:true,group:'Nhận diện' },
  { key:'equipmentType',label:'Loại thiết bị',defaultVisible:true,group:'Nhận diện' },
  { key:'equipmentCategory',label:'Nhóm thiết bị',group:'Nhận diện' },
  { key:'managingDepartment',label:'Bộ phận quản lý',defaultVisible:true,group:'Quản lý' },
  { key:'managementResponsiblePrimary',label:'Người QL chính',defaultVisible:true,group:'Quản lý' },
  { key:'managementResponsibleSecondary',label:'Người QL phụ',group:'Quản lý' },
  { key:'usingDepartment',label:'Bộ phận sử dụng',defaultVisible:true,group:'Quản lý' },
  { key:'currentArea',label:'Khu vực',defaultVisible:true,group:'Quản lý' },
  { key:'currentLine',label:'Dây chuyền',group:'Quản lý' },
  { key:'status',label:'Trạng thái',defaultVisible:true,group:'Quản lý' },
  { key:'defaultLabelSize',label:'Khổ tem mặc định',group:'Quản lý' },
  { key:'manufacturer',label:'Hãng / nhà sản xuất',defaultVisible:true,group:'Nhận diện' },
  { key:'distributor',label:'Nhà phân phối',group:'Nhận diện' },
  { key:'model',label:'Mẫu máy',defaultVisible:true,group:'Nhận diện' },
  { key:'serialNumber',label:'Số sê-ri',group:'Nhận diện' },
  { key:'technicalSpecification',label:'Thông số kỹ thuật',group:'Kỹ thuật' },
  { key:'description',label:'Mô tả / chức năng',group:'Kỹ thuật' },
  { key:'accuracy',label:'Độ chính xác',group:'Kỹ thuật' },
  { key:'criticality',label:'Cấp độ A/B/C/D',defaultVisible:true,group:'Kỹ thuật' },
  { key:'controlsProductQuality',label:'Kiểm soát chất lượng',group:'Kỹ thuật' },
  { key:'specialCharacteristicImpact',label:'Ảnh hưởng đặc tính đặc biệt',group:'Kỹ thuật' },
  { key:'stopsProduction',label:'Mất máy gây dừng SX',group:'Kỹ thuật' },
  { key:'hasBackup',label:'Có thiết bị dự phòng',group:'Kỹ thuật' },
  { key:'capacityImpact',label:'Ảnh hưởng sản lượng / giao hàng',group:'Kỹ thuật' },
  { key:'origin',label:'Xuất xứ',group:'Vòng đời' },
  { key:'manufactureDate',label:'Ngày sản xuất',group:'Vòng đời' },
  { key:'inServiceDate',label:'Ngày đưa vào sử dụng',group:'Vòng đời' },
  { key:'warrantyUntil',label:'Bảo hành đến',group:'Vòng đời' },
  { key:'warrantyContact',label:'Liên hệ bảo hành',group:'Vòng đời' },
  { key:'note',label:'Ghi chú',group:'Tài liệu' },
  { key:'relatedDocuments',label:'Tài liệu liên quan',group:'Tài liệu' },
  { key:'qrCode',label:'Mã QR',group:'Hệ thống' },
  { key:'active',label:'Đang quản lý',group:'Hệ thống' },
  { key:'updatedAt',label:'Cập nhật gần nhất',group:'Hệ thống' },
]

export function booleanSelectValue(value: boolean | undefined) { return value === true ? 'YES' : value === false ? 'NO' : '' }
export function parseBooleanSelect(value: string) { return value === 'YES' ? true : value === 'NO' ? false : undefined }
function clean(value: unknown) { return String(value ?? '').trim() }
function yesNo(value: boolean | undefined) { return value === true ? 'Có' : value === false ? 'Không' : 'Chưa trả lời' }

export function columnValue(row: LiveEquipment, key: ColumnKey) {
  if (key === 'equipmentType') return row.equipmentType === 'MEASUREMENT' ? 'Đo kiểm' : 'Sản xuất'
  if (key === 'status') return statusLabel[row.status] || row.status
  if (key === 'defaultLabelSize') return labelSizeLabel[row.defaultLabelSize || 'standard'] || '30 × 50 mm'
  if (key === 'controlsProductQuality') return yesNo(row.criticalityFacts?.controlsProductQuality)
  if (key === 'specialCharacteristicImpact') return yesNo(row.criticalityFacts?.specialCharacteristicImpact)
  if (key === 'stopsProduction') return yesNo(row.criticalityFacts?.stopsProduction)
  if (key === 'hasBackup') return yesNo(row.criticalityFacts?.hasBackup)
  if (key === 'capacityImpact') return yesNo(row.criticalityFacts?.capacityImpact)
  if (key === 'active') return row.active ? 'Đang quản lý' : 'Ngừng quản lý'
  if (key === 'updatedAt') return row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('vi-VN') : ''
  return clean(row[key as keyof LiveEquipment])
}

export function documentLinks(value: string) { return value.split(/[\n;,]+/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item)) }
export function includesQuery(row: LiveEquipment, query: string) { if (!query) return true; return COLUMNS.map((col) => columnValue(row,col.key)).join(' ').toLocaleLowerCase().includes(query) }
export function defaultVisibleColumns() { return COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key) }
export function loadVisibleColumns(): ColumnKey[] { try { const parsed = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || '[]'); const valid = Array.isArray(parsed) ? parsed.filter((key): key is ColumnKey => COLUMNS.some((col) => col.key === key)) : []; return valid.length ? valid : defaultVisibleColumns() } catch { return defaultVisibleColumns() } }

export function photoHoverPosition(clientX:number,clientY:number){
  const margin=12, gap=14
  const size=Math.min(360,Math.max(180,window.innerWidth-margin*2),Math.max(180,window.innerHeight-margin*2))
  let x=clientX+gap, y=clientY-size-gap
  if(x+size>window.innerWidth-margin)x=clientX-size-gap
  x=Math.max(margin,Math.min(x,window.innerWidth-size-margin))
  y=Math.max(margin,Math.min(y,window.innerHeight-size-margin))
  return {x,y,size}
}

export function patchKeyForColumn(key: ColumnKey): keyof EquipmentRowPatch | null {
  if (key === 'usingDepartment') return 'department'
  if (['equipmentId','equipmentType','criticality','qrCode','updatedAt'].includes(key)) return null
  return key as keyof EquipmentRowPatch
}
function editableRawValue(row: LiveEquipment, key: ColumnKey) {
  if (key === 'usingDepartment') return row.usingDepartment
  if (key === 'controlsProductQuality') return row.criticalityFacts?.controlsProductQuality
  if (key === 'specialCharacteristicImpact') return row.criticalityFacts?.specialCharacteristicImpact
  if (key === 'stopsProduction') return row.criticalityFacts?.stopsProduction
  if (key === 'hasBackup') return row.criticalityFacts?.hasBackup
  if (key === 'capacityImpact') return row.criticalityFacts?.capacityImpact
  return row[key as keyof LiveEquipment] as string | boolean | undefined
}
export function inlineValue(row: LiveEquipment, key: ColumnKey, changes: InlineChanges) {
  const patchKey=patchKeyForColumn(key)
  if (!patchKey) return undefined
  const patch=changes[row.equipmentId]
  if (patch && Object.prototype.hasOwnProperty.call(patch,patchKey)) return patch[patchKey] as string | boolean | undefined
  return editableRawValue(row,key)
}