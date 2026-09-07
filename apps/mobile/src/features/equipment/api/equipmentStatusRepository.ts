import {
  readPersistentSnapshot,
  writePersistentSnapshot,
} from '../../../lib/cache/persistentSnapshot'
import {
  createEquipmentStatus as createStatusOnServer,
  deleteEquipmentStatusMaster as deleteStatusOnServer,
  listEquipmentStatuses as fetchStatuses,
  updateEquipmentStatusMaster as updateStatusOnServer,
  type EquipmentStatusMaster,
} from './equipmentStatusService'

const CACHE_KEY = 'cev:data:mobile:equipment-status-master:v1'
const CACHE_VERSION = 1
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const REVALIDATE_AFTER_MS = 5 * 60 * 1000

type TimedStatuses = {
  data: EquipmentStatusMaster[]
  savedAt: number
}

let memory: TimedStatuses | null = null
let inFlight: Promise<EquipmentStatusMaster[]> | null = null

async function commit(rows: EquipmentStatusMaster[]) {
  memory = { data: rows, savedAt: Date.now() }
  await writePersistentSnapshot(CACHE_KEY, CACHE_VERSION, rows)
  return rows
}

async function snapshot() {
  if (memory) return memory.data
  const stored = await readPersistentSnapshot<EquipmentStatusMaster[]>(CACHE_KEY, CACHE_VERSION, SNAPSHOT_MAX_AGE_MS)
  if (!stored) return null
  memory = { data: stored.data, savedAt: stored.savedAt }
  return stored.data
}

async function revalidate(force = false) {
  if (!force && memory && Date.now() - memory.savedAt < REVALIDATE_AFTER_MS) return memory.data
  if (inFlight) return inFlight
  inFlight = fetchStatuses()
    .then(commit)
    .finally(() => { inFlight = null })
  return inFlight
}

export async function listEquipmentStatusesCached() {
  const cached = await snapshot()
  if (cached) {
    void revalidate(false).catch(() => undefined)
    return cached
  }
  return revalidate(true)
}

export async function createEquipmentStatusCached(displayName: string, color: string) {
  await createStatusOnServer(displayName, color)
  return revalidate(true)
}

export async function updateEquipmentStatusMasterCached(statusCode: string, displayName: string, color: string) {
  await updateStatusOnServer(statusCode, displayName, color)
  return revalidate(true)
}

export async function deleteEquipmentStatusMasterCached(statusCode: string) {
  await deleteStatusOnServer(statusCode)
  return revalidate(true)
}
