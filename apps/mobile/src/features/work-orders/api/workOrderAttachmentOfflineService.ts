import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../lib/supabase/client'
import { isLikelyNetworkError } from './workOrderOfflineService'
import { revalidateWorkOrderDetail } from './workOrderRepository'

const STORAGE_KEY_PREFIX = 'cev.cmms.work-order-attachments.v1'
const BUCKET = 'maintenance-before-after'
const QUEUE_LIMIT = 20

export type OfflineAttachmentState = 'PENDING' | 'ERROR'
export type WorkOrderAttachmentKind = 'BEFORE' | 'AFTER' | 'FILE'

export type OfflineWorkOrderAttachment = {
  localId: string
  workOrderId: string
  fileName: string
  mimeType: string
  base64: string
  storagePath: string
  attachmentKind: WorkOrderAttachmentKind
  state: OfflineAttachmentState
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

async function storageKey() { return `${STORAGE_KEY_PREFIX}:${await currentUserId()}` }

async function readQueue(): Promise<OfflineWorkOrderAttachment[]> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, QUEUE_LIMIT) : []
  } catch {
    return []
  }
}

async function writeQueue(rows: OfflineWorkOrderAttachment[]) {
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(rows.slice(0, QUEUE_LIMIT)))
}

async function replaceRow(next: OfflineWorkOrderAttachment) {
  const rows = await readQueue()
  const index = rows.findIndex((row) => row.localId === next.localId)
  if (index >= 0) rows[index] = next
  else rows.unshift(next)
  await writeQueue(rows)
  return next
}

async function removeRow(localId: string) {
  const rows = await readQueue()
  await writeQueue(rows.filter((row) => row.localId !== localId))
}

function base64ToArrayBuffer(base64: string) {
  const binary = globalThis.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function attachmentAlreadyRecorded(row: OfflineWorkOrderAttachment) {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_detail', { p_work_order_id: row.workOrderId })
  if (error) throw new Error(error.message || 'Không kiểm tra được tệp đính kèm.')
  const payload = (data || {}) as { attachments?: Array<Record<string, unknown>> }
  return (payload.attachments || []).some((item) => text(item.storage_path) === row.storagePath)
}

async function uploadRow(row: OfflineWorkOrderAttachment) {
  if (await attachmentAlreadyRecorded(row)) return
  const bytes = base64ToArrayBuffer(row.base64)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(row.storagePath, bytes, {
    contentType: row.mimeType || 'image/jpeg',
    upsert: false,
  })
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message || '')) {
    throw new Error(uploadError.message || 'Không tải được ảnh lên máy chủ.')
  }
  if (await attachmentAlreadyRecorded(row)) return
  const { error } = await supabase.rpc('rpc_cmms_add_work_order_attachment', {
    p_work_order_id: row.workOrderId,
    p_file_name: row.fileName,
    p_storage_path: row.storagePath,
    p_storage_bucket: BUCKET,
    p_mime_type: row.mimeType || 'image/jpeg',
    p_file_size_bytes: bytes.byteLength,
    p_attachment_kind: row.attachmentKind,
  })
  if (error) throw new Error(error.message || 'Không ghi nhận được ảnh cho Work Order.')
}

export async function queueWorkOrderPhoto(input: {
  workOrderId: string
  base64: string
  fileName?: string
  mimeType?: string
  attachmentKind?: WorkOrderAttachmentKind
}) {
  const workOrderId = text(input.workOrderId)
  if (!workOrderId) throw new Error('Thiếu mã Work Order.')
  if (!input.base64) throw new Error('Ảnh không có dữ liệu để lưu ngoại tuyến.')
  const localId = makeId('LOCAL-WO-PHOTO')
  const extension = input.mimeType === 'image/png' ? 'png' : 'jpg'
  const fileName = text(input.fileName) || `${localId}.${extension}`
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-')
  const row: OfflineWorkOrderAttachment = {
    localId,
    workOrderId,
    fileName,
    mimeType: text(input.mimeType) || 'image/jpeg',
    base64: input.base64,
    storagePath: `work-orders/${workOrderId}/${localId}-${safeName}`,
    attachmentKind: input.attachmentKind || 'FILE',
    state: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await replaceRow(row)
  try {
    await uploadRow(row)
    await removeRow(localId)
    try { await revalidateWorkOrderDetail(workOrderId, { force: true }) } catch { /* attachment is already persisted */ }
    return { queued: false, localId }
  } catch (error) {
    if (!isLikelyNetworkError(error)) {
      const failed = { ...row, state: 'ERROR' as const, lastError: error instanceof Error ? error.message : 'Không thể tải ảnh.', updatedAt: new Date().toISOString() }
      await replaceRow(failed)
      throw error
    }
    return { queued: true, localId }
  }
}

let syncPromise: Promise<{ synced: number; errors: number }> | null = null

export async function syncQueuedWorkOrderAttachments() {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    const rows = (await readQueue()).slice().reverse()
    let synced = 0
    let errors = 0
    const touched = new Set<string>()
    for (const row of rows) {
      if (row.state === 'ERROR') continue
      try {
        await uploadRow(row)
        await removeRow(row.localId)
        touched.add(row.workOrderId)
        synced += 1
      } catch (error) {
        if (isLikelyNetworkError(error)) break
        errors += 1
        await replaceRow({ ...row, state: 'ERROR', lastError: error instanceof Error ? error.message : 'Không thể tải ảnh.', updatedAt: new Date().toISOString() })
      }
    }
    for (const workOrderId of touched) {
      try { await revalidateWorkOrderDetail(workOrderId, { force: true }) } catch { /* refresh later */ }
    }
    try {
      const partLabor = await import('./workOrderPartLaborOfflineService')
      const partLaborResult = await partLabor.syncQueuedWorkOrderPartLabor()
      synced += partLaborResult.synced
      errors += partLaborResult.errors
    } catch { /* next automatic cycle retries */ }
    return { synced, errors }
  })().finally(() => { syncPromise = null })
  return syncPromise
}

export async function listOfflineWorkOrderAttachments(workOrderId?: string) {
  const id = text(workOrderId)
  const rows = await readQueue()
  return id ? rows.filter((row) => row.workOrderId === id) : rows
}

export async function retryOfflineWorkOrderAttachment(localId: string) {
  const rows = await readQueue()
  const row = rows.find((item) => item.localId === localId)
  if (!row) return null
  await replaceRow({ ...row, state: 'PENDING', lastError: undefined, updatedAt: new Date().toISOString() })
  return syncQueuedWorkOrderAttachments()
}

export async function discardOfflineWorkOrderAttachment(localId: string) {
  await removeRow(localId)
}
