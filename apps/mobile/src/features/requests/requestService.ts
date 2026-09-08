import { supabase } from '../../lib/supabase/client'
export async function createMaintenanceRequest(input: { equipmentId: string; reason: string; sourceId?: string }) {
  const { data, error } = await supabase.rpc('rpc_create_maintenance_request', { p_equipment_id: input.equipmentId, p_reason: input.reason, p_source_id: input.sourceId || input.equipmentId })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  const requestId = String(result.requestId || '').trim()
  if (!requestId) throw new Error('Server không trả về mã yêu cầu.')
  return { requestId, status: String(result.status || 'OPEN') }
}
