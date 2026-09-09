import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  readPersistentSnapshot,
  writePersistentSnapshot,
} from '../../../lib/cache/persistentSnapshot'
import { supabase } from '../../../lib/supabase/client'
import {
  getWorkOrderDetail as fetchWorkOrderDetail,
  listWorkOrders as fetchWorkOrders,
  type WorkOrderDetail,
  type WorkOrderListItem,
} from './workOrderService'

const LIST_CACHE_KEY_PREFIX = 'cev:data:mobile:work-orders:v2'
const LIST_CACHE_VERSION = 2
const LIST_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LIST_REVALIDATE_AFTER_MS = 2 * 60 * 1000

const DETAIL_CACHE_PREFIX = 'cev:data:mobile:work-order-detail:v2:'
const DETAIL_CACHE_VERSION = 2
const DETAIL_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const BOOKMARKED_DETAIL_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const DETAIL_REVALIDATE_AFTER_MS = 2 * 60 * 1000
const BOOKMARK_KEY_PREFIX = 'cev:data:mobile:work-order-bookmarks:v1'
const BOOKMARK_LIMIT = 100

type Listener<T> = (value: T) => void
type TimedValue<T> = { data: T; savedAt: number }

let activeUserId: string | null = null
let listMemory: TimedValue<WorkOrderListItem[]> | null = null
let listInFlight: Promise<WorkOrderListItem[]> | null = null
const listListeners = new Set<Listener<WorkOrderListItem[]>>()

const detailMemory = new Map<string, TimedValue<WorkOrderDetail>>()
const detailInFlight = new Map<string, Promise<WorkOrderDetail>>()
const detailListeners = new Map<string, Set<Listener<WorkOrderDetail>>>()

function normalizeId(value: string) {
  return value.trim()
}

function clearMemoryForUserSwitch() {
  listMemory = null
  listInFlight = null
  detailMemory.clear()
  detailInFlight.clear()
}

async function ensureUserScope() {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id || 'signed-out'
  if (activeUserId !== userId) {
    activeUserId = userId
    clearMemoryForUserSwitch()
  }
  return userId
}

function listKey(userId: string) {
  return `${LIST_CACHE_KEY_PREFIX}:${userId}`
}

function detailKey(userId: string, workOrderId: string) {
  return `${DETAIL_CACHE_PREFIX}${userId}:${normalizeId(workOrderId)}`
}

function bookmarkKey(userId: string) {
  return `${BOOKMARK_KEY_PREFIX}:${userId}`
}

async function readBookmarks(userId: string) {
  try {
    const raw = await AsyncStorage.getItem(bookmarkKey(userId))
    if (!raw) return [] as string[]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [] as string[]
    return parsed
      .map((value) => normalizeId(String(value || '')))
      .filter(Boolean)
      .slice(0, BOOKMARK_LIMIT)
  } catch {
    return [] as string[]
  }
}

async function writeBookmarks(userId: string, ids: string[]) {
  const unique = Array.from(new Set(ids.map(normalizeId).filter(Boolean))).slice(0, BOOKMARK_LIMIT)
  await AsyncStorage.setItem(bookmarkKey(userId), JSON.stringify(unique))
  return unique
}

function notifyList(items: WorkOrderListItem[]) {
  for (const listener of listListeners) listener(items)
}

function notifyDetail(workOrderId: string, item: WorkOrderDetail) {
  for (const listener of detailListeners.get(workOrderId) || []) listener(item)
}

function sameList(left: WorkOrderListItem[], right: WorkOrderListItem[]) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (!a || !b) return false
    if (a.workOrderId !== b.workOrderId || a.updatedAt !== b.updatedAt || a.status !== b.status || a.priority !== b.priority) return false
  }
  return true
}

async function commitList(userId: string, items: WorkOrderListItem[]) {
  if (activeUserId !== userId) return items
  const changed = !listMemory || !sameList(listMemory.data, items)
  listMemory = { data: items, savedAt: Date.now() }
  await writePersistentSnapshot(listKey(userId), LIST_CACHE_VERSION, items)
  if (changed) notifyList(items)
  return items
}

async function commitDetail(userId: string, item: WorkOrderDetail) {
  if (activeUserId !== userId) return item
  const id = normalizeId(item.workOrderId)
  const previous = detailMemory.get(id)
  const changed = !previous || JSON.stringify(previous.data) !== JSON.stringify(item)
  detailMemory.set(id, { data: item, savedAt: Date.now() })
  await writePersistentSnapshot(detailKey(userId, id), DETAIL_CACHE_VERSION, item)
  if (changed) notifyDetail(id, item)
  return item
}

