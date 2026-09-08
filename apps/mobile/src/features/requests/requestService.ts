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
