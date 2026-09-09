import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../lib/supabase/client'
import { createMaintenanceWorkOrder } from './workOrderMutationService'

const STORAGE_KEY_PREFIX = 'cev.cmms.work-order-drafts.v1'
const DISCARD_KEY_PREFIX = 'cev.cmms.work-order-draft-discards.v1'

export type DraftSelection = {
  id: string
  title: string
  subtitle?: string
  meta?: string
}

export type WorkOrderCreateDraftPayload = {
  equipmentId: string
  reason: string
  priority: string
  person?: DraftSelection | null
  team?: DraftSelection | null
  checklistTemplateId?: string
  customFieldValues?: Array<{ fieldId: string; value: unknown }>
}

export type WorkOrderDraftSyncState = 'LOCAL' | 'SYNCED' | 'QUEUED' | 'ERROR'

export type LocalWorkOrderDraft = {
  localId: string
  serverDraftId?: string
  clientMutationId: string
  payload: WorkOrderCreateDraftPayload
  submitOnReconnect: boolean
  syncState: WorkOrderDraftSyncState
  lastError?: string
  updatedAt: string
}

type DeferredDiscard = { serverDraftId: string; queuedAt: string }

function text(value: unknown) { return String(value ?? '').trim() }

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id || 'signed-out'
}

async function storageKey() {
  return `${STORAGE_KEY_PREFIX}:${await currentUserId()}`
}

async function discardKey() {
  return `${DISCARD_KEY_PREFIX}:${await currentUserId()}`
}

export function isLikelyNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /network|failed to fetch|fetch failed|load failed|connection|internet|offline|timeout|timed out/i.test(message)
}

async function readLocalDrafts(): Promise<LocalWorkOrderDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeLocalDrafts(rows: LocalWorkOrderDraft[]) {
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(rows))
}

