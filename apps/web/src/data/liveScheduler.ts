import { dataGateway } from './dataGateway'

export type SchedulerEventType = 'WORK_ORDER' | 'PM_DUE'

export type LiveSchedulerEvent = {
  eventType: SchedulerEventType
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

export type SchedulerConflict = {
  conflictType: string
  conflictingWorkOrderId: string
  resourceId: string
  resourceName: string
  plannedStartAt: string
  plannedEndAt: string
  status: string
  title: string
}

type SchedulerRow = Record<string, unknown>

const TERMINAL_WORK_ORDER_STATUSES = new Set(['COMPLETED', 'COMPLETE', 'VERIFIED', 'RELEASED', 'CANCELLED', 'CLOSED'])

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function bool(value: unknown) {
  return value === true || ['TRUE', '1', 'YES'].includes(text(value).toUpperCase())
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeEvent(row: SchedulerRow): LiveSchedulerEvent {
  return {
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
    sourceData: object(row.source_data),
  }
}

function normalizeConflict(row: SchedulerRow): SchedulerConflict {
  return {
    conflictType: text(row.conflict_type),
    conflictingWorkOrderId: text(row.conflicting_work_order_id),
    resourceId: text(row.resource_id),
    resourceName: text(row.resource_name),
    plannedStartAt: text(row.planned_start_at),
    plannedEndAt: text(row.planned_end_at),
    status: text(row.status),
    title: text(row.title),
  }
}

function isPlanningEvent(event: LiveSchedulerEvent) {
  if (event.eventType !== 'WORK_ORDER' || !event.unscheduled) return true
  return !TERMINAL_WORK_ORDER_STATUSES.has(event.status.toUpperCase())
}

export async function loadSchedulerEvents(input: {
  startAt: string
  endAt: string
  locationId?: string
  personId?: string
  teamId?: string
  includeUnscheduled?: boolean
  limit?: number
}) {
  const { data, error } = await dataGateway.rpc<SchedulerRow[]>('rpc_cmms_scheduler_events', {
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_location_id: input.locationId || null,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
    p_include_unscheduled: input.includeUnscheduled ?? true,
    p_limit: input.limit ?? 2000,
  })
  if (error) throw error
  return (data || []).map(normalizeEvent).filter(isPlanningEvent)
}

export async function loadSchedulerConflicts(input: {
  workOrderId: string
  startAt: string
  endAt: string
  personId?: string
  teamId?: string
}) {
  const { data, error } = await dataGateway.rpc<SchedulerRow[]>('rpc_cmms_scheduler_conflicts', {
    p_work_order_id: input.workOrderId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
  })
  if (error) throw error
  return (data || []).map(normalizeConflict)
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
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_cmms_reschedule_work_order', {
    p_work_order_id: input.workOrderId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
    p_allow_conflict: input.allowConflict ?? false,
    p_note: input.note || null,
  })
  if (error) throw error
  return object(data)
}

export async function setWorkOrderScheduleLock(workOrderId: string, locked: boolean) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_cmms_set_work_order_schedule_lock', {
    p_work_order_id: workOrderId,
    p_locked: locked,
  })
  if (error) throw error
  return object(data)
}
