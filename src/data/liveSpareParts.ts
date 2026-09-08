import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type SpareClassification = 'NORMAL' | 'RECOMMENDED' | 'REQUIRED'

export type SpareEquipmentLink = {
  equipmentId: string
  equipmentName: string
  criticality: string
}

export type LiveSparePart = {
  partId: string
  partName: string
  partNumber: string
  maker: string
  stockQty: number
  minQty: number
  location: string
  leadTimeDays: number | null
  stopsProduction: boolean
  qualitySafetyImpact: boolean
  leadTimeExceedsRecovery: boolean
  rationaleNote: string
  equipmentCount: number
  criticalEquipmentCount: number
  sharedCritical: boolean
  riskScore: number
  classification: SpareClassification
  equipment: SpareEquipmentLink[]
  updatedAt: string
}

export type SpareUsage = {
  usageId: string
  partId: string
  equipmentId: string
  quantity: number
  usedAt: string
  workOrderId: string
  reason: string
  performedBy: string
  actorEmail: string
}

export type SaveSparePartInput = {
  partId: string
  partName: string
  partNumber?: string
  maker?: string
  stockQty: number
  minQty: number
  location?: string
  leadTimeDays?: number | null
  stopsProduction: boolean
  qualitySafetyImpact: boolean
  leadTimeExceedsRecovery: boolean
  rationaleNote?: string
  equipmentIds: string[]
}

const SPARE_CACHE_KEY = 'cev:data:spare-parts'
const SPARE_CACHE_VERSION = 1
const SPARE_CACHE_FRESH_MS = 30_000
const SPARE_USAGE_CACHE_FRESH_MS = 60_000
const restoredSpareCache = readClientCache<LiveSparePart[]>(SPARE_CACHE_KEY, SPARE_CACHE_VERSION)
let spareCache: LiveSparePart[] | null = restoredSpareCache?.data || null
let spareCacheSavedAt = restoredSpareCache?.savedAt || 0
const spareUsageCache = new Map<string, { savedAt: number; data: SpareUsage[] }>()

function text(value: unknown) { return value === null || value === undefined ? '' : String(value).trim() }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function bool(value: unknown) { return value === true || text(value).toLowerCase() === 'true' }

function normalizeEquipment(value: unknown): SpareEquipmentLink[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = (item || {}) as Record<string, unknown>
    return { equipmentId: text(row.equipmentId), equipmentName: text(row.equipmentName), criticality: text(row.criticality) }
  }).filter((item) => item.equipmentId)
}

function normalizePart(row: Record<string, unknown>): LiveSparePart {
  return {
    partId: text(row.part_id ?? row.partId),
    partName: text(row.part_name ?? row.partName),
    partNumber: text(row.part_number ?? row.partNumber),
    maker: text(row.maker),
    stockQty: num(row.stock_qty ?? row.stockQty),
    minQty: num(row.min_qty ?? row.minQty),
    location: text(row.location),
    leadTimeDays: row.lead_time_days === null || row.leadTimeDays === null || (row.lead_time_days === undefined && row.leadTimeDays === undefined) ? null : num(row.lead_time_days ?? row.leadTimeDays),
    stopsProduction: bool(row.stops_production ?? row.stopsProduction),
    qualitySafetyImpact: bool(row.quality_safety_impact ?? row.qualitySafetyImpact),
    leadTimeExceedsRecovery: bool(row.lead_time_exceeds_recovery ?? row.leadTimeExceedsRecovery),
    rationaleNote: text(row.rationale_note ?? row.rationaleNote),
    equipmentCount: num(row.equipment_count ?? row.equipmentCount),
    criticalEquipmentCount: num(row.critical_equipment_count ?? row.criticalEquipmentCount),
    sharedCritical: bool(row.shared_critical ?? row.sharedCritical),
    riskScore: num(row.risk_score ?? row.riskScore),
    classification: (text(row.spare_classification ?? row.classification) || 'NORMAL') as SpareClassification,
    equipment: normalizeEquipment(row.equipment),
    updatedAt: text(row.updated_at ?? row.updatedAt),
  }
}

