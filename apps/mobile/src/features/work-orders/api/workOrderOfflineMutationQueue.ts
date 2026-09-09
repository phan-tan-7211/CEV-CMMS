import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../lib/supabase/client'
import {
  addWorkOrderChecklistItem,
  completeWorkOrderChecklistItem,
} from './workOrderMutationService'
import {
  patchWorkOrderDetailSnapshot,
  revalidateWorkOrderDetail,
} from './workOrderRepository'
import { isLikelyNetworkError } from './workOrderOfflineService'

const STORAGE_KEY_PREFIX = 'cev.cmms.work-order-mutations.v1'
const QUEUE_LIMIT = 300

export type WorkOrderOfflineMutationState = 'PENDING' | 'ERROR'
export type WorkOrderOfflineMutationKind = 'ADD_CHECKLIST' | 'SET_CHECKLIST_COMPLETE'

type AddChecklistPayload = {
  title: string
  required: boolean
  tempChecklistItemId: string
}

type SetChecklistCompletePayload = {
  checklistItemId: string
  completed: boolean
}

export type WorkOrderOfflineMutation = {
  mutationId: string
  workOrderId: string
  kind: WorkOrderOfflineMutationKind
  payload: AddChecklistPayload | SetChecklistCompletePayload
  state: WorkOrderOfflineMutationState
  lastError?: string
  createdAt: string
  updatedAt: string
}

function text(value: unknown) { return String(value ?? '').trim() }
function makeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id || 'signed-out'
}

async function storageKey() {
  return `${STORAGE_KEY_PREFIX}:${await currentUserId()}`
}

async function readQueue(): Promise<WorkOrderOfflineMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, QUEUE_LIMIT) : []
  } catch {
    return []
  }
}

async function writeQueue(rows: WorkOrderOfflineMutation[]) {
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(rows.slice(0, QUEUE_LIMIT)))
}

async function enqueue(row: WorkOrderOfflineMutation) {
  const rows = await readQueue()
  if (row.kind === 'SET_CHECKLIST_COMPLETE') {
    const payload = row.payload as SetChecklistCompletePayload
    const filtered = rows.filter((item) => {
      if (item.kind !== 'SET_CHECKLIST_COMPLETE' || item.workOrderId !== row.workOrderId) return true
      return (item.payload as SetChecklistCompletePayload).checklistItemId !== payload.checklistItemId
    })
    await writeQueue([row, ...filtered])
    return row
  }
  await writeQueue([row, ...rows])
  return row
}

async function updateMutation(mutationId: string, patch: Partial<WorkOrderOfflineMutation>) {
  const rows = await readQueue()
  const index = rows.findIndex((row) => row.mutationId === mutationId)
  if (index < 0) return null
  rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() }
  await writeQueue(rows)
  return rows[index]
}

async function removeMutation(mutationId: string) {
  const rows = await readQueue()
  await writeQueue(rows.filter((row) => row.mutationId !== mutationId))
}

async function replayMutation(row: WorkOrderOfflineMutation) {
  if (row.kind === 'ADD_CHECKLIST') {
    const payload = row.payload as AddChecklistPayload
    await addWorkOrderChecklistItem(row.workOrderId, payload.title, payload.required)
    return
  }
  const payload = row.payload as SetChecklistCompletePayload
  await completeWorkOrderChecklistItem(payload.checklistItemId, payload.completed)
}

async function optimisticAdd(workOrderId: string, payload: AddChecklistPayload) {
  await patchWorkOrderDetailSnapshot(workOrderId, (current) => ({
    ...current,
    checklist: [
      ...current.checklist,
      {
        checklistItemId: payload.tempChecklistItemId,
        sequenceNo: current.checklist.length,
        title: payload.title,
        description: '',
        responseType: 'CHECK',
        required: payload.required,
        completed: false,
        responseText: '',
        responseNumber: null,
        completedAt: '',
      },
    ],
  }))
}

async function rollbackOptimisticAdd(workOrderId: string, tempChecklistItemId: string) {
  await patchWorkOrderDetailSnapshot(workOrderId, (current) => ({
    ...current,
    checklist: current.checklist.filter((item) => item.checklistItemId !== tempChecklistItemId),
  }))
}