export function subscribeWorkOrderList(listener: Listener<WorkOrderListItem[]>) {
  listListeners.add(listener)
  return () => listListeners.delete(listener)
}

export function subscribeWorkOrderDetail(workOrderId: string, listener: Listener<WorkOrderDetail>) {
  const id = normalizeId(workOrderId)
  const listeners = detailListeners.get(id) || new Set<Listener<WorkOrderDetail>>()
  listeners.add(listener)
  detailListeners.set(id, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) detailListeners.delete(id)
  }
}

export async function listBookmarkedWorkOrderIds() {
  const userId = await ensureUserScope()
  return readBookmarks(userId)
}

export async function isWorkOrderBookmarked(workOrderId: string) {
  const id = normalizeId(workOrderId)
  if (!id) return false
  const userId = await ensureUserScope()
  return (await readBookmarks(userId)).includes(id)
}

export async function setWorkOrderBookmarked(workOrderId: string, bookmarked: boolean) {
  const id = normalizeId(workOrderId)
  if (!id) throw new Error('Thiếu mã Work Order.')
  const userId = await ensureUserScope()
  const current = await readBookmarks(userId)
  if (bookmarked) {
    await writeBookmarks(userId, [id, ...current.filter((item) => item !== id)])
    try {
      await revalidateWorkOrderDetail(id, { force: true })
    } catch {
      // If offline, an existing snapshot stays available. Bookmark intent is still saved locally.
    }
  } else {
    await writeBookmarks(userId, current.filter((item) => item !== id))
  }
  return bookmarked
}

export async function getWorkOrderListSnapshot() {
  const userId = await ensureUserScope()
  if (listMemory) return listMemory.data
  const snapshot = await readPersistentSnapshot<WorkOrderListItem[]>(listKey(userId), LIST_CACHE_VERSION, LIST_SNAPSHOT_MAX_AGE_MS)
  if (!snapshot) return null
  listMemory = { data: snapshot.data, savedAt: snapshot.savedAt }
  return snapshot.data
}

export async function getWorkOrderDetailSnapshot(workOrderId: string) {
  const id = normalizeId(workOrderId)
  if (!id) return null
  const userId = await ensureUserScope()
  const memory = detailMemory.get(id)
  if (memory) return memory.data
  const bookmarked = (await readBookmarks(userId)).includes(id)
  const maxAge = bookmarked ? BOOKMARKED_DETAIL_SNAPSHOT_MAX_AGE_MS : DETAIL_SNAPSHOT_MAX_AGE_MS
  const snapshot = await readPersistentSnapshot<WorkOrderDetail>(detailKey(userId, id), DETAIL_CACHE_VERSION, maxAge)
  if (!snapshot) return null
  detailMemory.set(id, { data: snapshot.data, savedAt: snapshot.savedAt })
  return snapshot.data
}

export function isWorkOrderListStale() {
  return !listMemory || Date.now() - listMemory.savedAt >= LIST_REVALIDATE_AFTER_MS
}

export function isWorkOrderDetailStale(workOrderId: string) {
  const memory = detailMemory.get(normalizeId(workOrderId))
  return !memory || Date.now() - memory.savedAt >= DETAIL_REVALIDATE_AFTER_MS
}

export async function revalidateWorkOrderList({ force = false }: { force?: boolean } = {}) {
  const userId = await ensureUserScope()
  if (!force && listMemory && !isWorkOrderListStale()) return listMemory.data
  if (listInFlight) return listInFlight
  listInFlight = fetchWorkOrders()
    .then((items) => commitList(userId, items))
    .finally(() => { if (activeUserId === userId) listInFlight = null })
  return listInFlight
}

export async function revalidateWorkOrderDetail(workOrderId: string, { force = false }: { force?: boolean } = {}) {
  const id = normalizeId(workOrderId)
  if (!id) throw new Error('Thiếu mã Work Order.')
  const userId = await ensureUserScope()
  const memory = detailMemory.get(id)
  if (!force && memory && !isWorkOrderDetailStale(id)) return memory.data
  const existing = detailInFlight.get(id)
  if (existing) return existing
  const request = fetchWorkOrderDetail(id)
    .then((item) => commitDetail(userId, item))
    .finally(() => { if (activeUserId === userId) detailInFlight.delete(id) })
  detailInFlight.set(id, request)
  return request
}
