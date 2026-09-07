import { supabase } from '../supabase'

export type EquipmentStatusMaster = {
  statusCode: string
  displayName: string
  color: string
  sortOrder: number
  usageCount: number
  locked: boolean
}

type EquipmentStatusRow = {
  status_code: string
  display_name: string
  color: string
  sort_order: number
  usage_count: number | string
  locked: boolean
}

function mapRow(row: EquipmentStatusRow): EquipmentStatusMaster {
  return {
    statusCode: String(row.status_code || '').trim(),
    displayName: String(row.display_name || '').trim(),
    color: String(row.color || '#667085'),
    sortOrder: Number(row.sort_order || 0),
    usageCount: Number(row.usage_count || 0),
    locked: Boolean(row.locked),
  }
}

export async function listEquipmentStatuses(): Promise<EquipmentStatusMaster[]> {
  const { data, error } = await supabase.rpc('rpc_list_equipment_status_master')
  if (error) throw new Error(error.message || 'Không tải được danh sách trạng thái thiết bị.')
  return ((data || []) as EquipmentStatusRow[]).map(mapRow)
}

export async function createEquipmentStatus(displayName: string, color: string) {
  const { error } = await supabase.rpc('rpc_create_equipment_status', {
    p_display_name: displayName.trim(),
    p_color: color,
  })
  if (error) throw new Error(error.message || 'Không thêm được trạng thái thiết bị.')
}

export async function updateEquipmentStatusMaster(statusCode: string, displayName: string, color: string) {
  const { error } = await supabase.rpc('rpc_update_equipment_status_master', {
    p_status_code: statusCode,
    p_display_name: displayName.trim(),
    p_color: color,
  })
  if (error) throw new Error(error.message || 'Không cập nhật được trạng thái thiết bị.')
}

export async function deleteEquipmentStatusMaster(statusCode: string) {
  const { error } = await supabase.rpc('rpc_delete_equipment_status_master', { p_status_code: statusCode })
  if (error) throw new Error(error.message || 'Không xóa được trạng thái thiết bị.')
}

export async function setEquipmentStatus(equipmentId: string, statusCode: string) {
  const { data, error } = await supabase.rpc('rpc_set_equipment_status', {
    p_equipment_id: equipmentId.trim(),
    p_status_code: statusCode.trim(),
  })
  if (error) throw new Error(error.message || 'Không cập nhật được trạng thái thiết bị.')
  const result = (data || {}) as Record<string, unknown>
  return String(result.status || statusCode)
}
