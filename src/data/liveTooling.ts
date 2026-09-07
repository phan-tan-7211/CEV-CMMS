import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type LiveTooling = {
  toolingId: string; toolingName: string; toolingType: string; ownership: string; managingDepartment: string; storageLocation: string; status: string; inspectionCycleDays: string
}
export type LiveToolingPlan = {
  toolingPlanId: string; toolingId: string; inspectionItem: string; acceptanceCriteria: string; frequencyType: string; frequencyValue: string; responsiblePerson: string; lastResultDate: string
}
export type LiveToolingModification = {
  modificationId: string; toolingId: string; modificationDate: string; modificationType: string; reason: string; proposedBy: string; approvedBy: string; qaConfirmedBy: string; updatedDocuments: string; status: string
}
export type LiveToolingSnapshot = { tooling: LiveTooling[]; plans: LiveToolingPlan[]; modifications: LiveToolingModification[] }

const TOOLING_CACHE_KEY = 'cev:data:tooling'
const TOOLING_CACHE_VERSION = 1
const TOOLING_CACHE_FRESH_MS = 30_000
const restoredToolingCache = readClientCache<LiveToolingSnapshot>(TOOLING_CACHE_KEY, TOOLING_CACHE_VERSION)
let toolingCache: LiveToolingSnapshot | null = restoredToolingCache?.data || null
let toolingCacheSavedAt = restoredToolingCache?.savedAt || 0

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function persistToolingCache() {
  if (!toolingCache) return
  const saved = writeClientCache(TOOLING_CACHE_KEY, TOOLING_CACHE_VERSION, toolingCache)
  toolingCacheSavedAt = saved.savedAt
}
function inputText(input: Record<string, unknown>, key: string) { return text(input[key]) }

export function getToolingCacheSnapshot(): LiveToolingSnapshot {
  return toolingCache ? {
    tooling: [...toolingCache.tooling],
    plans: [...toolingCache.plans],
    modifications: [...toolingCache.modifications],
  } : { tooling: [], plans: [], modifications: [] }
}

export async function loadLiveTooling(options: { force?: boolean } = {}) {
  if (!options.force && toolingCache && isClientCacheFresh(toolingCacheSavedAt, TOOLING_CACHE_FRESH_MS)) return toolingCache
  const [masterResult, planResult, modResult] = await Promise.all([
    dataGateway.readRows('tooling_master', { order: { column: 'tooling_id' } }),
    dataGateway.readRows('tooling_maintenance_plan', { order: { column: 'created_at', ascending: false } }),
    dataGateway.readRows('tooling_modification', { order: { column: 'created_at', ascending: false } }),
  ])
  for (const result of [masterResult, planResult, modResult]) {
    if (result.error) {
      if (toolingCache) return toolingCache
      throw result.error
    }
  }

  const tooling: LiveTooling[] = masterResult.data.map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return { toolingId: text(row.tooling_id), toolingName: text(source.toolingName), toolingType: text(row.tooling_type), ownership: text(row.ownership), managingDepartment: text(source.managingDepartment), storageLocation: text(source.storageLocation), status: text(row.status), inspectionCycleDays: text(source.inspectionCycleDays) }
  }).filter((row) => row.toolingId)

  const plans: LiveToolingPlan[] = planResult.data.map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return { toolingPlanId: text(row.tooling_plan_id), toolingId: text(row.tooling_id), inspectionItem: text(source.inspectionItem), acceptanceCriteria: text(source.acceptanceCriteria), frequencyType: text(row.frequency_type), frequencyValue: text(source.frequencyValue), responsiblePerson: text(source.responsiblePerson), lastResultDate: text(source.lastResultDate) }
  }).filter((row) => row.toolingPlanId)

  const modifications: LiveToolingModification[] = modResult.data.map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return { modificationId: text(row.modification_id), toolingId: text(row.tooling_id), modificationDate: text(source.modificationDate), modificationType: text(row.modification_type), reason: text(source.reason), proposedBy: text(source.proposedBy), approvedBy: text(source.approvedBy), qaConfirmedBy: text(source.qaConfirmedBy), updatedDocuments: text(source.updatedDocuments), status: text(row.status) }
  }).filter((row) => row.modificationId)

  toolingCache = { tooling, plans, modifications }
  persistToolingCache()
  return toolingCache
}

