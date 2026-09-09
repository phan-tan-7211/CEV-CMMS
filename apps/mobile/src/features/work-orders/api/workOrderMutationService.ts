import { supabase } from '../../../lib/supabase/client'

function text(value: unknown) { return String(value ?? '').trim() }
function operationId(prefix: string) { return `MOBILE-${prefix}-${Date.now()}` }
async function rpc(name: string, params: Record<string, unknown>, fallback: string) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || fallback)
  return data
}

export type WorkOrderTransitionAction = 'REQUEST_APPROVAL' | 'APPROVE' | 'START' | 'COMPLETE' | 'VERIFY' | 'RELEASE'

export async function createMaintenanceWorkOrder(input: { equipmentId: string; reason: string; priority: string; sourceType?: string; sourceId?: string; personIds?: string[]; teamIds?: string[]; operationId?: string }) {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Vui lòng nhập nội dung công việc.')
  const data = await rpc('rpc_cmms_create_work_order_v2', {
    p_input: { equipmentId: input.equipmentId.trim(), reason, priority: input.priority.trim() || 'MEDIUM', sourceType: input.sourceType || 'MOBILE', sourceId: input.sourceId || input.equipmentId.trim(), operationId: input.operationId?.trim() || operationId('CREATE-WO'), personIds: input.personIds || [], teamIds: input.teamIds || [] },
  }, 'Không thể tạo Work Order.')
  const result = (data || {}) as Record<string, unknown>
  const workOrderId = text(result.workOrderId)
  if (!workOrderId) throw new Error('Server không trả về mã Work Order.')
  return { workOrderId, status: text(result.status) }
}

export async function assignWorkOrder(workOrderId: string, personIds: string[], teamIds: string[]) {
  return rpc('rpc_cmms_assign_work_order', { p_work_order_id: workOrderId.trim(), p_person_ids: personIds, p_team_ids: teamIds }, 'Không thể cập nhật người/nhóm được giao.')
}

export async function setWorkOrderReviewAssignments(input: { workOrderId: string; watcherPersonIds: string[]; approverPersonIds: string[]; verifierPersonIds: string[] }) {
  return rpc('rpc_cmms_set_work_order_review_assignments', {
    p_work_order_id: input.workOrderId.trim(),
    p_watcher_person_ids: input.watcherPersonIds,
    p_approver_person_ids: input.approverPersonIds,
    p_verifier_person_ids: input.verifierPersonIds,
  }, 'Không thể cập nhật người theo dõi/duyệt/xác nhận.')
}

export async function addWorkOrderChecklistItem(workOrderId: string, title: string, required = false) {
  if (!title.trim()) throw new Error('Tên checklist là bắt buộc.')
  return rpc('rpc_cmms_add_checklist_item', { p_work_order_id: workOrderId.trim(), p_title: title.trim(), p_description: null, p_response_type: 'CHECK', p_required: required, p_sequence_no: 0 }, 'Không thể thêm checklist.')
}

export async function completeWorkOrderChecklistItem(checklistItemId: string, completed: boolean) {
  return rpc('rpc_cmms_complete_checklist_item', { p_checklist_item_id: checklistItemId, p_completed: completed, p_response_text: null, p_response_number: null }, 'Không thể cập nhật checklist.')
}

export async function addWorkOrderPartUsage(input: { workOrderId: string; partName: string; quantity: number; unit?: string; unitCost?: number | null; notes?: string }) {
  if (!input.partName.trim()) throw new Error('Tên phụ tùng là bắt buộc.')
  if (!(input.quantity > 0)) throw new Error('Số lượng phải lớn hơn 0.')
  return rpc('rpc_cmms_add_part_usage', { p_work_order_id: input.workOrderId.trim(), p_part_name: input.partName.trim(), p_quantity: input.quantity, p_unit: input.unit || null, p_unit_cost: input.unitCost ?? null, p_spare_part_id: null, p_notes: input.notes || null }, 'Không thể ghi nhận phụ tùng sử dụng.')
}

export async function addWorkOrderLabor(input: { workOrderId: string; personId: string; startedAt: string; endedAt?: string; hourlyRate?: number | null; note?: string }) {
  if (!input.personId) throw new Error('Chọn người thực hiện trước khi ghi giờ công.')
  return rpc('rpc_cmms_add_labor', { p_work_order_id: input.workOrderId.trim(), p_person_id: input.personId, p_started_at: input.startedAt, p_ended_at: input.endedAt || null, p_hourly_rate: input.hourlyRate ?? null, p_note: input.note || null }, 'Không thể ghi nhận giờ công.')
}

export async function saveWorkOrderExecution(input: { workOrderId: string; rootCause?: string; correctiveAction?: string; preventiveAction?: string; executionNote?: string; downtimeStartedAt?: string; downtimeEndedAt?: string; downtimeCauseCategory?: string; downtimeDetail?: string }) {
  return rpc('rpc_save_maintenance_execution', {
    p_work_order_id: input.workOrderId.trim(),
    p_input: { rootCause: input.rootCause || '', correctiveAction: input.correctiveAction || '', preventiveAction: input.preventiveAction || '', executionNote: input.executionNote || '', downtimeStartedAt: input.downtimeStartedAt || '', downtimeEndedAt: input.downtimeEndedAt || '', downtimeCauseCategory: input.downtimeCauseCategory || '', downtimeDetail: input.downtimeDetail || '' },
    p_operation_id: operationId('EXECUTION'),
  }, 'Không thể lưu kết quả thực hiện.')
}

export async function transitionWorkOrder(workOrderId: string, action: WorkOrderTransitionAction) {
  const data = await rpc('rpc_transition_maintenance', { p_work_order_id: workOrderId.trim(), p_action: action, p_operation_id: operationId(action) }, 'Không thể chuyển trạng thái Work Order.')
  const row = (data || {}) as Record<string, unknown>
  return { status: text(row.status) }
}

export async function recordWorkOrderHandover(input: { workOrderId: string; equipmentId: string; handoverPerson: string; receiverPerson: string; handoverReason: string; equipmentCondition: 'NORMAL' | 'MINOR_ISSUE' | 'NOT_OPERATIONAL'; accepted: boolean }) {
  if (!input.handoverPerson.trim() || !input.receiverPerson.trim() || !input.handoverReason.trim()) throw new Error('Người bàn giao, người nhận và lý do là bắt buộc.')
  return rpc('rpc_record_equipment_handover', { p_input: input }, 'Không thể ghi nhận bàn giao thiết bị.')
}
