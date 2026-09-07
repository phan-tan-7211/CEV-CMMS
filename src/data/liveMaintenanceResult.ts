import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type MaintenanceResultItem = {
  resultItemId: string
  itemName: string
  resultMark: string
  repairContent: string
  maintenanceContent: string
  inspector: string
  sequence: number
}

export type MaintenanceExecutionResult = {
  executionId: string
  workOrderId: string
  equipmentId: string
  executionDate: string
  periodicFrequency: string
  inspectionDepartment: string
  recordedBy: string
  createdAt: string
  items: MaintenanceResultItem[]
}

export type MaintenanceResultInput = {
  workOrderId: string
  executionDate: string
  periodicFrequency: string
  inspectionDepartment: string
  items: Array<{
    itemName: string
    resultMark: '○' | '△' | '×'
    repairContent: string
    maintenanceContent: string
    inspector: string
  }>
}

const CACHE_KEY = 'cev:data:maintenance-results'
const CACHE_VERSION = 1
const CACHE_FRESH_MS = 60_000
const restored = readClientCache<MaintenanceExecutionResult[]>(CACHE_KEY, CACHE_VERSION)
let resultCache: MaintenanceExecutionResult[] | null = restored?.data || null
let resultCacheSavedAt = restored?.savedAt || 0
let resultRefreshPromise: Promise<MaintenanceExecutionResult[]> | null = null

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }

function persistResultCache() {
  if (!resultCache) return
  const saved = writeClientCache(CACHE_KEY, CACHE_VERSION, resultCache)
  resultCacheSavedAt = saved.savedAt
}

export function getMaintenanceResultCacheSnapshot() {
  return resultCache ? [...resultCache] : []
}

async function fetchMaintenanceResultsFromServer() {
  if (resultRefreshPromise) return resultRefreshPromise
  resultRefreshPromise = (async () => {
    const [executionResult, itemResult] = await Promise.all([
      dataGateway.readRows('maintenance_execution', { columns: '*', order: { column: 'created_at', ascending: false } }),
      dataGateway.readRows('maintenance_result_item', { columns: '*' }),
    ])
    if (executionResult.error) throw executionResult.error
    if (itemResult.error) throw itemResult.error

    const itemsByExecution = new Map<string, MaintenanceResultItem[]>()
    for (const row of itemResult.data) {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const executionId = text(row.execution_id)
      const item: MaintenanceResultItem = {
        resultItemId: text(row.result_item_id),
        itemName: text(source.itemName),
        resultMark: text(source.resultMark),
        repairContent: text(source.repairContent),
        maintenanceContent: text(source.maintenanceContent),
        inspector: text(source.inspector),
        sequence: number(source.sequence),
      }
      itemsByExecution.set(executionId, [...(itemsByExecution.get(executionId) || []), item])
    }

    resultCache = executionResult.data.map((row): MaintenanceExecutionResult => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const executionId = text(row.execution_id)
      return {
        executionId,
        workOrderId: text(row.work_order_id),
        equipmentId: text(row.equipment_id),
        executionDate: text(source.executionDate),
        periodicFrequency: text(source.periodicFrequency),
        inspectionDepartment: text(source.inspectionDepartment),
        recordedBy: text(source.recordedBy),
        createdAt: text(row.created_at),
        items: (itemsByExecution.get(executionId) || []).toSorted((a, b) => a.sequence - b.sequence),
      }
    })
    persistResultCache()
    return resultCache
  })().finally(() => { resultRefreshPromise = null })
  return resultRefreshPromise
}

export async function loadMaintenanceExecutionResults(options: { force?: boolean } = {}) {
  if (!options.force && resultCache && isClientCacheFresh(resultCacheSavedAt, CACHE_FRESH_MS)) return resultCache
  try {
    return await fetchMaintenanceResultsFromServer()
  } catch (cause) {
    if (resultCache) return resultCache
    throw cause
  }
}

export async function recordMaintenanceResult(input: MaintenanceResultInput) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_record_maintenance_result', { p_input: input })
  if (error) throw error
  const result = data || {}
  const normalized = {
    executionId: text(result.executionId),
    workOrderId: text(result.workOrderId),
    equipmentId: text(result.equipmentId),
    itemCount: number(result.itemCount),
    abnormalCount: number(result.abnormalCount),
  }

  if (resultCache) {
    const optimistic: MaintenanceExecutionResult = {
      executionId: normalized.executionId,
      workOrderId: normalized.workOrderId,
      equipmentId: normalized.equipmentId,
      executionDate: input.executionDate,
      periodicFrequency: input.periodicFrequency,
      inspectionDepartment: input.inspectionDepartment,
      recordedBy: '',
      createdAt: new Date().toISOString(),
      items: input.items.map((item, index) => ({ resultItemId: '', itemName: item.itemName, resultMark: item.resultMark, repairContent: item.repairContent, maintenanceContent: item.maintenanceContent, inspector: item.inspector, sequence: index + 1 })),
    }
    resultCache = [optimistic, ...resultCache.filter((row) => row.executionId !== optimistic.executionId)]
    persistResultCache()
  }
  void loadMaintenanceExecutionResults({ force: true }).catch(() => undefined)
  return normalized
}
