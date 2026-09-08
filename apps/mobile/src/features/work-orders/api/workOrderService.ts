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

export type WorkOrderDetail = WorkOrderListItem & {
  sourceId: string
  sourceData: Record<string, unknown>
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

type EquipmentRow = {
  equipment_id: string | null
  equipment_name: string | null
  model: string | null
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function dueDateFromSourceData(sourceData: Record<string, unknown> | null) {
  if (!sourceData) return ''
  return text(sourceData.dueDate || sourceData.due_date || sourceData.dueAt || sourceData.due_at || sourceData.due)
}

async function loadEquipmentMap(equipmentIds: string[]) {
  const ids = Array.from(new Set(equipmentIds.map(text).filter(Boolean)))
  if (ids.length === 0) return new Map<string, EquipmentRow>()

  const { data, error } = await supabase
    .from('equipment_master')
    .select('equipment_id,equipment_name,model')
    .in('equipment_id', ids)

  if (error) throw new Error(error.message || 'Không tải được thông tin thiết bị của Work Order.')

  return new Map(
    ((data || []) as EquipmentRow[])
      .map((row) => [text(row.equipment_id), row] as const)
      .filter(([equipmentId]) => Boolean(equipmentId)),
  )
}

function mapRow(row: WorkOrderRow, equipmentMap: Map<string, EquipmentRow>): WorkOrderDetail {
  const equipmentId = text(row.equipment_id)
  const equipment = equipmentMap.get(equipmentId)
  return {
    workOrderId: text(row.work_order_id),
    equipmentId,
    equipmentName: text(equipment?.equipment_name),
    equipmentModel: text(equipment?.model),
    status: text(row.status),
    priority: text(row.priority),
    reason: text(row.reason),
    sourceType: text(row.source_type),
    dueDate: dueDateFromSourceData(row.source_data),
    sourceId: text(row.source_id),
    createdBy: text(row.created_by),
    sourceData: row.source_data || {},
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

export async function listWorkOrders(): Promise<WorkOrderListItem[]> {
  const { data, error } = await supabase
    .from('maintenance_work_order')
    .select('work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message || 'Không tải được danh sách Work Order.')

  const rows = (data || []) as WorkOrderRow[]
  const equipmentMap = await loadEquipmentMap(rows.map((row) => text(row.equipment_id)))
  return rows.map((row) => mapRow(row, equipmentMap))
}

export async function getWorkOrderDetail(workOrderId: string): Promise<WorkOrderDetail> {
  const id = text(workOrderId)
  if (!id) throw new Error('Thiếu mã Work Order.')

  const { data, error } = await supabase
    .from('maintenance_work_order')
    .select('work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data,created_at,updated_at')
    .eq('work_order_id', id)
    .single()

  if (error) throw new Error(error.message || 'Không tải được chi tiết Work Order.')

  const row = data as WorkOrderRow
  const equipmentMap = await loadEquipmentMap([text(row.equipment_id)])
  return mapRow(row, equipmentMap)
}
