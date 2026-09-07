import { dataGateway } from './dataGateway'

export type EquipmentA4Spare = {
  partId: string
  partName: string
  partNumber: string
  maker: string
  stockQty: number
  minQty: number
  classification: string
}

export type EquipmentA4History = {
  id: string
  date: string
  type: string
  content: string
  workOrderId: string
  actor: string
}

export type EquipmentA4Calibration = {
  calibrationDate: string
  nextDueDate: string
  result: string
  actor: string
}

export type EquipmentA4Relations = {
  spares: EquipmentA4Spare[]
  history: EquipmentA4History[]
  calibration: EquipmentA4Calibration | null
}

type Row = Record<string, unknown>
type RelationsCacheEntry = { savedAt: number; data: EquipmentA4Relations }

const RELATIONS_FRESH_MS = 60_000
const relationsCache = new Map<string, RelationsCacheEntry>()
const relationsInFlight = new Map<string, Promise<EquipmentA4Relations>>()

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function source(row: Row) {
  const value = row.source_data
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function first(...values: unknown[]) {
  for (const value of values) {
    const normalized = text(value)
    if (normalized) return normalized
  }
  return ''
}

function spareClassificationWeight(value: string) {
  return value === 'REQUIRED' ? 0 : value === 'RECOMMENDED' ? 1 : 2
}

function normalizeSpare(row: Row): EquipmentA4Spare {
  return {
    partId: text(row.part_id),
    partName: text(row.part_name),
    partNumber: text(row.part_number),
    maker: text(row.maker),
    stockQty: num(row.stock_qty),
    minQty: num(row.min_qty),
    classification: text(row.spare_classification) || 'NORMAL',
  }
}

function equipmentLinked(row: Row, equipmentId: string) {
  const links = row.equipment
  if (!Array.isArray(links)) return false
  return links.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    return text((item as Row).equipmentId) === equipmentId
  })
}

function normalizeWorkOrder(row: Row): EquipmentA4History {
  const src = source(row)
  const reason = first(row.reason, src.repairContent, src.maintenanceContent, src.detail, src.note)
  return {
    id: text(row.work_order_id),
    date: first(row.updated_at, row.created_at),
    type: 'Bảo trì',
    content: reason || `Lệnh bảo trì · ${text(row.status) || 'Không rõ trạng thái'}`,
    workOrderId: text(row.work_order_id),
    actor: first(row.created_by, src.performedBy, src.responsiblePerson),
  }
}

function normalizeDowntime(row: Row): EquipmentA4History {
  const src = source(row)
  const cause = first(src.causeCategory, src.cause, src.detail)
  const recovery = first(src.actionTaken, src.recoveryAction)
  return {
    id: text(row.downtime_id),
    date: first(row.ended_at, row.started_at, row.created_at),
    type: 'Dừng máy',
    content: [cause, recovery].filter(Boolean).join(' · ') || 'Ghi nhận dừng máy',
    workOrderId: text(row.work_order_id),
    actor: first(src.handler, src.recorder, src.reporter),
  }
}

function normalizeSpareUsage(row: Row): EquipmentA4History {
  return {
    id: text(row.usage_id),
    date: first(row.used_at, row.created_at),
    type: 'Phụ tùng',
    content: [`${text(row.part_id)} × ${num(row.quantity)}`, text(row.reason)].filter(Boolean).join(' · '),
    workOrderId: text(row.work_order_id),
    actor: first(row.performed_by, row.actor_email),
  }
}

function normalizeInspection(row: Row): EquipmentA4History | null {
  const mark = text(row.overall_mark).toUpperCase()
  const note = text(row.note)
  const abnormal = mark && !['V', 'OK', 'PASS', 'GOOD'].includes(mark)
  if (!abnormal && !note) return null
  return {
    id: text(row.inspection_id),
    date: first(row.created_at, row.inspection_date),
    type: 'Kiểm tra',
    content: [mark ? `Kết quả ${mark}` : '', note].filter(Boolean).join(' · '),
    workOrderId: '',
    actor: text(row.actor_email),
  }
}

