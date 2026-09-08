import { supabase } from '../../lib/supabase/client'

export type RequestAction = 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'CANCEL'

export async function createMaintenanceRequest(input: { equipmentId: string; title: string; description?: string; priority: string; sourceId?: string }) {
  const { data, error } = await supabase.rpc('rpc_cmms_create_request_v2', { p_input: { equipmentId: input.equipmentId, title: input.title, description: input.description || '', priority: input.priority, sourceId: input.sourceId || input.equipmentId } })
  if (error) throw new Error(error.message || 'Không thể tạo yêu cầu.')
  const result = (data || {}) as Record<string, unknown>
  const requestId = String(result.requestId || '').trim()
  if (!requestId) throw new Error('Server không trả về mã yêu cầu.')
  return { requestId, status: String(result.status || 'OPEN') }
}

export type MaintenanceRequest = {
  requestId: string
  equipmentId: string
  reason: string
  title: string
  description: string
  priority: string
  status: string
  sourceType: string
  sourceId?: string
  createdBy: string
  createdAt: string
  reviewedAt?: string
  rejectionReason?: string
  convertedWorkOrderId?: string
}

function mapRequest(row: Record<string, unknown>): MaintenanceRequest {
  return {
    requestId: String(row.request_id || ''),
    equipmentId: String(row.equipment_id || ''),
    reason: String(row.reason || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    priority: String(row.priority || ''),
    status: String(row.status || ''),
    sourceType: String(row.source_type || ''),
    sourceId: String(row.source_id || ''),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
    reviewedAt: String(row.reviewed_at || ''),
    rejectionReason: String(row.rejection_reason || ''),
    convertedWorkOrderId: String(row.converted_work_order_id || ''),
  }
}

const REQUEST_COLUMNS = 'request_id,equipment_id,reason,title,description,priority,status,source_type,source_id,created_by,created_at,reviewed_at,rejection_reason,converted_work_order_id'

export async function listMaintenanceRequests() {
  const { data, error } = await supabase.from('maintenance_request').select(REQUEST_COLUMNS).order('created_at', { ascending: false }).limit(500)
  if (error) throw new Error(error.message || 'Không tải được danh sách yêu cầu.')
  return ((data || []) as Array<Record<string, unknown>>).map(mapRequest)
}

export async function getMaintenanceRequest(requestId: string) {
  const { data, error } = await supabase.from('maintenance_request').select(REQUEST_COLUMNS).eq('request_id', requestId.trim()).single()
  if (error) throw new Error(error.message || 'Không tải được yêu cầu.')
  return mapRequest(data as Record<string, unknown>)
}

export async function transitionMaintenanceRequest(requestId: string, action: RequestAction, note = '') {
  const { data, error } = await supabase.rpc('rpc_cmms_transition_request', { p_request_id: requestId.trim(), p_action: action, p_note: note })
  if (error) throw new Error(error.message || 'Không cập nhật được trạng thái yêu cầu.')
  return data as { requestId?: string; status?: string }
}

export async function convertMaintenanceRequestToWorkOrder(requestId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_convert_request_to_work_order', {
    p_request_id: requestId.trim(),
    p_priority: null,
    p_assignee_person_id: null,
    p_team_id: null,
  })
  if (error) throw new Error(error.message || 'Không thể chuyển yêu cầu thành Work Order.')
  const row = (data || {}) as Record<string, unknown>
  const workOrderId = String(row.workOrderId || '').trim()
  if (!workOrderId) throw new Error('Server không trả về mã Work Order.')
  return { workOrderId, status: String(row.status || 'CONVERTED') }
}
