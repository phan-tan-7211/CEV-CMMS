import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'
import type { MaintenanceWorkflowAction, MaintenanceWorkflowStatus } from '../domain/workflow'

export type MaintenanceEquipmentOption = { equipmentId: string; equipmentName: string }
export type LiveMaintenanceWorkOrder = {
  workOrderId: string
  equipmentId: string
  sourceType: string
  planClassification: string
  hasDowntime: boolean
  requestedAt: string
  requestedBy: string
  reason: string
  priority: string
  status: MaintenanceWorkflowStatus
  approvedBy: string
  approvedAt: string
  method: string
  plannedStartAt: string
  plannedEndAt: string
  assignedPersonCode: string
  assignedPersonName: string
  assignedBy: string
  assignedAt: string
}
export type LiveMaintenanceTransition = {
  auditId: string
  workOrderId: string
  action: string
  actorEmail: string
  createdAt: string
  beforeStatus: string
  afterStatus: string
}
export type LiveMaintenancePlanItem = { itemId: string; itemName: string; standard: string; method: string; note: string; sequence: number }
export type LiveMaintenancePlan = {
  planId: string; equipmentId: string; maintenanceType: string; frequency: string; plannedDate: string; responsiblePerson: string; scheduledWindow: string; note: string; status: string; active: boolean; items: LiveMaintenancePlanItem[]
}
export type LiveHandover = { handoverId: string; workOrderId: string; equipmentId: string; accepted: boolean; condition: string; handoverAt: string }
export type LiveMaintenanceSnapshot = { equipment: MaintenanceEquipmentOption[]; plans: LiveMaintenancePlan[]; workOrders: LiveMaintenanceWorkOrder[]; handovers: LiveHandover[]; transitions: LiveMaintenanceTransition[] }
export type MaintenancePlanInput = {
  planId?: string
  equipmentId: string
  maintenanceType: string
  frequency: string
  plannedDate: string
  responsiblePerson: string
  scheduledWindow: string
  note: string
  active?: boolean
  items: Array<{ itemName: string; standard: string; method: string; note?: string }>
}

const CACHE_KEY = 'cev:data:maintenance'
const CACHE_VERSION = 4
const CACHE_FRESH_MS = 30_000
const restored = readClientCache<LiveMaintenanceSnapshot>(CACHE_KEY, CACHE_VERSION)
let maintenanceCache: LiveMaintenanceSnapshot | null = restored?.data || null
let maintenanceCacheSavedAt = restored?.savedAt || 0
let maintenanceRefreshPromise: Promise<LiveMaintenanceSnapshot> | null = null

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function bool(value: unknown) { return value === true || ['TRUE', '1', 'YES'].includes(text(value).toUpperCase()) }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function detailText(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return ''
  return text((value as Record<string, unknown>)[key])
}

function persistMaintenanceCache() {
  if (!maintenanceCache) return
  const saved = writeClientCache(CACHE_KEY, CACHE_VERSION, maintenanceCache)
  maintenanceCacheSavedAt = saved.savedAt
}

export function getMaintenanceCacheSnapshot(): LiveMaintenanceSnapshot | null {
  if (!maintenanceCache) return null
  return {
    equipment: [...maintenanceCache.equipment],
    plans: [...maintenanceCache.plans],
    workOrders: [...maintenanceCache.workOrders],
    handovers: [...maintenanceCache.handovers],
    transitions: [...maintenanceCache.transitions],
  }
}

function patchWorkOrderStatus(workOrderId: string, status: MaintenanceWorkflowStatus) {
  if (!maintenanceCache) return
  maintenanceCache = {
    ...maintenanceCache,
    workOrders: maintenanceCache.workOrders.map((item) => item.workOrderId === workOrderId ? { ...item, status } : item),
  }
  persistMaintenanceCache()
}

function appendTransition(workOrderId: string, action: MaintenanceWorkflowAction, status: MaintenanceWorkflowStatus) {
  if (!maintenanceCache) return
  const before = maintenanceCache.workOrders.find((item) => item.workOrderId === workOrderId)?.status || ''
  const event: LiveMaintenanceTransition = {
    auditId: `local-${workOrderId}-${Date.now()}`,
    workOrderId,
    action,
    actorEmail: '',
    createdAt: new Date().toISOString(),
    beforeStatus: before,
    afterStatus: status,
  }
  maintenanceCache = { ...maintenanceCache, transitions: [event, ...maintenanceCache.transitions] }
  persistMaintenanceCache()
}

