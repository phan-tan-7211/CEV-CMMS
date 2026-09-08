import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type EquipmentInventoryStatus = 'FOUND_LABEL_OK' | 'FOUND_NO_LABEL' | 'MOVED' | 'NOT_FOUND' | 'DATA_INVALID'
export type EquipmentInventorySource = 'QR' | 'MANUAL'

export type EquipmentInventoryEquipment = {
  equipmentId: string
  equipmentName: string
  area: string
  line: string
}

export type EquipmentInventorySession = {
  sessionId: string
  name: string
  status: 'OPEN' | 'CLOSED'
  startedAt: string
  closedAt: string
  createdBy: string
  updatedAt: string
}

export type EquipmentInventoryResult = {
  sessionId: string
  equipmentId: string
  status: EquipmentInventoryStatus
  labelOk: boolean | null
  actualArea: string
  actualLine: string
  note: string
  source: EquipmentInventorySource
  checkedAt: string
  checkedBy: string
}

export type EquipmentInventorySnapshot = {
  equipment: EquipmentInventoryEquipment[]
  sessions: EquipmentInventorySession[]
  results: EquipmentInventoryResult[]
}

const CACHE_KEY = 'cev:data:equipment-inventory'
const CACHE_VERSION = 2
const CACHE_FRESH_MS = 30_000
const MAX_SESSIONS = 12

const restored = readClientCache<EquipmentInventorySnapshot>(CACHE_KEY, CACHE_VERSION)
let inventoryCache: EquipmentInventorySnapshot | null = restored?.data || null
let inventoryCacheSavedAt = restored?.savedAt || 0
let inventoryRefreshPromise: Promise<EquipmentInventorySnapshot> | null = null
const targetedSyncs = new Map<string, Promise<void>>()

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function sourceObject(value: unknown) { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
function nullableBoolean(primary: unknown, fallback: unknown) {
  if (typeof primary === 'boolean') return primary
  if (typeof fallback === 'boolean') return fallback
  return null
}

function normalizeBounded(snapshot: EquipmentInventorySnapshot): EquipmentInventorySnapshot {
  const sessions = snapshot.sessions
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, MAX_SESSIONS)
  const allowedSessions = new Set(sessions.map((item) => item.sessionId))
  return {
    equipment: snapshot.equipment.toSorted((a, b) => a.equipmentId.localeCompare(b.equipmentId)),
    sessions,
    results: snapshot.results.filter((item) => allowedSessions.has(item.sessionId)),
  }
}

function persistInventoryCache() {
  if (!inventoryCache) return
  inventoryCache = normalizeBounded(inventoryCache)
  const saved = writeClientCache(CACHE_KEY, CACHE_VERSION, inventoryCache)
  inventoryCacheSavedAt = saved.savedAt
}

function cloneSnapshot(snapshot: EquipmentInventorySnapshot | null): EquipmentInventorySnapshot | null {
  if (!snapshot) return null
  return {
    equipment: snapshot.equipment.map((item) => ({ ...item })),
    sessions: snapshot.sessions.map((item) => ({ ...item })),
    results: snapshot.results.map((item) => ({ ...item })),
  }
}

export function getEquipmentInventoryCacheSnapshot(): EquipmentInventorySnapshot | null {
  return cloneSnapshot(inventoryCache)
}

