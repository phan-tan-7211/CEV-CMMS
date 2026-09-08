import { supabase } from '../../../lib/supabase/client'

function text(value: unknown) { return String(value ?? '').trim() }

export async function createMaintenanceWorkOrder(input: { equipmentId: string; reason: string; priority: string; sourceType?: string; sourceId?: string; personIds?: string[]; teamIds?: string[] }) {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Vui lòng nhập nội dung công việc.')
  const { data, error } = await supabase.rpc('rpc_cmms_create_work_order_v2', {
    p_input: {
      equipmentId: input.equipmentId.trim(),
      reason,
      priority: input.priority.trim() || 'MEDIUM',
      sourceType: input.sourceType || 'MOBILE',
      sourceId: input.sourceId || input.equipmentId.trim(),
      operationId: `MOBILE-${Date.now()}`,
      personIds: input.personIds || [],
      teamIds: input.teamIds || [],
    },
  })
  if (error) throw new Error(error.message || 'Không thể tạo Work Order.')
  const result = (data || {}) as Record<string, unknown>
  const workOrderId = text(result.workOrderId)
  if (!workOrderId) throw new Error('Server không trả về mã Work Order.')
  return { workOrderId, status: text(result.status) }
}