function normalizeUsage(row: Record<string, unknown>): SpareUsage {
  return {
    usageId: text(row.usage_id),
    partId: text(row.part_id),
    equipmentId: text(row.equipment_id),
    quantity: num(row.quantity),
    usedAt: text(row.used_at),
    workOrderId: text(row.work_order_id),
    reason: text(row.reason),
    performedBy: text(row.performed_by),
    actorEmail: text(row.actor_email),
  }
}

function persistSpareCache() {
  if (!spareCache) return
  const saved = writeClientCache(SPARE_CACHE_KEY, SPARE_CACHE_VERSION, spareCache)
  spareCacheSavedAt = saved.savedAt
}

export function getSparePartsCacheSnapshot(): LiveSparePart[] {
  return spareCache ? [...spareCache] : []
}

export function getSpareUsageCacheSnapshot(partId: string): SpareUsage[] {
  const id = partId.trim()
  const cached = spareUsageCache.get(id)
  return cached && isClientCacheFresh(cached.savedAt, SPARE_USAGE_CACHE_FRESH_MS) ? [...cached.data] : []
}

function upsertSpareCache(part: LiveSparePart) {
  if (!spareCache) spareCache = []
  const index = spareCache.findIndex((item) => item.partId === part.partId)
  if (index >= 0) spareCache = spareCache.map((item, i) => i === index ? part : item)
  else spareCache = [...spareCache, part].toSorted((a, b) => a.partId.localeCompare(b.partId, 'vi', { numeric: true }))
  persistSpareCache()
}

function decrementSpareCache(partId: string, quantity: number) {
  if (!spareCache) return
  spareCache = spareCache.map((item) => item.partId === partId ? { ...item, stockQty: Math.max(0, item.stockQty - quantity), updatedAt: new Date().toISOString() } : item)
  persistSpareCache()
}

export async function loadSpareParts(options: { force?: boolean } = {}) {
  if (!options.force && spareCache && isClientCacheFresh(spareCacheSavedAt, SPARE_CACHE_FRESH_MS)) return spareCache
  const { data, error } = await dataGateway.readRows('spare_part_overview', { order: { column: 'part_id' } })
  if (error) {
    if (spareCache) return spareCache
    throw error
  }
  spareCache = data.map(normalizePart)
  persistSpareCache()
  return spareCache
}

export async function saveSparePart(input: SaveSparePartInput) {
  const payload = { ...input, leadTimeDays: input.leadTimeDays ?? null }
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_save_spare_part', { p_input: payload })
  if (error) throw error
  const saved = normalizePart(data || {})
  upsertSpareCache(saved)
  return saved
}

export async function loadSpareUsage(partId: string, options: { force?: boolean } = {}) {
  const id = partId.trim()
  if (!id) return []
  const cached = spareUsageCache.get(id)
  if (!options.force && cached && isClientCacheFresh(cached.savedAt, SPARE_USAGE_CACHE_FRESH_MS)) return cached.data
  const { data, error } = await dataGateway.readRows('spare_part_usage', {
    eq: [{ column: 'part_id', value: id }],
    order: { column: 'used_at', ascending: false },
    limit: 50,
  })
  if (error) {
    if (cached) return cached.data
    throw error
  }
  const normalized = data.map(normalizeUsage)
  spareUsageCache.set(id, { savedAt: Date.now(), data: normalized })
  return normalized
}

export async function loadWorkOrderSpareUsage(workOrderId: string) {
  const { data, error } = await dataGateway.readRows('spare_part_usage', {
    eq: [{ column: 'work_order_id', value: workOrderId }],
    order: { column: 'used_at', ascending: false },
    limit: 50,
  })
  if (error) throw error
  return data.map(normalizeUsage)
}

export async function recordSpareUsage(input: { partId: string; equipmentId: string; quantity: number; reason?: string; performedBy?: string; workOrderId?: string }) {
  const { data, error } = await dataGateway.rpc('rpc_record_spare_usage', { p_input: input })
  if (error) throw error
  decrementSpareCache(input.partId, Math.max(0, Number(input.quantity) || 0))
  spareUsageCache.delete(input.partId.trim())
  return data
}
