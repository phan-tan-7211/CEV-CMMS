import { supabase } from '../../../lib/supabase/client'

function text(value: unknown) { return String(value ?? '').trim() }

export async function createMaintenanceWorkOrder(input: { equipmentId: string; reason: string; priority: string; sourceType?: string; sourceId?: string }) {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Vui lòng nhập nội dung công việc.')
  const { data, error } = await supabase.rpc('rpc_create_maintenance_work_order', {
    p_operation_id: `MOBILE-SCAN-${Date.now()}`,
    p_equipment_id: input.equipmentId.trim(),
    p_source_type: input.sourceType || 'MANUAL_SCAN',
    p_source_id: input.sourceId || input.equipmentId.trim(),
    p_reason: reason,
    p_priority: input.priority.trim() || 'MEDIUM',
    p_method: '',
    p_planned_start_at: '',
    p_planned_end_at: '',
  })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  const workOrderId = text(result.workOrderId)
  if (!workOrderId) throw new Error('Server không trả về mã Work Order.')
  return { workOrderId, status: text(result.status) }
}
