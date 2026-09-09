import { dataGateway } from './dataGateway'

export type AnalyticsBucket = 'DAY' | 'WEEK' | 'MONTH'
export type AnalyticsMetric = 'DOWNTIME' | 'WORK_ORDER' | 'COST' | 'OEE'

export type AnalyticsFilters = {
  startAt: string
  endAt: string
  bucket: AnalyticsBucket
  timezone?: string
  locationId?: string
  equipmentId?: string
  metric?: AnalyticsMetric
}

export type AnalyticsDashboard = {
  workOrders: { total: number; backlog: number; completed: number; completionRate: number | null }
  preventiveMaintenance: { generated: number; completed: number; complianceRate: number | null }
  reliability: { downtimeEvents: number; openDowntimeEvents: number; downtimeMinutes: number; mttrHours: number | null; mtbfHours: number | null }
  sla: { total: number; breached: number; met: number; breachRate: number | null }
  cost: { parts: number; labor: number; total: number }
  inventory: { lowStockParts: number; stockoutParts: number; criticalRiskParts: number; inventoryValue: number }
}

export type AnalyticsTrend = {
  bucketStartAt: string
  bucketEndAt: string
  workOrdersCreated: number
  workOrdersCompleted: number
  downtimeEvents: number
  downtimeMinutes: number
  maintenanceCost: number
  availabilityPercent: number | null
  performancePercent: number | null
  qualityPercent: number | null
  oeePercent: number | null
}

export type AnalyticsDrilldown = {
  itemType: AnalyticsMetric
  itemId: string
  occurredAt: string
  equipmentId: string
  equipmentName: string
  locationId: string
  locationName: string
  status: string
  title: string
  valueNumeric: number | null
  secondaryNumeric: number | null
  detail: Record<string, unknown>
}

export type AnalyticsFilterOption = { id: string; label: string }

const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const nullableNumber = (value: unknown) => value == null || value === '' ? null : numberValue(value)
const text = (value: unknown) => value == null ? '' : String(value).trim()
const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

function dashboardValue(data: unknown): AnalyticsDashboard {
  const root = objectValue(data)
  const workOrders = objectValue(root.workOrders)
  const pm = objectValue(root.preventiveMaintenance)
  const reliability = objectValue(root.reliability)
  const sla = objectValue(root.sla)
  const cost = objectValue(root.cost)
  const inventory = objectValue(root.inventory)
  return {
    workOrders: { total: numberValue(workOrders.total), backlog: numberValue(workOrders.backlog), completed: numberValue(workOrders.completed), completionRate: nullableNumber(workOrders.completionRate) },
    preventiveMaintenance: { generated: numberValue(pm.generated), completed: numberValue(pm.completed), complianceRate: nullableNumber(pm.complianceRate) },
    reliability: { downtimeEvents: numberValue(reliability.downtimeEvents), openDowntimeEvents: numberValue(reliability.openDowntimeEvents), downtimeMinutes: numberValue(reliability.downtimeMinutes), mttrHours: nullableNumber(reliability.mttrHours), mtbfHours: nullableNumber(reliability.mtbfHours) },
    sla: { total: numberValue(sla.total), breached: numberValue(sla.breached), met: numberValue(sla.met), breachRate: nullableNumber(sla.breachRate) },
    cost: { parts: numberValue(cost.parts), labor: numberValue(cost.labor), total: numberValue(cost.total) },
    inventory: { lowStockParts: numberValue(inventory.lowStockParts), stockoutParts: numberValue(inventory.stockoutParts), criticalRiskParts: numberValue(inventory.criticalRiskParts), inventoryValue: numberValue(inventory.inventoryValue) },
  }
}

export async function loadAnalyticsFilterOptions() {
  const [equipmentResult, locationResult] = await Promise.all([
    dataGateway.readRows('equipment_master', { columns: 'equipment_id,equipment_name,active,archived_at', order: { column: 'equipment_name', ascending: true } }),
    dataGateway.readRows('cmms_location', { columns: 'location_id,name,active,archived_at', order: { column: 'name', ascending: true } }),
  ])
  if (equipmentResult.error) throw equipmentResult.error
  if (locationResult.error) throw locationResult.error
  const equipment: AnalyticsFilterOption[] = equipmentResult.data
    .filter((row) => row.active !== false && !row.archived_at)
    .map((row) => ({ id: text(row.equipment_id), label: `${text(row.equipment_name) || 'Thiết bị'} · ${text(row.equipment_id)}` }))
    .filter((row) => row.id)
  const locations: AnalyticsFilterOption[] = locationResult.data
    .filter((row) => row.active !== false && !row.archived_at)
    .map((row) => ({ id: text(row.location_id), label: text(row.name) || text(row.location_id) }))
    .filter((row) => row.id)
  return { equipment, locations }
}

export async function loadAnalyticsSnapshot(filters: AnalyticsFilters) {
  const params = {
    p_start_at: filters.startAt,
    p_end_at: filters.endAt,
    p_location_id: filters.locationId || null,
    p_equipment_id: filters.equipmentId || null,
  }
  const [dashboardResult, trendResult, drilldownResult] = await Promise.all([
    dataGateway.rpc('rpc_cmms_analytics_dashboard', params),
    dataGateway.rpc<Array<Record<string, unknown>>>('rpc_cmms_analytics_trends', { ...params, p_bucket: filters.bucket, p_timezone: filters.timezone || 'Asia/Ho_Chi_Minh' }),
    dataGateway.rpc<Array<Record<string, unknown>>>('rpc_cmms_analytics_drilldown', { ...params, p_metric: filters.metric || 'DOWNTIME', p_limit: 100, p_offset: 0 }),
  ])
  const failed = [dashboardResult, trendResult, drilldownResult].find((result) => result.error)
  if (failed?.error) throw failed.error

  const trends: AnalyticsTrend[] = (trendResult.data || []).map((row) => ({
    bucketStartAt: text(row.bucket_start_at),
    bucketEndAt: text(row.bucket_end_at),
    workOrdersCreated: numberValue(row.work_orders_created),
    workOrdersCompleted: numberValue(row.work_orders_completed),
    downtimeEvents: numberValue(row.downtime_events),
    downtimeMinutes: numberValue(row.downtime_minutes),
    maintenanceCost: numberValue(row.maintenance_cost),
    availabilityPercent: nullableNumber(row.availability_percent),
    performancePercent: nullableNumber(row.performance_percent),
    qualityPercent: nullableNumber(row.quality_percent),
    oeePercent: nullableNumber(row.oee_percent),
  }))

  const drilldown: AnalyticsDrilldown[] = (drilldownResult.data || []).map((row) => ({
    itemType: (text(row.item_type) || filters.metric || 'DOWNTIME') as AnalyticsMetric,
    itemId: text(row.item_id),
    occurredAt: text(row.occurred_at),
    equipmentId: text(row.equipment_id),
    equipmentName: text(row.equipment_name),
    locationId: text(row.location_id),
    locationName: text(row.location_name),
    status: text(row.status),
    title: text(row.title),
    valueNumeric: nullableNumber(row.value_numeric),
    secondaryNumeric: nullableNumber(row.secondary_numeric),
    detail: objectValue(row.detail),
  }))

  return { dashboard: dashboardValue(dashboardResult.data), trends, drilldown }
}