export async function createTooling(input: Record<string, unknown>) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_create_tooling', { p_input: input })
  if (error) throw error
  const result = data || {}
  const toolingId = text(result.toolingId) || inputText(input, 'toolingId')
  const created: LiveTooling = {
    toolingId,
    toolingName: inputText(input, 'toolingName'),
    toolingType: inputText(input, 'toolingType'),
    ownership: inputText(input, 'ownership'),
    managingDepartment: inputText(input, 'managingDepartment'),
    storageLocation: inputText(input, 'storageLocation'),
    status: inputText(input, 'status') || 'IN_PRODUCTION',
    inspectionCycleDays: inputText(input, 'inspectionCycleDays'),
  }
  if (toolingCache && toolingId) {
    toolingCache = { ...toolingCache, tooling: [...toolingCache.tooling.filter((item) => item.toolingId !== toolingId), created].toSorted((a, b) => a.toolingId.localeCompare(b.toolingId)) }
    persistToolingCache()
  }
  return { result: { toolingId } }
}

export async function createToolingPlan(input: Record<string, unknown>) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_create_tooling_plan', { p_input: input })
  if (error) throw error
  const result = data || {}
  const toolingPlanId = text(result.toolingPlanId)
  if (toolingCache && toolingPlanId) {
    const created: LiveToolingPlan = {
      toolingPlanId,
      toolingId: inputText(input, 'toolingId'),
      inspectionItem: inputText(input, 'inspectionItem'),
      acceptanceCriteria: inputText(input, 'acceptanceCriteria'),
      frequencyType: inputText(input, 'frequencyType'),
      frequencyValue: inputText(input, 'frequencyValue'),
      responsiblePerson: inputText(input, 'responsiblePerson'),
      lastResultDate: inputText(input, 'lastResultDate'),
    }
    toolingCache = { ...toolingCache, plans: [created, ...toolingCache.plans.filter((item) => item.toolingPlanId !== toolingPlanId)] }
    persistToolingCache()
  }
  return { result: { toolingPlanId } }
}

export async function createToolingModification(input: Record<string, unknown>) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_create_tooling_modification', { p_input: input })
  if (error) throw error
  const result = data || {}
  const modificationId = text(result.modificationId)
  const status = text(result.status) || 'OPEN'
  if (toolingCache && modificationId) {
    const created: LiveToolingModification = {
      modificationId,
      toolingId: inputText(input, 'toolingId'),
      modificationDate: inputText(input, 'modificationDate'),
      modificationType: inputText(input, 'modificationType'),
      reason: inputText(input, 'reason'),
      proposedBy: '',
      approvedBy: '',
      qaConfirmedBy: '',
      updatedDocuments: '',
      status,
    }
    toolingCache = { ...toolingCache, modifications: [created, ...toolingCache.modifications.filter((item) => item.modificationId !== modificationId)] }
    persistToolingCache()
  }
  return { result: { modificationId, status } }
}

export async function transitionToolingModification(modificationId: string, action: 'APPROVE' | 'QA_CONFIRM' | 'COMPLETE', updatedDocuments = '') {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_transition_tooling_modification', {
    p_modification_id: modificationId,
    p_action: action,
    p_updated_documents: updatedDocuments,
  })
  if (error) throw error
  const result = data || {}
  const resultId = text(result.modificationId) || modificationId
  const status = text(result.status)
  if (toolingCache) {
    toolingCache = {
      ...toolingCache,
      modifications: toolingCache.modifications.map((item) => item.modificationId === resultId ? {
        ...item,
        status: status || item.status,
        updatedDocuments: updatedDocuments || item.updatedDocuments,
      } : item),
    }
    persistToolingCache()
  }
  return { result: { modificationId: resultId, status } }
}
