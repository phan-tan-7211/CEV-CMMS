import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../lib/supabase/client'
import { issuePartToWorkOrderOnline, type IssuePartInput } from './workOrderInventoryService'
import { addWorkOrderLaborOnline, type WorkOrderLaborInput } from './workOrderMutationService'
import { isLikelyNetworkError } from './workOrderOfflineService'
import { patchWorkOrderDetailSnapshot, revalidateWorkOrderDetail } from './workOrderRepository'

const STORAGE_KEY_PREFIX = 'cev.cmms.work-order-part-labor.v1'
const QUEUE_LIMIT = 200

export type PartLaborQueueState = 'PENDING' | 'ERROR'
export type PartLaborQueueKind = 'ISSUE_PART' | 'ADD_LABOR'

export type PartLaborQueueItem = {
  mutationId: string
  kind: PartLaborQueueKind
  workOrderId: string
  payload: IssuePartInput | WorkOrderLaborInput
  state: PartLaborQueueState
  lastError?: string
  createdAt: string
  updatedAt: string
}

function text(value: unknown) { return String(value ?? '').trim() }
function makeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
async function userId() { const { data } = await supabase.auth.getSession(); return data.session?.user.id || 'signed-out' }
async function key() { return `${STORAGE_KEY_PREFIX}:${await userId()}` }

async function readQueue(): Promise<PartLaborQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(await key())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, QUEUE_LIMIT) : []
  } catch { return [] }
}
async function writeQueue(rows: PartLaborQueueItem[]) { await AsyncStorage.setItem(await key(), JSON.stringify(rows.slice(0, QUEUE_LIMIT))) }
async function put(row: PartLaborQueueItem) {
  const rows = await readQueue(); const index = rows.findIndex((x) => x.mutationId === row.mutationId)
  if (index >= 0) rows[index] = row; else rows.unshift(row)
  await writeQueue(rows); return row
}
async function remove(id: string) { await writeQueue((await readQueue()).filter((x) => x.mutationId !== id)) }

async function serverDetail(workOrderId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_detail', { p_work_order_id: workOrderId })
  if (error) throw new Error(error.message || 'Không kiểm tra được Work Order.')
  return (data || {}) as { parts?: Array<Record<string, unknown>>; labor?: Array<Record<string, unknown>> }
}

async function laborExists(input: WorkOrderLaborInput) {
  const detail = await serverDetail(input.workOrderId)
  return (detail.labor || []).some((row) =>
    text(row.person_id) === input.personId &&
    text(row.started_at) === input.startedAt &&
    text(row.ended_at) === text(input.endedAt || ''),
  )
}

async function partIssueExists(input: IssuePartInput, createdAt: string) {
  const detail = await serverDetail(input.workOrderId)
  const since = new Date(createdAt).getTime() - 30_000
  return (detail.parts || []).some((row) => {
    const usedAt = new Date(text(row.used_at)).getTime()
    return text(row.inventory_part_id || row.spare_part_id) === input.partId &&
      text(row.stock_location_id) === input.stockLocationId &&
      Number(row.quantity || 0) === input.quantity &&
      Number.isFinite(usedAt) && usedAt >= since
  })
}

async function replay(row: PartLaborQueueItem) {
  if (row.kind === 'ADD_LABOR') {
    const input = row.payload as WorkOrderLaborInput
    if (await laborExists(input)) return
    await addWorkOrderLaborOnline(input)
    return
  }
  const input = row.payload as IssuePartInput
  if (await partIssueExists(input, row.createdAt)) return
  await issuePartToWorkOrderOnline(input)
}

async function optimisticLabor(input: WorkOrderLaborInput, mutationId: string) {
  const start = new Date(input.startedAt).getTime()
  const end = input.endedAt ? new Date(input.endedAt).getTime() : NaN
  const minutes = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 60_000)) : null
  await patchWorkOrderDetailSnapshot(input.workOrderId, (current) => ({
    ...current,
    labor: [{ laborId: `LOCAL-LABOR-${mutationId}`, personId: input.personId, startedAt: input.startedAt, endedAt: input.endedAt || '', minutes, hourlyRate: input.hourlyRate ?? null, note: input.note || '' }, ...current.labor],
  }))
}

async function rollbackLabor(workOrderId: string, mutationId: string) {
  await patchWorkOrderDetailSnapshot(workOrderId, (current) => ({ ...current, labor: current.labor.filter((x) => x.laborId !== `LOCAL-LABOR-${mutationId}`) }))
}

export async function addWorkOrderLaborOffline(input: WorkOrderLaborInput) {
  if (!input.personId) throw new Error('Chọn người thực hiện trước khi ghi giờ công.')
  const mutationId = makeId('WO-LABOR')
  await optimisticLabor(input, mutationId)
  try {
    await addWorkOrderLaborOnline(input)
    try { await revalidateWorkOrderDetail(input.workOrderId, { force: true }) } catch { /* persisted */ }
    return { queued: false, mutationId }
  } catch (error) {
    if (!isLikelyNetworkError(error)) { await rollbackLabor(input.workOrderId, mutationId); throw error }
    const now = new Date().toISOString()
    await put({ mutationId, kind: 'ADD_LABOR', workOrderId: input.workOrderId, payload: input, state: 'PENDING', createdAt: now, updatedAt: now })
    return { queued: true, mutationId }
  }
}

export async function issuePartToWorkOrderOffline(input: IssuePartInput) {
  if (!(input.quantity > 0)) throw new Error('Số lượng phải lớn hơn 0.')
  const mutationId = makeId('WO-PART')
  try {
    const data = await issuePartToWorkOrderOnline(input)
    try { await revalidateWorkOrderDetail(input.workOrderId, { force: true }) } catch { /* persisted */ }
    return { queued: false, mutationId, data }
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error
    const now = new Date().toISOString()
    await put({ mutationId, kind: 'ISSUE_PART', workOrderId: input.workOrderId, payload: input, state: 'PENDING', createdAt: now, updatedAt: now })
    return { queued: true, mutationId }
  }
}

let syncPromise: Promise<{ synced: number; errors: number }> | null = null
export async function syncQueuedWorkOrderPartLabor() {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    const rows = (await readQueue()).slice().reverse(); let synced = 0; let errors = 0; const touched = new Set<string>()
    for (const row of rows) {
      if (row.state === 'ERROR') continue
      try { await replay(row); await remove(row.mutationId); touched.add(row.workOrderId); synced += 1 }
      catch (error) {
        if (isLikelyNetworkError(error)) break
        errors += 1
        await put({ ...row, state: 'ERROR', lastError: error instanceof Error ? error.message : 'Không thể đồng bộ.', updatedAt: new Date().toISOString() })
      }
    }
    for (const id of touched) { try { await revalidateWorkOrderDetail(id, { force: true }) } catch { /* later */ } }
    return { synced, errors }
  })().finally(() => { syncPromise = null })
  return syncPromise
}

export async function listQueuedWorkOrderPartLabor(workOrderId?: string) {
  const id = text(workOrderId); const rows = await readQueue(); return id ? rows.filter((x) => x.workOrderId === id) : rows
}
export async function retryQueuedWorkOrderPartLabor(mutationId: string) {
  const row = (await readQueue()).find((x) => x.mutationId === mutationId); if (!row) return null
  await put({ ...row, state: 'PENDING', lastError: undefined, updatedAt: new Date().toISOString() }); return syncQueuedWorkOrderPartLabor()
}
export async function discardQueuedWorkOrderPartLabor(mutationId: string) { await remove(mutationId) }