export function patchMaintenanceHandoverCache(handover: LiveHandover) {
  if (!maintenanceCache || !handover.handoverId) return
  maintenanceCache = {
    ...maintenanceCache,
    handovers: [handover, ...maintenanceCache.handovers.filter((item) => item.handoverId !== handover.handoverId)],
  }
  persistMaintenanceCache()
}

function insertCreatedWorkOrder(input: {
  workOrderId: string
  equipmentId: string
  sourceType: string
  reason: string
  priority: string
  status: MaintenanceWorkflowStatus
  method: string
  plannedStartAt: string
  plannedEndAt: string
}) {
  if (!maintenanceCache) return
  const created: LiveMaintenanceWorkOrder = {
    workOrderId: input.workOrderId,
    equipmentId: input.equipmentId,
    sourceType: input.sourceType,
    planClassification: '',
    hasDowntime: false,
    requestedAt: new Date().toISOString(),
    requestedBy: '',
    reason: input.reason,
    priority: input.priority,
    status: input.status,
    approvedBy: '',
    approvedAt: '',
    method: input.method,
    plannedStartAt: input.plannedStartAt,
    plannedEndAt: input.plannedEndAt,
    assignedPersonCode: '',
    assignedPersonName: '',
    assignedBy: '',
    assignedAt: '',
  }
  maintenanceCache = { ...maintenanceCache, workOrders: [created, ...maintenanceCache.workOrders.filter((item) => item.workOrderId !== created.workOrderId)] }
  persistMaintenanceCache()
}

async function fetchMaintenanceFromServer(): Promise<LiveMaintenanceSnapshot> {
  if (maintenanceRefreshPromise) return maintenanceRefreshPromise

  maintenanceRefreshPromise = (async () => {
    const [equipmentResult, planResult, planItemResult, woResult, handoverResult, transitionResult, downtimeResult] = await Promise.all([
      dataGateway.readRows('equipment_master', {
        columns: 'equipment_id,equipment_name,equipment_type,status,active',
        eq: [{ column: 'active', value: true }],
      }),
      dataGateway.readRows('maintenance_plan', { order: { column: 'created_at', ascending: false } }),
      dataGateway.readRows('maintenance_plan_item'),
      dataGateway.readRows('maintenance_work_order', { order: { column: 'created_at', ascending: false } }),
      dataGateway.readRows('equipment_handover', { order: { column: 'created_at', ascending: false } }),
      dataGateway.readRows('audit_log', {
        columns: 'audit_id,entity_id,action,actor_email,detail,created_at',
        eq: [{ column: 'entity_type', value: 'Maintenance_Work_Order' }],
        order: { column: 'created_at', ascending: false },
        limit: 1000,
      }),
      dataGateway.readRows('downtime_event', { columns: 'work_order_id' }),
    ])
    for (const result of [equipmentResult, planResult, planItemResult, woResult, handoverResult, transitionResult, downtimeResult]) if (result.error) throw result.error

    const equipment: MaintenanceEquipmentOption[] = equipmentResult.data
      .filter((row) => text(row.equipment_id) && text(row.equipment_type) === 'PRODUCTION' && text(row.status) !== 'DISPOSED')
      .map((row) => ({ equipmentId: text(row.equipment_id), equipmentName: text(row.equipment_name) }))
      .toSorted((a, b) => a.equipmentId.localeCompare(b.equipmentId))

    const itemsByPlan = new Map<string, LiveMaintenancePlanItem[]>()
    for (const row of planItemResult.data) {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const item: LiveMaintenancePlanItem = {
        itemId: text(row.item_id), itemName: text(source.itemName), standard: text(source.standard), method: text(source.method), note: text(source.note), sequence: number(source.sequence),
      }
      const planId = text(row.plan_id)
      itemsByPlan.set(planId, [...(itemsByPlan.get(planId) || []), item])
    }

    const plans: LiveMaintenancePlan[] = planResult.data.map((row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const planId = text(row.plan_id)
      return {
        planId,
        equipmentId: text(row.equipment_id),
        maintenanceType: text(source.maintenanceType),
        frequency: text(source.frequency),
        plannedDate: text(source.plannedDate),
        responsiblePerson: text(source.responsiblePerson),
        scheduledWindow: text(source.scheduledWindow),
        note: text(source.note),
        status: text(source.status) || (row.active === false ? 'INACTIVE' : 'ACTIVE'),
        active: row.active !== false,
        items: (itemsByPlan.get(planId) || []).toSorted((a, b) => a.sequence - b.sequence),
      }
    })

    const downtimeWorkOrders = new Set(downtimeResult.data.map((row) => text(row.work_order_id)).filter(Boolean))
    const workOrders: LiveMaintenanceWorkOrder[] = woResult.data.map((row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const workOrderId = text(row.work_order_id)
      return {
        workOrderId,
        equipmentId: text(row.equipment_id),
        sourceType: text(row.source_type),
        planClassification: text(source.planClassification),
        hasDowntime: downtimeWorkOrders.has(workOrderId),
        requestedAt: text(row.created_at),
        requestedBy: text(row.created_by),
        reason: text(row.reason),
        priority: text(row.priority),
        status: text(row.status) as MaintenanceWorkflowStatus,
        approvedBy: text(source.approvedBy),
        approvedAt: text(source.approvedAt),
        method: text(source.method),
        plannedStartAt: text(source.plannedStartAt),
        plannedEndAt: text(source.plannedEndAt),
        assignedPersonCode: text(source.assignedPersonCode),
        assignedPersonName: text(source.assignedPersonName),
        assignedBy: text(source.assignedBy),
        assignedAt: text(source.assignedAt),
      }
    })

    const handovers: LiveHandover[] = handoverResult.data.map((row) => ({
      handoverId: text(row.handover_id), workOrderId: text(row.work_order_id), equipmentId: text(row.equipment_id), accepted: bool(row.accepted), condition: text(row.equipment_condition), handoverAt: text(row.created_at),
    }))

    const transitions: LiveMaintenanceTransition[] = transitionResult.data.map((row) => ({
      auditId: text(row.audit_id),
      workOrderId: text(row.entity_id),
      action: text(row.action),
      actorEmail: text(row.actor_email),
      createdAt: text(row.created_at),
      beforeStatus: detailText(row.detail, 'before'),
      afterStatus: detailText(row.detail, 'after'),
    }))

    maintenanceCache = { equipment, plans, workOrders, handovers, transitions }
    persistMaintenanceCache()
    return maintenanceCache
  })().finally(() => { maintenanceRefreshPromise = null })

  return maintenanceRefreshPromise
}

