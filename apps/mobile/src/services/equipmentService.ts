import { getEquipmentPhotoUrl, getEquipmentPhotoUrls } from './equipmentImageService'
import { supabase } from '../supabase'

export type EquipmentStatus = 'RUNNING' | 'DOWN' | 'MAINTENANCE' | 'STOPPED'

export const EQUIPMENT_STATUS_OPTIONS: Array<{
  value: EquipmentStatus
  label: string
  color: string
  backgroundColor: string
}> = [
  { value: 'RUNNING', label: 'Hoạt động', color: '#067647', backgroundColor: '#D1FADF' },
  { value: 'DOWN', label: 'Không hoạt động', color: '#B42318', backgroundColor: '#FEE4E2' },
  { value: 'MAINTENANCE', label: 'Bảo trì', color: '#B54708', backgroundColor: '#FEF0C7' },
  { value: 'STOPPED', label: 'Dừng', color: '#475467', backgroundColor: '#F2F4F7' },
]

export function equipmentStatusLabel(status: string) {
  return EQUIPMENT_STATUS_OPTIONS.find((option) => option.value === status.toUpperCase())?.label || status || 'Không xác định'
}

export function equipmentStatusVisual(status: string) {
  return EQUIPMENT_STATUS_OPTIONS.find((option) => option.value === status.toUpperCase()) || {
    value: 'STOPPED' as EquipmentStatus,
    label: status || 'Không xác định',
    color: '#475467',
    backgroundColor: '#F2F4F7',
  }
}

export type EquipmentListItem = {
  equipmentId: string
  equipmentName: string
  model: string
  manufacturer: string
  status: string
  area: string
  line: string
  category: string
  updatedAt: string
  imageUrl: string
}

export type EquipmentDetail = EquipmentListItem & {
  serialNumber: string
  origin: string
  managingDepartment: string
  responsiblePrimary: string
  responsibleSecondary: string
  description: string
  technicalSpecification: string
}

type EquipmentMasterRow = {
  equipment_id: string
  equipment_name: string | null
  model: string | null
  manufacturer: string | null
  status: string | null
  source_data: Record<string, unknown> | null
  updated_at: string | null
}

function readSourceText(source: Record<string, unknown> | null, ...keys: string[]) {
  if (!source) return ''
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function mapRow(row: EquipmentMasterRow, imageUrl = ''): EquipmentDetail {
  const source = row.source_data || {}
  return {
    equipmentId: String(row.equipment_id || ''),
    equipmentName: String(row.equipment_name || '').trim(),
    model: String(row.model || '').trim(),
    manufacturer: String(row.manufacturer || '').trim(),
    status: String(row.status || readSourceText(source, 'status') || 'UNKNOWN'),
    area: readSourceText(source, 'currentArea', 'area'),
    line: readSourceText(source, 'currentLine', 'line'),
    category: readSourceText(source, 'equipmentCategory', 'category'),
    updatedAt: String(row.updated_at || ''),
    imageUrl,
    serialNumber: readSourceText(source, 'serialNumber', 'serial_number'),
    origin: readSourceText(source, 'origin'),
    managingDepartment: readSourceText(source, 'managingDepartment', 'department'),
    responsiblePrimary: readSourceText(source, 'managementResponsiblePrimary', 'responsiblePrimary'),
    responsibleSecondary: readSourceText(source, 'managementResponsibleSecondary', 'responsibleSecondary'),
    description: readSourceText(source, 'description'),
    technicalSpecification: readSourceText(source, 'technicalSpecification', 'specification'),
  }
}

export async function listEquipment(limit = 500): Promise<EquipmentListItem[]> {
  const { data, error } = await supabase
    .from('equipment_master')
    .select('equipment_id,equipment_name,model,manufacturer,status,source_data,updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message || 'Không tải được danh sách thiết bị.')

  const rows = (data || []) as EquipmentMasterRow[]
  const imageUrls = await getEquipmentPhotoUrls(rows.map((row) => String(row.equipment_id || '')))
  return rows.map((row) => mapRow(row, imageUrls[String(row.equipment_id || '')] || ''))
}

export async function getEquipmentDetail(equipmentId: string): Promise<EquipmentDetail> {
  const { data, error } = await supabase
    .from('equipment_master')
    .select('equipment_id,equipment_name,model,manufacturer,status,source_data,updated_at')
    .eq('equipment_id', equipmentId)
    .single()

  if (error) throw new Error(error.message || 'Không tải được chi tiết thiết bị.')
  const imageUrl = await getEquipmentPhotoUrl(equipmentId)
  return mapRow(data as EquipmentMasterRow, imageUrl)
}

export async function updateEquipmentStatus(equipmentId: string, status: EquipmentStatus) {
  const normalizedId = equipmentId.trim()
  if (!normalizedId) throw new Error('Thiếu mã thiết bị.')
  if (!EQUIPMENT_STATUS_OPTIONS.some((option) => option.value === status)) {
    throw new Error('Trạng thái thiết bị không hợp lệ.')
  }

  const { data, error } = await supabase
    .from('equipment_master')
    .update({ status })
    .eq('equipment_id', normalizedId)
    .select('equipment_id,status')
    .single()

  if (error) throw new Error(error.message || 'Không cập nhật được trạng thái thiết bị.')
  return {
    equipmentId: String(data?.equipment_id || normalizedId),
    status: String(data?.status || status) as EquipmentStatus,
  }
}
