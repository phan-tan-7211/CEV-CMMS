import {
  readPersistentSnapshot,
  writePersistentSnapshot,
} from '../../../lib/cache/persistentSnapshot'
import {
  getEquipmentDetail as fetchEquipmentDetail,
  listEquipment as fetchEquipmentList,
  updateEquipmentStatus as saveEquipmentStatus,
  type EquipmentDetail,
  type EquipmentListItem,
} from './equipmentService'

const LIST_CACHE_KEY = 'cev:data:mobile:equipment-list:v1'
const LIST_CACHE_VERSION = 1
const LIST_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LIST_REVALIDATE_AFTER_MS = 2 * 60 * 1000

const DETAIL_CACHE_PREFIX = 'cev:data:mobile:equipment-detail:v1:'
const DETAIL_CACHE_VERSION = 1
const DETAIL_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const DETAIL_REVALIDATE_AFTER_MS = 2 * 60 * 1000

type Listener<T> = (value: T) => void

type TimedValue<T> = {
  data: T
  savedAt: number
}

let listMemory: TimedValue<EquipmentListItem[]> | null = null
let listInFlight: Promise<EquipmentListItem[]> | null = null
const listListeners = new Set<Listener<EquipmentListItem[]>>()

const detailMemory = new Map<string, TimedValue<EquipmentDetail>>()
const detailInFlight = new Map<string, Promise<EquipmentDetail>>()
const detailListeners = new Map<string, Set<Listener<EquipmentDetail>>>()

function normalizedId(value: string) {
  return value.trim()
}

function detailKey(equipmentId: string) {
  return `${DETAIL_CACHE_PREFIX}${normalizedId(equipmentId)}`
}

function notifyList(items: EquipmentListItem[]) {
  for (const listener of listListeners) listener(items)
}

function notifyDetail(equipmentId: string, item: EquipmentDetail) {
  for (const listener of detailListeners.get(equipmentId) || []) listener(item)
}

function sameList(left: EquipmentListItem[], right: EquipmentListItem[]) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (!a || !b) return false
    if (
      a.equipmentId !== b.equipmentId
      || a.updatedAt !== b.updatedAt
      || a.status !== b.status
      || a.imageUrl !== b.imageUrl
    ) return false
  }
  return true
}

function sameDetail(left: EquipmentDetail, right: EquipmentDetail) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function commitList(items: EquipmentListItem[]) {
  const savedAt = Date.now()
  const changed = !listMemory || !sameList(listMemory.data, items)
  listMemory = { data: items, savedAt }
  await writePersistentSnapshot(LIST_CACHE_KEY, LIST_CACHE_VERSION, items)
  if (changed) notifyList(items)
  return items
}

async function commitDetail(item: EquipmentDetail) {
  const equipmentId = normalizedId(item.equipmentId)
  const previous = detailMemory.get(equipmentId)
  const changed = !previous || !sameDetail(previous.data, item)
  detailMemory.set(equipmentId, { data: item, savedAt: Date.now() })
  await writePersistentSnapshot(detailKey(equipmentId), DETAIL_CACHE_VERSION, item)
  if (changed) notifyDetail(equipmentId, item)
  return item
}

export function subscribeEquipmentList(listener: Listener<EquipmentListItem[]>) {
  listListeners.add(listener)
  return () => listListeners.delete(listener)
}

export function subscribeEquipmentDetail(equipmentId: string, listener: Listener<EquipmentDetail>) {
  const id = normalizedId(equipmentId)
  const listeners = detailListeners.get(id) || new Set<Listener<EquipmentDetail>>()
  listeners.add(listener)
  detailListeners.set(id, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) detailListeners.delete(id)
  }
}

export async function getEquipmentListSnapshot() {
  if (listMemory) return listMemory.data
  const snapshot = await readPersistentSnapshot<EquipmentListItem[]>(
    LIST_CACHE_KEY,
    LIST_CACHE_VERSION,
    LIST_SNAPSHOT_MAX_AGE_MS,
  )
  if (!snapshot) return null
  listMemory = { data: snapshot.data, savedAt: snapshot.savedAt }
  return snapshot.data
}

export async function getEquipmentDetailSnapshot(equipmentId: string) {
  const id = normalizedId(equipmentId)
  if (!id) return null
  const memory = detailMemory.get(id)
  if (memory) return memory.data
  const snapshot = await readPersistentSnapshot<EquipmentDetail>(
    detailKey(id),
    DETAIL_CACHE_VERSION,
    DETAIL_SNAPSHOT_MAX_AGE_MS,
  )
  if (!snapshot) return null
  detailMemory.set(id, { data: snapshot.data, savedAt: snapshot.savedAt })
  return snapshot.data
}

export function isEquipmentListStale() {
  return !listMemory || Date.now() - listMemory.savedAt >= LIST_REVALIDATE_AFTER_MS
}

export function isEquipmentDetailStale(equipmentId: string) {
  const memory = detailMemory.get(normalizedId(equipmentId))
  return !memory || Date.now() - memory.savedAt >= DETAIL_REVALIDATE_AFTER_MS
}

export async function revalidateEquipmentList({ force = false }: { force?: boolean } = {}) {
  if (!force && listMemory && !isEquipmentListStale()) return listMemory.data
  if (listInFlight) return listInFlight

  listInFlight = fetchEquipmentList()
    .then(commitList)
    .finally(() => {
      listInFlight = null
    })
  return listInFlight
}

export async function revalidateEquipmentDetail(
  equipmentId: string,
  { force = false }: { force?: boolean } = {},
) {
  const id = normalizedId(equipmentId)
  if (!id) throw new Error('Thiếu mã thiết bị.')
  const memory = detailMemory.get(id)
  if (!force && memory && !isEquipmentDetailStale(id)) return memory.data
  const existing = detailInFlight.get(id)
  if (existing) return existing

  const request = fetchEquipmentDetail(id)
    .then(commitDetail)
    .finally(() => {
      detailInFlight.delete(id)
    })
  detailInFlight.set(id, request)
  return request
}

export async function updateEquipmentStatusCached(equipmentId: string, status: string) {
  const result = await saveEquipmentStatus(equipmentId, status)
  const id = normalizedId(result.equipmentId)

  if (listMemory) {
    const nextList = listMemory.data.map((item) => (
      item.equipmentId === id ? { ...item, status: result.status } : item
    ))
    await commitList(nextList)
  }

  const detail = detailMemory.get(id)
  if (detail) await commitDetail({ ...detail.data, status: result.status })

  return result
}

export async function rememberCreatedEquipment(equipmentId: string) {
  const id = normalizedId(equipmentId)
  if (!id) return
  try {
    const detail = await revalidateEquipmentDetail(id, { force: true })
    if (listMemory) {
      const nextList = [
        detail,
        ...listMemory.data.filter((item) => item.equipmentId !== id),
      ]
      await commitList(nextList)
    }
  } catch {
    // Registration already succeeded. Cache reconciliation can retry later.
  }
}
