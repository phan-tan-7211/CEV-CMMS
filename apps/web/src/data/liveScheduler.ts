import { dataGateway } from './dataGateway'

export type SchedulerView = 'MONTH' | 'WEEK' | 'DAY'

export type SchedulerEvent = {
  eventType: 'WORK_ORDER' | 'PM_DUE'
  eventId: string
  workOrderId: string
  pmScheduleId: string
  equipmentId: string
  equipmentName: string
  locationId: string
  locationName: string
  title: string
  status: string
  priority: string
  startAt: string
  endAt: string
  scheduleLocked: boolean
  primaryPersonId: string
  primaryPersonName: string
  primaryTeamId: string
  primaryTeamName: string
  unscheduled: boolean
  sourceData: Record<string, unknown>
}

export type SchedulerOption = { id: string; label: string }
export type SchedulerFilters = {
  startAt: string
  endAt: string
  locationId?: string
  personId?: string
  teamId?: string
  includeUnscheduled?: boolean
}

export type SchedulerConflict = {
  conflictType: 'EQUIPMENT' | 'PERSON' | 'TEAM'
  conflictingWorkOrderId: string
  resourceId: string
  resourceName: string
  plannedStartAt: string
  plannedEndAt: string
  status: string
  title: string
}

const text = (value: unknown) => value == null ? '' : String(value).trim()
const bool = (value: unknown) => value === true
const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export async function loadSchedulerOptions() {
  const [locationsResult, peopleResult, teamsResult] = await Promise.all([
    dataGateway.readRows('cmms_location', { columns: 'location_id,name,active,archived_at', order: { column: 'name', ascending: true } }),
    dataGateway.readRows('cmms_person', { columns: 'person_id,display_name,email,active,archived_at', order: { column: 'display_name', ascending: true } }),
    dataGateway.readRows('cmms_team', { columns: 'team_id,name,active,archived_at', order: { column: 'name', ascending: true } }),
  ])
  const failed = [locationsResult, peopleResult, teamsResult].find((result) => result.error)
  if (failed?.error) throw failed.error
  const locations: SchedulerOption[] = locationsResult.data
    .filter((row) => row.active !== false && !row.archived_at)
    .map((row) => ({ id: text(row.location_id), label: text(row.name) || text(row.location_id) }))
    .filter((row) => row.id)
  const people: SchedulerOption[] = peopleResult.data
    .filter((row) => row.active !== false && !row.archived_at)
    .map((row) => ({ id: text(row.person_id), label: text(row.display_name) || text(row.email) || text(row.person_id) }))
    .filter((row) => row.id)
  const teams: SchedulerOption[] = teamsResult.data
    .filter((row) => row.active !== false && !row.archived_at)
    .map((row) => ({ id: text(row.team_id), label: text(row.name) || text(row.team_id) }))
    .filter((row) => row.id)
  return { locations, people, teams }
}

export async function loadSchedulerEvents(filters: SchedulerFilters): Promise<SchedulerEvent[]> {
  const result = await dataGateway.rpc<Array<Record<string, unknown>>>('rpc_cmms_scheduler_events', {
    p_start_at: filters.startAt,
    p_end_at: filters.endAt,
    p_location_id: filters.locationId || null,
    p_person_id: filters.personId || null,
    p_team_id: filters.teamId || null,
    p_include_unscheduled: filters.includeUnscheduled ?? true,
    p_limit: 3000,
  })
  if (result.error) throw result.error
  return (result.data || []).map((row) => ({
    eventType: text(row.event_type) === 'PM_DUE' ? 'PM_DUE' : 'WORK_ORDER',
    eventId: text(row.event_id),
    workOrderId: text(row.work_order_id),
    pmScheduleId: text(row.pm_schedule_id),
    equipmentId: text(row.equipment_id),
    equipmentName: text(row.equipment_name),
    locationId: text(row.location_id),
    locationName: text(row.location_name),
    title: text(row.title),
    status: text(row.status),
    priority: text(row.priority),
    startAt: text(row.start_at),
    endAt: text(row.end_at),
    scheduleLocked: bool(row.schedule_locked),
    primaryPersonId: text(row.primary_person_id),
    primaryPersonName: text(row.primary_person_name),
    primaryTeamId: text(row.primary_team_id),
    primaryTeamName: text(row.primary_team_name),
    unscheduled: bool(row.unscheduled),
    sourceData: objectValue(row.source_data),
  }))
}

export async function loadSchedulerConflicts(workOrderId: string, startAt: string, endAt: string, personId = '', teamId = ''): Promise<SchedulerConflict[]> {
  const result = await dataGateway.rpc<Array<Record<string, unknown>>>('rpc_cmms_scheduler_conflicts', {
    p_work_order_id: workOrderId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_person_id: personId || null,
    p_team_id: teamId || null,
  })
  if (result.error) throw result.error
  return (result.data || []).map((row) => ({
    conflictType: text(row.conflict_type) as SchedulerConflict['conflictType'],
    conflictingWorkOrderId: text(row.conflicting_work_order_id),
    resourceId: text(row.resource_id),
    resourceName: text(row.resource_name),
    plannedStartAt: text(row.planned_start_at),
    plannedEndAt: text(row.planned_end_at),
    status: text(row.status),
    title: text(row.title),
  }))
}

export async function rescheduleWorkOrder(input: {
  workOrderId: string
  startAt: string | null
  endAt: string | null
  personId?: string
  teamId?: string
  allowConflict?: boolean
  note?: string
}) {
  const result = await dataGateway.rpc('rpc_cmms_reschedule_work_order', {
    p_work_order_id: input.workOrderId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
    p_allow_conflict: input.allowConflict ?? false,
    p_note: input.note || null,
  })
  if (result.error) throw result.error
  return result.data
}

export async function setScheduleLock(workOrderId: string, locked: boolean) {
  const result = await dataGateway.rpc('rpc_cmms_set_work_order_schedule_lock', {
    p_work_order_id: workOrderId,
    p_locked: locked,
  })
  if (result.error) throw result.error
  return Boolean(result.data)
}
