import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type DailyInspectionMark = 'V' | 'URGENT_REPAIR' | 'MAINTENANCE_REQUIRED' | 'STOP_REPAIR'
export type DailyInspectionShift = 'MORNING' | 'AFTERNOON' | 'NIGHT'
export type WorkOrderPriority = '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type InspectionEquipmentOption = {
  equipmentId: string
  equipmentName: string
  currentArea: string
  currentLine: string
}

export type LiveInspection = {
  inspectionId: string
  equipmentId: string
  inspectionDate: string
  shift: string
  area: string
  inspectorId: string
  overallMark: string
  note: string
  damagedParts: string
  createdAt: string
}

type InspectionSnapshot = { equipment: InspectionEquipmentOption[]; inspections: LiveInspection[] }
const INSPECTION_CACHE_KEY = 'cev:data:daily-inspection'
const INSPECTION_CACHE_VERSION = 1
const INSPECTION_CACHE_FRESH_MS = 30_000
const restoredInspectionCache = readClientCache<InspectionSnapshot>(INSPECTION_CACHE_KEY, INSPECTION_CACHE_VERSION)
let inspectionCache: InspectionSnapshot | null = restoredInspectionCache?.data || null
let inspectionCacheSavedAt = restoredInspectionCache?.savedAt || 0

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function persistInspectionCache() {
  if (!inspectionCache) return
  const saved = writeClientCache(INSPECTION_CACHE_KEY, INSPECTION_CACHE_VERSION, inspectionCache)
  inspectionCacheSavedAt = saved.savedAt
}

export function getInspectionCacheSnapshot(): InspectionSnapshot {
  return inspectionCache
    ? { equipment: [...inspectionCache.equipment], inspections: [...inspectionCache.inspections] }
    : { equipment: [], inspections: [] }
}

export function normalizeInspectionEquipment(rows: Array<Record<string, unknown>>): InspectionEquipmentOption[] {
  return rows
    .filter((row) => text(row.equipment_id) && text(row.equipment_type) === 'PRODUCTION' && text(row.status) !== 'DISPOSED')
    .map((row) => ({
      equipmentId: text(row.equipment_id),
      equipmentName: text(row.equipment_name),
      currentArea: text(row.department),
      currentLine: text((row.source_data as Record<string, unknown> | null)?.currentLine),
    }))
    .toSorted((a, b) => a.equipmentId.localeCompare(b.equipmentId))
}

export function normalizeInspections(rows: Array<Record<string, unknown>>): LiveInspection[] {
  return rows
    .filter((row) => text(row.inspection_id))
    .map((row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      return {
        inspectionId: text(row.inspection_id),
        equipmentId: text(row.equipment_id),
        inspectionDate: text(row.inspection_date),
        shift: text(row.shift),
        area: text(row.area),
        inspectorId: text(row.actor_email),
        overallMark: text(row.overall_mark),
        note: text(row.note),
        damagedParts: text(source.damagedParts),
        createdAt: text(row.created_at),
      }
    })
    .toSorted((a, b) => (b.createdAt || b.inspectionDate).localeCompare(a.createdAt || a.inspectionDate))
}

export async function loadLiveInspection(options: { force?: boolean } = {}) {
  if (!options.force && inspectionCache && isClientCacheFresh(inspectionCacheSavedAt, INSPECTION_CACHE_FRESH_MS)) return inspectionCache
  const [equipmentResult, inspectionResult] = await Promise.all([
    dataGateway.readRows('equipment_master', {
      columns: 'equipment_id,equipment_type,equipment_name,department,status,source_data',
      eq: [{ column: 'active', value: true }],
    }),
    dataGateway.readRows('daily_inspection', {
      columns: '*',
      order: { column: 'created_at', ascending: false },
      limit: 100,
    }),
  ])
  if (equipmentResult.error || inspectionResult.error) {
    if (inspectionCache) return inspectionCache
    if (equipmentResult.error) throw equipmentResult.error
    throw inspectionResult.error
  }
  inspectionCache = {
    equipment: normalizeInspectionEquipment(equipmentResult.data),
    inspections: normalizeInspections(inspectionResult.data),
  }
  persistInspectionCache()
  return inspectionCache
}

export async function submitLiveInspection(request: {
  operationId: string
  equipmentId: string
  shift: DailyInspectionShift
  area: string
  overallMark: DailyInspectionMark
  note: string
  damagedParts: string
  priority: WorkOrderPriority
}) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_submit_daily_inspection', {
    p_operation_id: request.operationId,
    p_equipment_id: request.equipmentId,
    p_shift: request.shift,
    p_area: request.area,
    p_overall_mark: request.overallMark,
    p_note: request.note,
    p_damaged_parts: request.damagedParts,
    p_priority: request.priority,
  })
  if (error) throw error
  const result = data || {}
  const response = {
    result: {
      inspectionId: text(result.inspectionId),
      workOrderId: text(result.workOrderId),
      downtimeId: text(result.downtimeId),
    },
  }
  if (response.result.inspectionId) {
    const now = new Date().toISOString()
    const optimistic: LiveInspection = {
      inspectionId: response.result.inspectionId,
      equipmentId: request.equipmentId,
      inspectionDate: now.slice(0, 10),
      shift: request.shift,
      area: request.area,
      inspectorId: '',
      overallMark: request.overallMark,
      note: request.note,
      damagedParts: request.damagedParts,
      createdAt: now,
    }
    if (!inspectionCache) inspectionCache = { equipment: [], inspections: [] }
    inspectionCache = {
      ...inspectionCache,
      inspections: [optimistic, ...inspectionCache.inspections.filter((item) => item.inspectionId !== optimistic.inspectionId)].slice(0, 100),
    }
    persistInspectionCache()
  }
  return response
}