async function optimisticComplete(workOrderId: string, checklistItemId: string, completed: boolean) {
  await patchWorkOrderDetailSnapshot(workOrderId, (current) => ({
    ...current,
    checklist: current.checklist.map((item) => item.checklistItemId === checklistItemId
      ? { ...item, completed, completedAt: completed ? new Date().toISOString() : '' }
      : item),
  }))
}

export async function addWorkOrderChecklistItemOffline(workOrderId: string, title: string, required = false) {
  const id = text(workOrderId)
  const cleanTitle = text(title)
  if (!id) throw new Error('Thiếu mã Work Order.')
  if (!cleanTitle) throw new Error('Tên checklist là bắt buộc.')

  const tempChecklistItemId = makeId('LOCAL-CHECK')
  const payload: AddChecklistPayload = { title: cleanTitle, required, tempChecklistItemId }
  await optimisticAdd(id, payload)

  try {
    await addWorkOrderChecklistItem(id, cleanTitle, required)
    try { await revalidateWorkOrderDetail(id, { force: true }) } catch { /* server write succeeded */ }
    return { queued: false, mutationId: '' }
  } catch (error) {
    if (!isLikelyNetworkError(error)) {
      await rollbackOptimisticAdd(id, tempChecklistItemId)
      throw error
    }
    const now = new Date().toISOString()
    const row = await enqueue({
      mutationId: makeId('WO-MUT'),
      workOrderId: id,
      kind: 'ADD_CHECKLIST',
      payload,
      state: 'PENDING',
      createdAt: now,
      updatedAt: now,
    })
    return { queued: true, mutationId: row.mutationId }
  }
}

export async function setWorkOrderChecklistCompletedOffline(workOrderId: string, checklistItemId: string, completed: boolean) {
  const id = text(workOrderId)
  const checklistId = text(checklistItemId)
  if (!id || !checklistId) throw new Error('Thiếu thông tin checklist.')
  if (checklistId.startsWith('LOCAL-CHECK-')) throw new Error('Mục checklist mới đang chờ đồng bộ. Hãy thử lại sau khi có mạng.')

  await optimisticComplete(id, checklistId, completed)
  try {
    await completeWorkOrderChecklistItem(checklistId, completed)
    try { await revalidateWorkOrderDetail(id, { force: true }) } catch { /* server write succeeded */ }
    return { queued: false, mutationId: '' }
  } catch (error) {
    if (!isLikelyNetworkError(error)) {
      await optimisticComplete(id, checklistId, !completed)
      throw error
    }
    const now = new Date().toISOString()
    const row = await enqueue({
      mutationId: makeId('WO-MUT'),
      workOrderId: id,
      kind: 'SET_CHECKLIST_COMPLETE',
      payload: { checklistItemId: checklistId, completed },
      state: 'PENDING',
      createdAt: now,
      updatedAt: now,
    })
    return { queued: true, mutationId: row.mutationId }
  }
}

let syncPromise: Promise<{ synced: number; errors: number }> | null = null

export async function syncQueuedWorkOrderMutations() {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    const rows = (await readQueue()).slice().reverse()
    let synced = 0
    let errors = 0
    const touched = new Set<string>()
    for (const row of rows) {
      if (row.state === 'ERROR') continue
      try {
        await replayMutation(row)
        await removeMutation(row.mutationId)
        touched.add(row.workOrderId)
        synced += 1
      } catch (error) {
        if (isLikelyNetworkError(error)) break
        errors += 1
        await updateMutation(row.mutationId, {
          state: 'ERROR',
          lastError: error instanceof Error ? error.message : 'Không thể đồng bộ thay đổi.',
        })
      }
    }
    for (const workOrderId of touched) {
      try { await revalidateWorkOrderDetail(workOrderId, { force: true }) } catch { /* next foreground sync will retry refresh */ }
    }
    return { synced, errors }
  })().finally(() => { syncPromise = null })
  return syncPromise
}

export async function listWorkOrderOfflineMutations(workOrderId?: string) {
  const id = text(workOrderId)
  const rows = await readQueue()
  return id ? rows.filter((row) => row.workOrderId === id) : rows
}