async function readDeferredDiscards(): Promise<DeferredDiscard[]> {
  try {
    const raw = await AsyncStorage.getItem(await discardKey())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeDeferredDiscards(rows: DeferredDiscard[]) {
  await AsyncStorage.setItem(await discardKey(), JSON.stringify(rows))
}

async function replaceLocalDraft(next: LocalWorkOrderDraft) {
  const rows = await readLocalDrafts()
  const index = rows.findIndex((row) => row.localId === next.localId)
  if (index >= 0) rows[index] = next
  else rows.unshift(next)
  await writeLocalDrafts(rows)
  return next
}

async function patchLocalDraft(localId: string, patch: Partial<LocalWorkOrderDraft>) {
  const rows = await readLocalDrafts()
  const index = rows.findIndex((row) => row.localId === localId)
  if (index < 0) return null
  rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() }
  await writeLocalDrafts(rows)
  return rows[index]
}

export async function listLocalWorkOrderDrafts() {
  const rows = await readLocalDrafts()
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getLocalWorkOrderDraft(localId: string) {
  const rows = await readLocalDrafts()
  return rows.find((row) => row.localId === localId.trim()) || null
}

export async function getLatestCreateDraftForEquipment(equipmentId: string) {
  const target = equipmentId.trim()
  const rows = await listLocalWorkOrderDrafts()
  return rows.find((row) => row.payload.equipmentId === target && !row.submitOnReconnect) || null
}

export async function removeLocalWorkOrderDraft(localId: string) {
  const rows = await readLocalDrafts()
  await writeLocalDrafts(rows.filter((row) => row.localId !== localId))
}

async function saveServerDraft(draft: LocalWorkOrderDraft) {
  const { data, error } = await supabase.rpc('rpc_cmms_save_work_order_draft', {
    p_input: {
      draftId: draft.serverDraftId || null,
      draftMode: 'CREATE',
      title: draft.payload.reason.trim() || `Work Order · ${draft.payload.equipmentId}`,
      payload: draft.payload,
      clientMutationId: draft.clientMutationId,
    },
  })
  if (error) throw new Error(error.message || 'Không thể đồng bộ bản nháp Work Order.')
  const row = (data || {}) as Record<string, unknown>
  return text(row.draftId)
}

async function discardServerDraft(serverDraftId?: string) {
  if (!serverDraftId) return
  const { error } = await supabase.rpc('rpc_cmms_discard_work_order_draft', { p_draft_id: serverDraftId })
  if (error) throw new Error(error.message || 'Không thể xóa bản nháp trên máy chủ.')
}

async function queueDeferredDiscard(serverDraftId: string) {
  const rows = await readDeferredDiscards()
  if (rows.some((row) => row.serverDraftId === serverDraftId)) return
  rows.push({ serverDraftId, queuedAt: new Date().toISOString() })
  await writeDeferredDiscards(rows)
}

export async function flushDeferredWorkOrderDraftDiscards() {
  const rows = await readDeferredDiscards()
  if (!rows.length) return 0
  const pending: DeferredDiscard[] = []
  let discarded = 0
  for (const row of rows) {
    try {
      await discardServerDraft(row.serverDraftId)
      discarded += 1
    } catch (error) {
      pending.push(row)
      if (isLikelyNetworkError(error)) {
        pending.push(...rows.slice(discarded + pending.length))
        break
      }
    }
  }
  await writeDeferredDiscards(pending)
  return discarded
}

export async function deleteWorkOrderDraft(localId: string) {
  const draft = await getLocalWorkOrderDraft(localId)
  if (!draft) return { serverDiscardQueued: false }

  await removeLocalWorkOrderDraft(localId)
  if (!draft.serverDraftId) return { serverDiscardQueued: false }

  try {
    await discardServerDraft(draft.serverDraftId)
    return { serverDiscardQueued: false }
  } catch {
    await queueDeferredDiscard(draft.serverDraftId)
    return { serverDiscardQueued: true }
  }
}

export async function saveWorkOrderCreateDraft(input: {
  localId?: string
  payload: WorkOrderCreateDraftPayload
  submitOnReconnect?: boolean
}) {
  const rows = await readLocalDrafts()
  const existing = input.localId ? rows.find((row) => row.localId === input.localId) : undefined
  const now = new Date().toISOString()
  let draft: LocalWorkOrderDraft = {
    localId: existing?.localId || makeId('LOCAL-WO-DRAFT'),
    serverDraftId: existing?.serverDraftId,
    clientMutationId: existing?.clientMutationId || makeId('MOBILE-WO-CREATE'),
    payload: input.payload,
    submitOnReconnect: Boolean(input.submitOnReconnect),
    syncState: input.submitOnReconnect ? 'QUEUED' : 'LOCAL',
    updatedAt: now,
  }

  await replaceLocalDraft(draft)

  try {
    const serverDraftId = await saveServerDraft(draft)
    draft = {
      ...draft,
      serverDraftId: serverDraftId || draft.serverDraftId,
      syncState: draft.submitOnReconnect ? 'QUEUED' : 'SYNCED',
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }
    await replaceLocalDraft(draft)
  } catch (error) {
    draft = {
      ...draft,
      syncState: draft.submitOnReconnect ? 'QUEUED' : 'LOCAL',
      lastError: error instanceof Error ? error.message : 'Chưa thể đồng bộ bản nháp.',
      updatedAt: new Date().toISOString(),
    }
    await replaceLocalDraft(draft)
  }

  return draft
}

async function applyCreateExtras(draft: LocalWorkOrderDraft, workOrderId: string) {
  const payload = draft.payload
  if (!payload.checklistTemplateId && !(payload.customFieldValues?.length)) return
  const { error } = await supabase.rpc('rpc_cmms_apply_work_order_create_extras', {
    p_work_order_id: workOrderId,
    p_client_mutation_id: draft.clientMutationId,
    p_checklist_template_id: payload.checklistTemplateId || null,
    p_custom_values: payload.customFieldValues || [],
  })
  if (error) throw new Error(error.message || 'Không thể áp dụng checklist/custom fields cho Work Order.')
}

export async function submitWorkOrderDraft(draft: LocalWorkOrderDraft) {
  const payload = draft.payload
  try {
    const result = await createMaintenanceWorkOrder({
      equipmentId: payload.equipmentId,
      reason: payload.reason,
      priority: payload.priority,
      personIds: payload.person ? [payload.person.id] : [],
      teamIds: payload.team ? [payload.team.id] : [],
      operationId: draft.clientMutationId,
    })
    await applyCreateExtras(draft, result.workOrderId)
    try { await discardServerDraft(draft.serverDraftId) } catch { /* creation succeeded; local queue must still clear */ }
    await removeLocalWorkOrderDraft(draft.localId)
    return result
  } catch (error) {
    await patchLocalDraft(draft.localId, {
      syncState: isLikelyNetworkError(error) ? 'QUEUED' : 'ERROR',
      lastError: error instanceof Error ? error.message : 'Không thể gửi bản nháp Work Order.',
    })
    throw error
  }
}

let syncPromise: Promise<Array<{ localId: string; workOrderId: string }>> | null = null

export async function syncQueuedWorkOrderDrafts() {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    const completed: Array<{ localId: string; workOrderId: string }> = []
    const drafts = await listLocalWorkOrderDrafts()
    for (const draft of drafts) {
      if (!draft.submitOnReconnect || draft.syncState === 'ERROR') continue
      try {
        let current = draft
        if (!current.serverDraftId) {
          try {
            const serverDraftId = await saveServerDraft(current)
            current = { ...current, serverDraftId: serverDraftId || undefined }
            await replaceLocalDraft(current)
          } catch (error) {
            if (isLikelyNetworkError(error)) break
          }
        }
        const result = await submitWorkOrderDraft(current)
        completed.push({ localId: current.localId, workOrderId: result.workOrderId })
      } catch (error) {
        if (isLikelyNetworkError(error)) break
      }
    }
    return completed
  })().finally(() => { syncPromise = null })
  return syncPromise
}