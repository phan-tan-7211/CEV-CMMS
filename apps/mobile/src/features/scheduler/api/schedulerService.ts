import { supabase } from '../../../lib/supabase/client'

function rows(data: unknown): Array<Record<string, unknown>> {
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : []
}
function text(value: unknown) { return String(value ?? '').trim() }
function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export type SchedulerViewMode = 'MONTH' | 'WEEK' | 'DAY'
export type SchedulerRole = 'MAINTENANCE' | 'SUPERVISOR' | 'QUALITY' | 'MANAGER' | 'ADMIN' | 'UNKNOWN'

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

export type SchedulerConflict = {
  conflictType: 'EQUIPMENT' | 'PERSON' | 'TEAM'
  conflictingWorkOrderId: string
  resourceName: string
  plannedStartAt: string
  plannedEndAt: string
  title: string
}

export async function getSchedulerRole(): Promise<SchedulerRole> {
  const { data, error } = await supabase.rpc('current_app_role')
  if (error) throw new Error(error.message || 'Không xác định được quyền lịch trình.')
  const value = text(data).toUpperCase()
  return ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(value)
    ? value as SchedulerRole
    : 'UNKNOWN'
}

export async function listSchedulerOptions() {
  const [locationResult, peopleResult, teamResult] = await Promise.all([
    supabase.from('cmms_location').select('location_id,name,active,archived_at').eq('active', true).is('archived_at', null).order('name'),
    supabase.from('cmms_person').select('person_id,display_name,email,active,archived_at').eq('active', true).is('archived_at', null).order('display_name'),
    supabase.from('cmms_team').select('team_id,name,active,archived_at').eq('active', true).is('archived_at', null).order('name'),
  ])
  const error = locationResult.error || peopleResult.error || teamResult.error
  if (error) throw new Error(error.message || 'Không tải được bộ lọc lịch trình.')
  return {
    locations: rows(locationResult.data).map((row) => ({ id: text(row.location_id), label: text(row.name) || text(row.location_id) })).filter((row) => row.id),
    people: rows(peopleResult.data).map((row) => ({ id: text(row.person_id), label: text(row.display_name) || text(row.email) || text(row.person_id) })).filter((row) => row.id),
    teams: rows(teamResult.data).map((row) => ({ id: text(row.team_id), label: text(row.name) || text(row.team_id) })).filter((row) => row.id),
  } satisfies { locations: SchedulerOption[]; people: SchedulerOption[]; teams: SchedulerOption[] }
}

export async function listSchedulerEvents(input: {
  startAt: string
  endAt: string
  locationId?: string
  personId?: string
  teamId?: string
}): Promise<SchedulerEvent[]> {
  const { data, error } = await supabase.rpc('rpc_cmms_scheduler_events', {
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_location_id: input.locationId || null,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
    p_include_unscheduled: true,
    p_limit: 3000,
  })
  if (error) throw new Error(error.message || 'Không tải được lịch công việc.')
  return rows(data).map((row) => ({
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
    scheduleLocked: Boolean(row.schedule_locked),
    primaryPersonId: text(row.primary_person_id),
    primaryPersonName: text(row.primary_person_name),
    primaryTeamId: text(row.primary_team_id),
    primaryTeamName: text(row.primary_team_name),
    unscheduled: Boolean(row.unscheduled),
    sourceData: objectValue(row.source_data),
  }))
}

export async function listSchedulerConflicts(input: {
  workOrderId: string
  startAt: string
  endAt: string
  personId?: string
  teamId?: string
}): Promise<SchedulerConflict[]> {
  const { data, error } = await supabase.rpc('rpc_cmms_scheduler_conflicts', {
    p_work_order_id: input.workOrderId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
  })
  if (error) throw new Error(error.message || 'Không kiểm tra được xung đột lịch.')
  return rows(data).map((row) => ({
    conflictType: text(row.conflict_type) as SchedulerConflict['conflictType'],
    conflictingWorkOrderId: text(row.conflicting_work_order_id),
    resourceName: text(row.resource_name),
    plannedStartAt: text(row.planned_start_at),
    plannedEndAt: text(row.planned_end_at),
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
  const { data, error } = await supabase.rpc('rpc_cmms_reschedule_work_order', {
    p_work_order_id: input.workOrderId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_person_id: input.personId || null,
    p_team_id: input.teamId || null,
    p_allow_conflict: input.allowConflict ?? false,
    p_note: input.note?.trim() || null,
  })
  if (error) throw new Error(error.message || 'Không cập nhật được lịch Work Order.')
  return data
}

export async function setWorkOrderScheduleLock(workOrderId: string, locked: boolean) {
  const { data, error } = await supabase.rpc('rpc_cmms_set_work_order_schedule_lock', {
    p_work_order_id: workOrderId,
    p_locked: locked,
  })
  if (error) throw new Error(error.message || 'Không thay đổi được khóa lịch.')
  return Boolean(data)
}
