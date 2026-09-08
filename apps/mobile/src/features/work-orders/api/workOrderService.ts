import { supabase } from '../../../lib/supabase/client'

export type WorkOrderListItem = {
  workOrderId: string
  equipmentId: string
  equipmentName: string
  equipmentModel: string
  status: string
  priority: string
  reason: string
  sourceType: string
  dueDate: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type WorkOrderPerson = { personId: string; displayName: string; role: string }
export type WorkOrderTeam = { teamId: string; name: string; role: string }
export type WorkOrderChecklistItem = {
  checklistItemId: string
  sequenceNo: number
  title: string
  description: string
  responseType: string
  required: boolean
  completed: boolean
  responseText: string
  responseNumber: number | null
  completedAt: string
}
export type WorkOrderPartUsage = { usageId: string; partName: string; quantity: number; unit: string; unitCost: number | null; notes: string; usedAt: string }
export type WorkOrderLabor = { laborId: string; personId: string; startedAt: string; endedAt: string; minutes: number | null; hourlyRate: number | null; note: string }
export type WorkOrderAttachment = { attachmentId: string; fileName: string; mimeType: string; storagePath: string; attachmentKind: string; createdAt: string }
export type WorkOrderDowntime = { downtimeId: string; startedAt: string; endedAt: string; sourceData: Record<string, unknown> }

export type WorkOrderDetail = WorkOrderListItem & {
  sourceId: string
  sourceData: Record<string, unknown>
  people: WorkOrderPerson[]
  teams: WorkOrderTeam[]
  checklist: WorkOrderChecklistItem[]
  parts: WorkOrderPartUsage[]
  labor: WorkOrderLabor[]
  attachments: WorkOrderAttachment[]
  downtime: WorkOrderDowntime[]
  requestId: string
  acceptedHandover: boolean
}

type WorkOrderRow = {
  work_order_id: string | null
  equipment_id: string | null
  status: string | null
  priority: string | null
  reason: string | null
  source_type: string | null
  source_id: string | null
  created_by: string | null
  source_data: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

type EquipmentRow = { equipment_id: string | null; equipment_name: string | null; model: string | null }

type DetailPayload = {
  workOrder?: Record<string, unknown>
  equipment?: Record<string, unknown>
  request?: Record<string, unknown> | null
  people?: Array<Record<string, unknown>>
  teams?: Array<Record<string, unknown>>
  checklist?: Array<Record<string, unknown>>
  parts?: Array<Record<string, unknown>>
  labor?: Array<Record<string, unknown>>
  attachments?: Array<Record<string, unknown>>
  downtime?: Array<Record<string, unknown>>
}

function text(value: unknown) { return String(value ?? '').trim() }
function numberOrNull(value: unknown) { const n = Number(value); return value === null || value === undefined || value === '' || Number.isNaN(n) ? null : n }
function dueDateFromSourceData(sourceData: Record<string, unknown> | null) {
  if (!sourceData) return ''
  return text(sourceData.dueDate || sourceData.due_date || sourceData.dueAt || sourceData.due_at || sourceData.due)
}

async function loadEquipmentMap(equipmentIds: string[]) {
  const ids = Array.from(new Set(equipmentIds.map(text).filter(Boolean)))
  if (ids.length === 0) return new Map<string, EquipmentRow>()
  const { data, error } = await supabase.from('equipment_master').select('equipment_id,equipment_name,model').in('equipment_id', ids)
  if (error) throw new Error(error.message || 'Không tải được thông tin thiết bị của Work Order.')
  return new Map(((data || []) as EquipmentRow[]).map((row) => [text(row.equipment_id), row] as const).filter(([equipmentId]) => Boolean(equipmentId)))
}

function mapListRow(row: WorkOrderRow, equipmentMap: Map<string, EquipmentRow>): WorkOrderListItem {
  const equipmentId = text(row.equipment_id)
  const equipment = equipmentMap.get(equipmentId)
  return {
    workOrderId: text(row.work_order_id), equipmentId, equipmentName: text(equipment?.equipment_name), equipmentModel: text(equipment?.model),
    status: text(row.status), priority: text(row.priority), reason: text(row.reason), sourceType: text(row.source_type),
    dueDate: dueDateFromSourceData(row.source_data), createdBy: text(row.created_by), createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  }
}

export async function listWorkOrders(): Promise<WorkOrderListItem[]> {
  const { data, error } = await supabase.from('maintenance_work_order')
    .select('work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data,created_at,updated_at')
    .order('created_at', { ascending: false }).limit(500)
  if (error) throw new Error(error.message || 'Không tải được danh sách Work Order.')
  const rows = (data || []) as WorkOrderRow[]
  const equipmentMap = await loadEquipmentMap(rows.map((row) => text(row.equipment_id)))
  return rows.map((row) => mapListRow(row, equipmentMap))
}

export async function getWorkOrderDetail(workOrderId: string): Promise<WorkOrderDetail> {
  const id = text(workOrderId)
  if (!id) throw new Error('Thiếu mã Work Order.')
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_detail', { p_work_order_id: id })
  if (error) throw new Error(error.message || 'Không tải được chi tiết Work Order.')
  const payload = (data || {}) as DetailPayload
  const w = payload.workOrder || {}
  const e = payload.equipment || {}
  if (!text(w.work_order_id)) throw new Error('Không tìm thấy Work Order.')

  const { data: handovers, error: handoverError } = await supabase.from('equipment_handover').select('accepted').eq('work_order_id', id).eq('accepted', true).limit(1)
  if (handoverError) throw new Error(handoverError.message || 'Không tải được trạng thái bàn giao.')
  const sourceData = (w.source_data && typeof w.source_data === 'object' ? w.source_data : {}) as Record<string, unknown>

  return {
    workOrderId: text(w.work_order_id), equipmentId: text(w.equipment_id), equipmentName: text(e.equipment_name), equipmentModel: text(e.model),
    status: text(w.status), priority: text(w.priority), reason: text(w.reason), sourceType: text(w.source_type), sourceId: text(w.source_id),
    dueDate: dueDateFromSourceData(sourceData), createdBy: text(w.created_by), sourceData, createdAt: text(w.created_at), updatedAt: text(w.updated_at),
    requestId: text(payload.request?.request_id), acceptedHandover: Array.isArray(handovers) && handovers.length > 0,
    people: (payload.people || []).map((row) => ({ personId: text(row.personId), displayName: text(row.displayName), role: text(row.role) })),
    teams: (payload.teams || []).map((row) => ({ teamId: text(row.teamId), name: text(row.name), role: text(row.role) })),
    checklist: (payload.checklist || []).map((row) => ({ checklistItemId: text(row.checklist_item_id), sequenceNo: Number(row.sequence_no || 0), title: text(row.title), description: text(row.description), responseType: text(row.response_type), required: Boolean(row.required), completed: Boolean(row.completed), responseText: text(row.response_text), responseNumber: numberOrNull(row.response_number), completedAt: text(row.completed_at) })),
    parts: (payload.parts || []).map((row) => ({ usageId: text(row.usage_id), partName: text(row.part_name), quantity: Number(row.quantity || 0), unit: text(row.unit), unitCost: numberOrNull(row.unit_cost), notes: text(row.notes), usedAt: text(row.used_at) })),
    labor: (payload.labor || []).map((row) => ({ laborId: text(row.labor_id), personId: text(row.person_id), startedAt: text(row.started_at), endedAt: text(row.ended_at), minutes: numberOrNull(row.minutes), hourlyRate: numberOrNull(row.hourly_rate), note: text(row.note) })),
    attachments: (payload.attachments || []).map((row) => ({ attachmentId: text(row.attachment_id), fileName: text(row.file_name), mimeType: text(row.mime_type), storagePath: text(row.storage_path), attachmentKind: text(row.attachment_kind), createdAt: text(row.created_at) })),
    downtime: (payload.downtime || []).map((row) => ({ downtimeId: text(row.downtime_id), startedAt: text(row.started_at), endedAt: text(row.ended_at), sourceData: (row.source_data && typeof row.source_data === 'object' ? row.source_data : {}) as Record<string, unknown> })),
  }
}
