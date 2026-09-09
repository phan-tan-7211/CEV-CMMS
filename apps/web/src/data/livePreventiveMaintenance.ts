import { dataGateway } from './dataGateway'

export type PmScheduleType = 'TIME' | 'METER' | 'EITHER'
export type PmTimeUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'

export type PreventiveMaintenanceSchedule = {
  scheduleId: string
  equipmentId: string
  equipmentName: string
  checklistTemplateId: string
  checklistTemplateName: string
  title: string
  description: string
  scheduleType: PmScheduleType
  priority: string
  active: boolean
  startAt: string
  nextDueAt: string
  timeInterval: number | null
  timeUnit: PmTimeUnit | ''
  meterId: string
  meterName: string
  meterUnit: string
  meterInterval: number | null
  nextMeterDue: number | null
  latestMeterValue: number | null
  leadTimeMinutes: number
  defaultPersonId: string
  defaultPersonName: string
  defaultTeamId: string
  defaultTeamName: string
  lastGeneratedAt: string
  lastGeneratedWorkOrderId: string
  isDue: boolean
  timeDue: boolean
  meterDue: boolean
}

export type PreventiveMaintenanceOption = { id: string; label: string; meta?: string }

export type PreventiveMaintenanceSnapshot = {
  schedules: PreventiveMaintenanceSchedule[]
  equipment: PreventiveMaintenanceOption[]
  meters: Array<PreventiveMaintenanceOption & { equipmentId: string; unit: string; latestValue: number | null }>
  checklistTemplates: PreventiveMaintenanceOption[]
  people: PreventiveMaintenanceOption[]
  teams: PreventiveMaintenanceOption[]
}

export type PreventiveMaintenanceInput = {
  scheduleId?: string
  equipmentId: string
  title: string
  description?: string
  scheduleType: PmScheduleType
  priority?: string
  active?: boolean
  startAt?: string
  nextDueAt?: string
  timeInterval?: number | null
  timeUnit?: PmTimeUnit | ''
  meterId?: string
  meterInterval?: number | null
  nextMeterDue?: number | null
  leadTimeMinutes?: number
  checklistTemplateId?: string
  defaultPersonId?: string
  defaultTeamId?: string
  sourceData?: Record<string, unknown>
}