function normalizeMovement(row: Row): EquipmentA4History {
  return {
    id: text(row.movement_id),
    date: text(row.created_at),
    type: 'Di chuyển',
    content: `${text(row.from_location) || '—'} → ${text(row.to_location) || '—'}`,
    workOrderId: '',
    actor: text(row.actor_email),
  }
}

export function invalidateEquipmentA4Relations(equipmentId: string) {
  relationsCache.delete(equipmentId.trim())
}

export async function loadEquipmentA4Relations(equipmentId: string, options: { force?: boolean } = {}): Promise<EquipmentA4Relations> {
  const id = equipmentId.trim()
  if (!id) return { spares: [], history: [], calibration: null }
  const cached = relationsCache.get(id)
  if (!options.force && cached && Date.now() - cached.savedAt <= RELATIONS_FRESH_MS) return cached.data
  const existing = relationsInFlight.get(id)
  if (existing) return existing

  const task = (async () => {
    const [sparesResult, workOrdersResult, downtimeResult, usageResult, inspectionResult, movementResult, calibrationResult] = await Promise.all([
      dataGateway.readRows('spare_part_overview', { columns: 'part_id,part_name,part_number,maker,stock_qty,min_qty,spare_classification,equipment', order: { column: 'part_id' } }),
      dataGateway.readRows('maintenance_work_order', { columns: 'work_order_id,status,reason,created_by,source_data,created_at,updated_at', eq: [{ column: 'equipment_id', value: id }], order: { column: 'created_at', ascending: false }, limit: 10 }),
      dataGateway.readRows('downtime_event', { columns: 'downtime_id,work_order_id,started_at,ended_at,source_data,created_at', eq: [{ column: 'equipment_id', value: id }], order: { column: 'started_at', ascending: false }, limit: 10 }),
      dataGateway.readRows('spare_part_usage', { columns: 'usage_id,part_id,quantity,used_at,work_order_id,reason,performed_by,actor_email,created_at', eq: [{ column: 'equipment_id', value: id }], order: { column: 'used_at', ascending: false }, limit: 10 }),
      dataGateway.readRows('daily_inspection', { columns: 'inspection_id,inspection_date,overall_mark,note,actor_email,created_at', eq: [{ column: 'equipment_id', value: id }], order: { column: 'created_at', ascending: false }, limit: 10 }),
      dataGateway.readRows('equipment_movement_log', { columns: 'movement_id,from_location,to_location,actor_email,created_at', eq: [{ column: 'equipment_id', value: id }], order: { column: 'created_at', ascending: false }, limit: 10 }),
      dataGateway.readRows('calibration_log', { columns: 'calibration_date,next_due_date,result,actor_email,created_at', eq: [{ column: 'equipment_id', value: id }], order: { column: 'calibration_date', ascending: false }, limit: 1 }),
    ])

    const firstError = [sparesResult, workOrdersResult, downtimeResult, usageResult, inspectionResult, movementResult, calibrationResult].find((result) => result.error)?.error
    if (firstError) {
      if (cached) return cached.data
      throw firstError
    }

    const spares = sparesResult.data
      .filter((row) => equipmentLinked(row, id))
      .map(normalizeSpare)
      .toSorted((a, b) => spareClassificationWeight(a.classification) - spareClassificationWeight(b.classification) || a.partId.localeCompare(b.partId))
      .slice(0, 5)

    const history = [
      ...workOrdersResult.data.map(normalizeWorkOrder),
      ...downtimeResult.data.map(normalizeDowntime),
      ...usageResult.data.map(normalizeSpareUsage),
      ...inspectionResult.data.map(normalizeInspection).filter((item): item is EquipmentA4History => Boolean(item)),
      ...movementResult.data.map(normalizeMovement),
    ]
      .filter((item) => item.date)
      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)

    const latestCalibration = calibrationResult.data[0]
    const calibration = latestCalibration ? {
      calibrationDate: text(latestCalibration.calibration_date),
      nextDueDate: text(latestCalibration.next_due_date),
      result: text(latestCalibration.result),
      actor: text(latestCalibration.actor_email),
    } : null

    const data = { spares, history, calibration }
    relationsCache.set(id, { savedAt: Date.now(), data })
    return data
  })().finally(() => { relationsInFlight.delete(id) })

  relationsInFlight.set(id, task)
  return task
}
