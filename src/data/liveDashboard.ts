import { supabase } from './supabaseClient'
import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { getCalibrationDueStatus } from '../domain/calibration'

export type LiveDashboardSummary = {
  equipmentTotal: number
  productionCount: number
  measurementCount: number
  runningCount: number
  downCount: number
  calibrationTotal: number
  calibrationOverdue: number
  workOrderOpen: number
  workOrderWaitingApproval: number
  workOrderInProgress: number
  workOrderCompleted: number
  workOrderVerified: number
  workOrderOverdue: number
  workOrderDueSoon: number
  workOrderAssigned: number
  workOrderUnassigned: number
  criticalOpen: number
  pmOverdue: number
  downtimeOpen: number
  downtimeMinutes: number
}

export type DashboardActionKind = 'DOWN' | 'CRITICAL_WO' | 'CALIBRATION_OVERDUE' | 'PM_OVERDUE' | 'DOWNTIME_OPEN'

export type LiveDashboardAction = {
  kind: DashboardActionKind
  severity: 'CRITICAL' | 'WARNING'
  equipmentId: string
  equipmentName: string
  sourceId: string
  title: string
  detail: string
  date: string
}

export type LiveDashboardData = {
  summary: LiveDashboardSummary
  actions: LiveDashboardAction[]
}

const DASHBOARD_CACHE_KEY = 'cev:data:dashboard'
const DASHBOARD_CACHE_VERSION = 2
const DASHBOARD_CACHE_FRESH_MS = 30_000
const DAY_MS = 24 * 60 * 60 * 1000
const restoredDashboardCache = readClientCache<LiveDashboardData>(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_VERSION)
let dashboardCache: LiveDashboardData | null = restoredDashboardCache?.data || null
let dashboardCacheSavedAt = restoredDashboardCache?.savedAt || 0

function text(value: unknown) { return value == null ? '' : String(value).trim() }

function sourceValue(row: Record<string, unknown>, key: string) {
  const source = row.source_data as Record<string, unknown> | null
  return text(source?.[key])
}

function actionRank(action: LiveDashboardAction) {
  const rank: Record<DashboardActionKind, number> = {
    DOWN: 0,
    CRITICAL_WO: 1,
    DOWNTIME_OPEN: 2,
    CALIBRATION_OVERDUE: 3,
    PM_OVERDUE: 4,
  }
  return rank[action.kind]
}

function persistDashboardCache(data: LiveDashboardData) {
  dashboardCache = data
  const saved = writeClientCache(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_VERSION, data)
  dashboardCacheSavedAt = saved.savedAt
}

export function getDashboardCacheSnapshot(): LiveDashboardData | null {
  return dashboardCache ? { summary: { ...dashboardCache.summary }, actions: [...dashboardCache.actions] } : null
}