type Row = Record<string, unknown>

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function numberOrNull(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
function bool(value: unknown) { return value === true || text(value).toUpperCase() === 'TRUE' }

export async function loadPreventiveMaintenance(): Promise<PreventiveMaintenanceSnapshot> {
  const [scheduleResult, equipmentResult, meterResult, readingResult, templateResult, personResult, teamResult, dueResult] = await Promise.all([
    dataGateway.readRows('cmms_pm_schedule', { order: { column: 'updated_at', ascending: false } }),
    dataGateway.readRows('equipment_master', { columns: 'equipment_id,equipment_name,equipment_type,status,active' }),
    dataGateway.readRows('cmms_meter', { order: { column: 'name', ascending: true } }),
    dataGateway.readRows('cmms_meter_reading', { order: { column: 'recorded_at', ascending: false }, limit: 5000 }),
    dataGateway.readRows('cmms_checklist_template', { order: { column: 'name', ascending: true } }),
    dataGateway.readRows('cmms_person', { order: { column: 'display_name', ascending: true } }),
    dataGateway.readRows('cmms_team', { order: { column: 'name', ascending: true } }),
    dataGateway.rpc<Row[]>('rpc_cmms_pm_due_list', { p_as_of: new Date().toISOString(), p_include_not_due: true }),
  ])

  for (const result of [scheduleResult, equipmentResult, meterResult, readingResult, templateResult, personResult, teamResult, dueResult]) {
    if (result.error) throw result.error
  }

  const equipmentRows = equipmentResult.data.filter((row) => bool(row.active) && text(row.status).toUpperCase() !== 'DISPOSED')
  const equipmentMap = new Map(equipmentRows.map((row) => [text(row.equipment_id), text(row.equipment_name)]))
  const templateRows = templateResult.data.filter((row) => bool(row.active) && !text(row.archived_at))
  const templateMap = new Map(templateRows.map((row) => [text(row.template_id), text(row.name)]))
  const peopleRows = personResult.data.filter((row) => bool(row.active) && !text(row.archived_at))
  const peopleMap = new Map(peopleRows.map((row) => [text(row.person_id), text(row.display_name) || text(row.email)]))
  const teamRows = teamResult.data.filter((row) => bool(row.active) && !text(row.archived_at))
  const teamMap = new Map(teamRows.map((row) => [text(row.team_id), text(row.name)]))

  const latestReadingByMeter = new Map<string, number>()
  for (const row of readingResult.data) {
    const meterId = text(row.meter_id)
    if (!meterId || latestReadingByMeter.has(meterId)) continue
    const value = numberOrNull(row.reading_value)
    if (value != null) latestReadingByMeter.set(meterId, value)
  }

  const meterRows = meterResult.data.filter((row) => bool(row.active) && !text(row.archived_at))
  const meterMap = new Map(meterRows.map((row) => [text(row.meter_id), row]))
  const dueRows = Array.isArray(dueResult.data) ? dueResult.data : []
  const dueMap = new Map(dueRows.map((row) => [text(row.schedule_id), row]))

  const schedules = scheduleResult.data
    .filter((row) => !text(row.archived_at))
    .map((row): PreventiveMaintenanceSchedule => {
      const scheduleId = text(row.schedule_id)
      const meterId = text(row.meter_id)
      const meter = meterMap.get(meterId)
      const due = dueMap.get(scheduleId)
      return {
        scheduleId,
        equipmentId: text(row.equipment_id),
        equipmentName: equipmentMap.get(text(row.equipment_id)) || text(row.equipment_id),
        checklistTemplateId: text(row.checklist_template_id),
        checklistTemplateName: templateMap.get(text(row.checklist_template_id)) || '',
        title: text(row.title),
        description: text(row.description),
        scheduleType: (text(row.schedule_type) || 'TIME') as PmScheduleType,
        priority: text(row.priority) || 'NORMAL',
        active: row.active !== false,
        startAt: text(row.start_at),
        nextDueAt: text(row.next_due_at),
        timeInterval: numberOrNull(row.time_interval),
        timeUnit: text(row.time_unit) as PmTimeUnit | '',
        meterId,
        meterName: meter ? text(meter.name) : '',
        meterUnit: meter ? text(meter.unit) : '',
        meterInterval: numberOrNull(row.meter_interval),
        nextMeterDue: numberOrNull(row.next_meter_due),
        latestMeterValue: numberOrNull(due?.latest_meter_value) ?? latestReadingByMeter.get(meterId) ?? null,
        leadTimeMinutes: numberOrNull(row.lead_time_minutes) ?? 0,
        defaultPersonId: text(row.default_person_id),
        defaultPersonName: peopleMap.get(text(row.default_person_id)) || '',
        defaultTeamId: text(row.default_team_id),
        defaultTeamName: teamMap.get(text(row.default_team_id)) || '',
        lastGeneratedAt: text(row.last_generated_at),
        lastGeneratedWorkOrderId: text(row.last_generated_work_order_id),
        isDue: bool(due?.is_due),
        timeDue: bool(due?.time_due),
        meterDue: bool(due?.meter_due),
      }
    })

  return {
    schedules,
    equipment: equipmentRows.map((row) => ({ id: text(row.equipment_id), label: text(row.equipment_name) || text(row.equipment_id), meta: text(row.equipment_id) })),
    meters: meterRows.map((row) => ({
      id: text(row.meter_id),
      label: text(row.name),
      equipmentId: text(row.equipment_id),
      unit: text(row.unit),
      latestValue: latestReadingByMeter.get(text(row.meter_id)) ?? null,
    })),
    checklistTemplates: templateRows.map((row) => ({ id: text(row.template_id), label: text(row.name) })),
    people: peopleRows.map((row) => ({ id: text(row.person_id), label: text(row.display_name) || text(row.email) })),
    teams: teamRows.map((row) => ({ id: text(row.team_id), label: text(row.name) })),
  }
}

export async function savePreventiveMaintenanceSchedule(input: PreventiveMaintenanceInput) {
  const payload: Record<string, unknown> = {
    scheduleId: input.scheduleId || undefined,
    equipmentId: input.equipmentId,
    title: input.title,
    description: input.description || '',
    scheduleType: input.scheduleType,
    priority: input.priority || 'NORMAL',
    active: input.active ?? true,
    startAt: input.startAt || new Date().toISOString(),
    leadTimeMinutes: input.leadTimeMinutes ?? 0,
    checklistTemplateId: input.checklistTemplateId || undefined,
    defaultPersonId: input.defaultPersonId || undefined,
    defaultTeamId: input.defaultTeamId || undefined,
    sourceData: input.sourceData || {},
  }
  if (input.scheduleType === 'TIME' || input.scheduleType === 'EITHER') {
    payload.nextDueAt = input.nextDueAt
    payload.timeInterval = input.timeInterval
    payload.timeUnit = input.timeUnit
  }
  if (input.scheduleType === 'METER' || input.scheduleType === 'EITHER') {
    payload.meterId = input.meterId
    payload.meterInterval = input.meterInterval
    payload.nextMeterDue = input.nextMeterDue
  }

  const { data, error } = await dataGateway.rpc<Row>('rpc_cmms_upsert_pm_schedule', { p_input: payload })
  if (error) throw error
  return data || {}
}

export async function setPreventiveMaintenanceActive(scheduleId: string, active: boolean) {
  const { data, error } = await dataGateway.rpc<Row>('rpc_cmms_set_pm_schedule_active', { p_schedule_id: scheduleId, p_active: active })
  if (error) throw error
  return data || {}
}

export async function generatePreventiveMaintenanceWorkOrder(scheduleId: string) {
  const { data, error } = await dataGateway.rpc<Row>('rpc_cmms_generate_due_pm_work_orders', { p_as_of: new Date().toISOString(), p_schedule_id: scheduleId })
  if (error) throw error
  return data || {}
}
