import { supabase } from '../../lib/supabase/client'
export async function createMaintenanceRequest(input: { equipmentId: string; reason: string; sourceId?: string }) {
  const { data, error } = await supabase.rpc('rpc_create_maintenance_request', { p_equipment_id: input.equipmentId, p_reason: input.reason, p_source_id: input.sourceId || input.equipmentId })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  const requestId = String(result.requestId || '').trim()
  if (!requestId) throw new Error('Server không trả về mã yêu cầu.')
  return { requestId, status: String(result.status || 'OPEN') }
}

export type MaintenanceRequest = { requestId: string; equipmentId: string; reason: string; status: string; sourceType: string; createdBy: string; createdAt: string }
export async function listMaintenanceRequests() {
  const { data, error } = await supabase.from('maintenance_request').select('request_id,equipment_id,reason,status,source_type,created_by,created_at').order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({ requestId: String(row.request_id || ''), equipmentId: String(row.equipment_id || ''), reason: String(row.reason || ''), status: String(row.status || ''), sourceType: String(row.source_type || ''), createdBy: String(row.created_by || ''), createdAt: String(row.created_at || '') }))
}
export async function getMaintenanceRequest(requestId: string) {
  const { data, error } = await supabase.from('maintenance_request').select('request_id,equipment_id,reason,status,source_type,source_id,created_by,created_at').eq('request_id', requestId.trim()).single()
  if (error) throw error
  const row = data as Record<string, unknown>
  return { requestId: String(row.request_id || ''), equipmentId: String(row.equipment_id || ''), reason: String(row.reason || ''), status: String(row.status || ''), sourceType: String(row.source_type || ''), sourceId: String(row.source_id || ''), createdBy: String(row.created_by || ''), createdAt: String(row.created_at || '') }
}
export async function transitionMaintenanceRequest(requestId: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') {
  const { data, error } = await supabase.rpc('rpc_transition_maintenance_request', { p_request_id: requestId.trim(), p_status: status })
  if (error) throw error
  return data
}
