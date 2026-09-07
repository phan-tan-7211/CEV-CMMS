import { getEquipmentPhotoUrl, getEquipmentPhotoUrls } from './equipmentImageService'
import { setEquipmentStatus } from './equipmentStatusService'
import { supabase } from '../../../lib/supabase/client'

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

export async function updateEquipmentStatus(equipmentId: string, status: string) {
  const normalizedId = equipmentId.trim()
  const normalizedStatus = status.trim()
  if (!normalizedId) throw new Error('Thiếu mã thiết bị.')
  if (!normalizedStatus) throw new Error('Thiếu trạng thái thiết bị.')

  const savedStatus = await setEquipmentStatus(normalizedId, normalizedStatus)
  return { equipmentId: normalizedId, status: savedStatus }
}