export async function loadLiveMaintenance(options: { force?: boolean } = {}) {
  if (!options.force && maintenanceCache && isClientCacheFresh(maintenanceCacheSavedAt, CACHE_FRESH_MS)) return maintenanceCache
  try {
    return await fetchMaintenanceFromServer()
  } catch (cause) {
    if (maintenanceCache) return maintenanceCache
    throw cause
  }
}

export async function upsertMaintenancePlan(input: MaintenancePlanInput) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_upsert_maintenance_plan', { p_input: input })
  if (error) throw error
  const result = data || {}
  void loadLiveMaintenance({ force: true }).catch(() => undefined)
  return { planId: text(result.planId), equipmentId: text(result.equipmentId), itemCount: number(result.itemCount) }
}

export async function createManualWorkOrder(request: { operationId: string; input: { equipmentId: string; sourceType: string; sourceId: string; reason: string; priority: string; method?: string; plannedStartAt?: string; plannedEndAt?: string } }) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_create_maintenance_work_order', {
    p_operation_id: request.operationId,
    p_equipment_id: request.input.equipmentId,
    p_source_type: request.input.sourceType,
    p_source_id: request.input.sourceId,
    p_reason: request.input.reason,
    p_priority: request.input.priority,
    p_method: request.input.method || '',
    p_planned_start_at: request.input.plannedStartAt || '',
    p_planned_end_at: request.input.plannedEndAt || '',
  })
  if (error) throw error
  const result = data || {}
  const normalized = { workOrderId: text(result.workOrderId), status: text(result.status) as MaintenanceWorkflowStatus }
  insertCreatedWorkOrder({
    workOrderId: normalized.workOrderId,
    equipmentId: request.input.equipmentId,
    sourceType: request.input.sourceType,
    reason: request.input.reason,
    priority: request.input.priority,
    status: normalized.status,
    method: request.input.method || '',
    plannedStartAt: request.input.plannedStartAt || '',
    plannedEndAt: request.input.plannedEndAt || '',
  })
  void loadLiveMaintenance({ force: true }).catch(() => undefined)
  return { result: normalized }
}

export async function transitionLiveMaintenance(request: { workOrderId: string; workflowAction: MaintenanceWorkflowAction; operationId: string }) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_transition_maintenance', {
    p_work_order_id: request.workOrderId,
    p_action: request.workflowAction,
    p_operation_id: request.operationId,
  })
  if (error) throw error
  const result = data || {}
  const status = text(result.status) as MaintenanceWorkflowStatus
  appendTransition(request.workOrderId, request.workflowAction, status)
  patchWorkOrderStatus(request.workOrderId, status)
  void loadLiveMaintenance({ force: true }).catch(() => undefined)
  return { result: { status } }
}