export async function loadLiveDashboard(asOfDate = new Date().toISOString().slice(0, 10), options: { force?: boolean } = {}): Promise<LiveDashboardData> {
  if (!options.force && dashboardCache && isClientCacheFresh(dashboardCacheSavedAt, DASHBOARD_CACHE_FRESH_MS)) return dashboardCache

  const [equipmentResult, calibrationResult, planResult, woResult, downtimeResult] = await Promise.all([
    supabase.from('equipment_master').select('equipment_id,equipment_name,equipment_type,status,active').eq('active', true),
    supabase.from('calibration_master').select('calibration_id,equipment_id,next_due_date,status'),
    supabase.from('maintenance_plan').select('plan_id,equipment_id,source_data,active'),
    supabase.from('maintenance_work_order').select('work_order_id,equipment_id,status,priority,reason,created_at,planned_end_at,assigned_person_code'),
    supabase.from('downtime_event').select('downtime_id,equipment_id,started_at,ended_at'),
  ])
  const failed = [equipmentResult, calibrationResult, planResult, woResult, downtimeResult].find((result) => result.error)
  if (failed?.error) {
    if (dashboardCache) return dashboardCache
    throw failed.error
  }

  const equipment = (equipmentResult.data || []) as Array<Record<string, unknown>>
  const calibration = (calibrationResult.data || []) as Array<Record<string, unknown>>
  const plans = (planResult.data || []) as Array<Record<string, unknown>>
  const workOrders = (woResult.data || []) as Array<Record<string, unknown>>
  const downtime = (downtimeResult.data || []) as Array<Record<string, unknown>>
  const openStatuses = new Set(['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'])
  const equipmentNames = new Map(equipment.map((row) => [text(row.equipment_id), text(row.equipment_name)]))
  const now = Date.now()
  const openWorkOrders = workOrders.filter((row) => openStatuses.has(text(row.status)))

  let downtimeMinutes = 0
  for (const row of downtime) {
    const start = row.started_at ? new Date(String(row.started_at)).getTime() : 0
    const end = row.ended_at ? new Date(String(row.ended_at)).getTime() : Date.now()
    if (start && end >= start) downtimeMinutes += Math.round((end - start) / 60000)
  }

  const summary: LiveDashboardSummary = {
    equipmentTotal: equipment.length,
    productionCount: equipment.filter((row) => text(row.equipment_type) === 'PRODUCTION').length,
    measurementCount: equipment.filter((row) => text(row.equipment_type) === 'MEASUREMENT').length,
    runningCount: equipment.filter((row) => text(row.status) === 'RUNNING').length,
    downCount: equipment.filter((row) => text(row.status) === 'DOWN').length,
    calibrationTotal: calibration.length,
    calibrationOverdue: calibration.filter((row) => getCalibrationDueStatus(text(row.next_due_date), asOfDate) === 'OVERDUE').length,
    workOrderOpen: openWorkOrders.length,
    workOrderWaitingApproval: openWorkOrders.filter((row) => text(row.status) === 'WAITING_APPROVAL').length,
    workOrderInProgress: openWorkOrders.filter((row) => text(row.status) === 'IN_PROGRESS').length,
    workOrderCompleted: openWorkOrders.filter((row) => text(row.status) === 'COMPLETED').length,
    workOrderVerified: openWorkOrders.filter((row) => text(row.status) === 'VERIFIED').length,
    workOrderOverdue: openWorkOrders.filter((row) => {
      const due = Date.parse(text(row.planned_end_at))
      return Number.isFinite(due) && due < now
    }).length,
    workOrderDueSoon: openWorkOrders.filter((row) => {
      const due = Date.parse(text(row.planned_end_at))
      return Number.isFinite(due) && due >= now && due - now <= DAY_MS
    }).length,
    workOrderAssigned: openWorkOrders.filter((row) => Boolean(text(row.assigned_person_code))).length,
    workOrderUnassigned: openWorkOrders.filter((row) => !text(row.assigned_person_code)).length,
    criticalOpen: openWorkOrders.filter((row) => text(row.priority) === 'CRITICAL').length,
    pmOverdue: plans.filter((row) => sourceValue(row, 'status') === 'OVERDUE').length,
    downtimeOpen: downtime.filter((row) => !row.ended_at).length,
    downtimeMinutes,
  }

  const actions: LiveDashboardAction[] = []

  equipment.filter((row) => text(row.status) === 'DOWN').forEach((row) => {
    const equipmentId = text(row.equipment_id)
    actions.push({
      kind: 'DOWN', severity: 'CRITICAL', equipmentId, equipmentName: text(row.equipment_name), sourceId: equipmentId,
      title: 'Thiết bị đang DOWN', detail: 'Trạng thái Equipment Master đang là DOWN. Cần xác nhận nguyên nhân và Work Order liên quan.', date: '',
    })
  })

  openWorkOrders.filter((row) => text(row.priority) === 'CRITICAL').forEach((row) => {
    const equipmentId = text(row.equipment_id)
    actions.push({
      kind: 'CRITICAL_WO', severity: 'CRITICAL', equipmentId, equipmentName: equipmentNames.get(equipmentId) || '', sourceId: text(row.work_order_id),
      title: 'Work Order CRITICAL', detail: text(row.reason) || `Trạng thái ${text(row.status)}`, date: text(row.created_at),
    })
  })

  downtime.filter((row) => !row.ended_at).forEach((row) => {
    const equipmentId = text(row.equipment_id)
    actions.push({
      kind: 'DOWNTIME_OPEN', severity: 'CRITICAL', equipmentId, equipmentName: equipmentNames.get(equipmentId) || '', sourceId: text(row.downtime_id),
      title: 'Downtime chưa kết thúc', detail: 'Sự kiện downtime chưa có thời điểm ended_at.', date: text(row.started_at),
    })
  })

  calibration.filter((row) => getCalibrationDueStatus(text(row.next_due_date), asOfDate) === 'OVERDUE').forEach((row) => {
    const equipmentId = text(row.equipment_id)
    actions.push({
      kind: 'CALIBRATION_OVERDUE', severity: 'WARNING', equipmentId, equipmentName: equipmentNames.get(equipmentId) || '', sourceId: text(row.calibration_id),
      title: 'Hiệu chuẩn quá hạn', detail: `Hạn hiệu chuẩn: ${text(row.next_due_date) || 'chưa xác định'}`, date: text(row.next_due_date),
    })
  })

  plans.filter((row) => sourceValue(row, 'status') === 'OVERDUE').forEach((row) => {
    const equipmentId = text(row.equipment_id)
    actions.push({
      kind: 'PM_OVERDUE', severity: 'WARNING', equipmentId, equipmentName: equipmentNames.get(equipmentId) || '', sourceId: text(row.plan_id),
      title: 'PM quá hạn', detail: sourceValue(row, 'maintenanceType') || 'Kế hoạch bảo trì định kỳ quá hạn', date: sourceValue(row, 'plannedDate'),
    })
  })

  actions.sort((a, b) => actionRank(a) - actionRank(b) || a.equipmentId.localeCompare(b.equipmentId))
  const result = { summary, actions }
  persistDashboardCache(result)
  return result
}