function normalizeSession(row: Record<string, unknown>): EquipmentInventorySession {
  return {
    sessionId: text(row.session_id || row.sessionId),
    name: text(row.name),
    status: (text(row.status).toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN'),
    startedAt: text(row.started_at || row.startedAt),
    closedAt: text(row.closed_at || row.closedAt),
    createdBy: text(row.created_by || row.createdBy),
    updatedAt: text(row.updated_at || row.updatedAt),
  }
}

function normalizeResult(row: Record<string, unknown>): EquipmentInventoryResult {
  return {
    sessionId: text(row.session_id || row.sessionId),
    equipmentId: text(row.equipment_id || row.equipmentId).toUpperCase(),
    status: text(row.status).toUpperCase() as EquipmentInventoryStatus,
    labelOk: nullableBoolean(row.label_ok, row.labelOk),
    actualArea: text(row.actual_area || row.actualArea),
    actualLine: text(row.actual_line || row.actualLine),
    note: text(row.note),
    source: (text(row.source).toUpperCase() === 'QR' ? 'QR' : 'MANUAL'),
    checkedAt: text(row.checked_at || row.checkedAt),
    checkedBy: text(row.checked_by || row.checkedBy),
  }
}

function patchSession(session: EquipmentInventorySession) {
  if (!inventoryCache) return
  inventoryCache = {
    ...inventoryCache,
    sessions: [session, ...inventoryCache.sessions.filter((item) => item.sessionId !== session.sessionId)],
  }
  persistInventoryCache()
}

function patchResult(result: EquipmentInventoryResult) {
  if (!inventoryCache) return
  inventoryCache = {
    ...inventoryCache,
    results: [result, ...inventoryCache.results.filter((item) => !(item.sessionId === result.sessionId && item.equipmentId === result.equipmentId))],
  }
  persistInventoryCache()
}

function queueTargetedSync(key: string, run: () => Promise<void>) {
  const existing = targetedSyncs.get(key)
  if (existing) return existing
  const task = run().catch(() => undefined).finally(() => targetedSyncs.delete(key))
  targetedSyncs.set(key, task)
  return task
}

function syncSession(sessionId: string) {
  return queueTargetedSync(`session:${sessionId}`, async () => {
    const { data, error } = await dataGateway.readOne('equipment_inventory_session', {
      columns: '*',
      eq: [{ column: 'session_id', value: sessionId }],
    })
    if (error) throw error
    if (data) patchSession(normalizeSession(data))
  })
}

function syncResult(sessionId: string, equipmentId: string) {
  return queueTargetedSync(`result:${sessionId}:${equipmentId}`, async () => {
    const { data, error } = await dataGateway.readOne('equipment_inventory_result', {
      columns: '*',
      eq: [{ column: 'session_id', value: sessionId }, { column: 'equipment_id', value: equipmentId }],
    })
    if (error) throw error
    if (data) patchResult(normalizeResult(data))
  })
}

async function fetchInventoryFromServer(): Promise<EquipmentInventorySnapshot> {
  if (inventoryRefreshPromise) return inventoryRefreshPromise

  inventoryRefreshPromise = (async () => {
    const [equipmentResult, sessionResult] = await Promise.all([
      dataGateway.readRows('equipment_master', {
        columns: 'equipment_id,equipment_name,status,active,source_data',
        eq: [{ column: 'active', value: true }],
        neq: [{ column: 'status', value: 'DISPOSED' }],
        order: { column: 'equipment_id' },
      }),
      dataGateway.readRows('equipment_inventory_session', {
        columns: '*',
        order: { column: 'started_at', ascending: false },
        limit: MAX_SESSIONS,
      }),
    ])
    if (equipmentResult.error) throw equipmentResult.error
    if (sessionResult.error) throw sessionResult.error

    const sessions = sessionResult.data.map(normalizeSession)
    const sessionIds = sessions.map((item) => item.sessionId)
    let resultRows: Array<Record<string, unknown>> = []
    if (sessionIds.length) {
      const result = await dataGateway.readRows('equipment_inventory_result', {
        columns: '*',
        in: [{ column: 'session_id', values: sessionIds }],
        order: { column: 'checked_at', ascending: false },
      })
      if (result.error) throw result.error
      resultRows = result.data
    }

    const equipment: EquipmentInventoryEquipment[] = equipmentResult.data.map((row) => {
      const source = sourceObject(row.source_data)
      return {
        equipmentId: text(row.equipment_id).toUpperCase(),
        equipmentName: text(row.equipment_name) || text(row.equipment_id),
        area: text(source.currentArea),
        line: text(source.currentLine),
      }
    }).filter((item) => item.equipmentId)

    inventoryCache = normalizeBounded({ equipment, sessions, results: resultRows.map(normalizeResult) })
    persistInventoryCache()
    return cloneSnapshot(inventoryCache)!
  })().finally(() => { inventoryRefreshPromise = null })

  return inventoryRefreshPromise
}

export async function loadEquipmentInventory(options: { force?: boolean } = {}) {
  if (!options.force && inventoryCache && isClientCacheFresh(inventoryCacheSavedAt, CACHE_FRESH_MS)) return cloneSnapshot(inventoryCache)!
  try {
    return await fetchInventoryFromServer()
  } catch (cause) {
    if (inventoryCache) return cloneSnapshot(inventoryCache)!
    throw cause
  }
}

export function warmEquipmentInventory() {
  return loadEquipmentInventory().then(() => undefined).catch(() => undefined)
}

function makeSessionId() {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  return `INV-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function createEquipmentInventorySession(name: string) {
  const sessionId = makeSessionId()
  const previous = cloneSnapshot(inventoryCache)
  const optimistic: EquipmentInventorySession = {
    sessionId,
    name: name.trim(),
    status: 'OPEN',
    startedAt: new Date().toISOString(),
    closedAt: '',
    createdBy: '',
    updatedAt: new Date().toISOString(),
  }
  patchSession(optimistic)

  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_create_equipment_inventory_session', { p_session_id: sessionId, p_name: name.trim() })
  if (error) {
    inventoryCache = previous
    persistInventoryCache()
    throw error
  }
  const normalized = normalizeSession(data || {})
  patchSession(normalized)
  void syncSession(normalized.sessionId)
  return normalized
}

export async function recordEquipmentInventory(input: {
  sessionId: string
  equipmentId: string
  status: EquipmentInventoryStatus
  labelOk?: boolean | null
  actualArea?: string
  actualLine?: string
  note?: string
  source: EquipmentInventorySource
}) {
  const sessionId = input.sessionId.trim().toUpperCase()
  const equipmentId = input.equipmentId.trim().toUpperCase()
  const previous = cloneSnapshot(inventoryCache)
  const labelOk = input.status === 'FOUND_LABEL_OK' ? true : input.status === 'FOUND_NO_LABEL' ? false : input.status === 'MOVED' ? (input.labelOk ?? null) : null
  const optimistic: EquipmentInventoryResult = {
    sessionId,
    equipmentId,
    status: input.status,
    labelOk,
    actualArea: input.status === 'MOVED' ? (input.actualArea || '').trim() : '',
    actualLine: input.status === 'MOVED' ? (input.actualLine || '').trim() : '',
    note: (input.note || '').trim(),
    source: input.source,
    checkedAt: new Date().toISOString(),
    checkedBy: '',
  }
  patchResult(optimistic)

  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_record_equipment_inventory', {
    p_session_id: sessionId,
    p_equipment_id: equipmentId,
    p_status: input.status,
    p_actual_area: input.actualArea || '',
    p_actual_line: input.actualLine || '',
    p_note: input.note || '',
    p_source: input.source,
    p_label_ok: input.labelOk ?? null,
  })
  if (error) {
    inventoryCache = previous
    persistInventoryCache()
    throw error
  }
  const normalized = normalizeResult(data || {})
  patchResult(normalized)
  void syncResult(sessionId, equipmentId)
  return normalized
}

export async function closeEquipmentInventorySession(sessionId: string) {
  const normalizedId = sessionId.trim().toUpperCase()
  const previous = cloneSnapshot(inventoryCache)
  const existing = inventoryCache?.sessions.find((item) => item.sessionId === normalizedId)
  if (existing) patchSession({ ...existing, status: 'CLOSED', closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_close_equipment_inventory_session', { p_session_id: normalizedId })
  if (error) {
    inventoryCache = previous
    persistInventoryCache()
    throw error
  }
  const normalized = normalizeSession(data || {})
  patchSession(normalized)
  void syncSession(normalizedId)
  return normalized
}
