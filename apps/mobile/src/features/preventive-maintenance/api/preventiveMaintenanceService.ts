import { supabase } from '../../../lib/supabase/client'

function rows(data: unknown): Array<Record<string, unknown>> {
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : []
}
function text(value: unknown) { return String(value ?? '').trim() }
function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export type PmDueItem = {
  scheduleId: string
  equipmentId: string
  title: string
  description: string
  scheduleType: 'TIME' | 'METER' | 'EITHER'
  priority: string
  active: boolean
  nextDueAt: string
  timeInterval: number | null
  timeUnit: string
  meterId: string
  meterInterval: number | null
  nextMeterDue: number | null
  leadTimeMinutes: number
  latestMeterValue: number | null
  timeDue: boolean
  meterDue: boolean
  isDue: boolean
}

export type PmScheduleInput = {
  scheduleId?: string
  equipmentId: string
  title: string
  description?: string
  scheduleType: 'TIME' | 'METER' | 'EITHER'
  priority?: string
  active?: boolean
  startAt?: string
  nextDueAt?: string
  timeInterval?: number | null
  timeUnit?: 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS' | null
  meterId?: string | null
  meterInterval?: number | null
  nextMeterDue?: number | null
  leadTimeMinutes?: number
  checklistTemplateId?: string | null
  defaultPersonId?: string | null
  defaultTeamId?: string | null
}

export type MeterItem = {
  meterId: string
  equipmentId: string
  name: string
  meterType: string
  unit: string
  rolloverValue: number | null
  latestValue: number | null
  latestRecordedAt: string
}

export async function listPmSchedules(includeNotDue = true): Promise<PmDueItem[]> {
  const [{ data: schedules, error: scheduleError }, { data: dueRows, error: dueError }] = await Promise.all([
    supabase
      .from('cmms_pm_schedule')
      .select('schedule_id,equipment_id,title,description,schedule_type,priority,active,next_due_at,time_interval,time_unit,meter_id,meter_interval,next_meter_due,lead_time_minutes')
      .is('archived_at', null)
      .order('next_due_at', { ascending: true, nullsFirst: false })
      .limit(1000),
    supabase.rpc('rpc_cmms_pm_due_list', {
      p_as_of: new Date().toISOString(),
      p_include_not_due: true,
    }),
  ])
  if (scheduleError) throw new Error(scheduleError.message || 'Không tải được lịch bảo trì phòng ngừa.')
  if (dueError) throw new Error(dueError.message || 'Không tính được trạng thái lịch PM.')

  const dueMap = new Map(rows(dueRows).map((row) => [text(row.schedule_id), row]))
  const result = rows(schedules).map((row) => {
    const due = dueMap.get(text(row.schedule_id)) || {}
    return {
      scheduleId: text(row.schedule_id),
      equipmentId: text(row.equipment_id),
      title: text(row.title),
      description: text(row.description),
      scheduleType: (text(row.schedule_type) || 'TIME') as PmDueItem['scheduleType'],
      priority: text(row.priority),
      active: Boolean(row.active),
      nextDueAt: text(row.next_due_at),
      timeInterval: numberOrNull(row.time_interval),
      timeUnit: text(row.time_unit),
      meterId: text(row.meter_id),
      meterInterval: numberOrNull(row.meter_interval),
      nextMeterDue: numberOrNull(row.next_meter_due),
      leadTimeMinutes: Number(row.lead_time_minutes || 0),
      latestMeterValue: numberOrNull(due.latest_meter_value),
      timeDue: Boolean(due.time_due),
      meterDue: Boolean(due.meter_due),
      isDue: Boolean(due.is_due),
    }
  })
  return includeNotDue ? result : result.filter((item) => item.isDue)
}

export async function savePmSchedule(input: PmScheduleInput) {
  if (!input.equipmentId.trim()) throw new Error('Chọn thiết bị cho kế hoạch PM.')
  if (!input.title.trim()) throw new Error('Tên kế hoạch PM là bắt buộc.')
  const { data, error } = await supabase.rpc('rpc_cmms_upsert_pm_schedule', {
    p_input: {
      scheduleId: input.scheduleId || null,
      equipmentId: input.equipmentId.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || '',
      scheduleType: input.scheduleType,
      priority: input.priority || 'NORMAL',
      active: input.active ?? true,
      startAt: input.startAt || new Date().toISOString(),
      nextDueAt: input.nextDueAt || '',
      timeInterval: input.timeInterval ?? '',
      timeUnit: input.timeUnit || '',
      meterId: input.meterId || '',
      meterInterval: input.meterInterval ?? '',
      nextMeterDue: input.nextMeterDue ?? '',
      leadTimeMinutes: input.leadTimeMinutes ?? 0,
      checklistTemplateId: input.checklistTemplateId || '',
      defaultPersonId: input.defaultPersonId || '',
      defaultTeamId: input.defaultTeamId || '',
    },
  })
  if (error) throw new Error(error.message || 'Không lưu được kế hoạch PM.')
  return data
}

export async function setPmScheduleActive(scheduleId: string, active: boolean) {
  const { data, error } = await supabase.rpc('rpc_cmms_set_pm_schedule_active', {
    p_schedule_id: scheduleId,
    p_active: active,
  })
  if (error) throw new Error(error.message || 'Không cập nhật được trạng thái kế hoạch PM.')
  return data
}

export async function archivePmSchedule(scheduleId: string, archived = true) {
  const { data, error } = await supabase.rpc('rpc_cmms_archive_pm_schedule', {
    p_schedule_id: scheduleId,
    p_archived: archived,
  })
  if (error) throw new Error(error.message || 'Không lưu trữ được kế hoạch PM.')
  return data
}

export async function generatePmWorkOrder(scheduleId: string): Promise<{ generatedCount: number; workOrderId: string }> {
  const { data, error } = await supabase.rpc('rpc_cmms_generate_due_pm_work_orders', {
    p_as_of: new Date().toISOString(),
    p_schedule_id: scheduleId,
  })
  if (error) throw new Error(error.message || 'Không tạo được Work Order từ PM.')
  const result = (data || {}) as Record<string, unknown>
  const generatedItems = Array.isArray(result.items) ? result.items as Array<Record<string, unknown>> : []
  return {
    generatedCount: Number(result.generatedCount || result.generated_count || generatedItems.length || 0),
    workOrderId: text(generatedItems[0]?.workOrderId || generatedItems[0]?.work_order_id),
  }
}

export async function listMeters(): Promise<MeterItem[]> {
  const { data: meters, error: meterError } = await supabase
    .from('cmms_meter')
    .select('meter_id,equipment_id,name,meter_type,unit,rollover_value')
    .eq('active', true)
    .is('archived_at', null)
    .order('name', { ascending: true })
    .limit(500)
  if (meterError) throw new Error(meterError.message || 'Không tải được danh sách meter.')

  const source = rows(meters)
  const meterIds = source.map((row) => text(row.meter_id)).filter(Boolean)
  const latest = new Map<string, { value: number | null; recordedAt: string }>()
  if (meterIds.length) {
    const { data: readings, error: readingError } = await supabase
      .from('cmms_meter_reading')
      .select('meter_id,reading_value,recorded_at,created_at')
      .in('meter_id', meterIds)
      .order('recorded_at', { ascending: false })
      .limit(5000)
    if (readingError) throw new Error(readingError.message || 'Không tải được chỉ số meter.')
    for (const row of rows(readings)) {
      const meterId = text(row.meter_id)
      if (!meterId || latest.has(meterId)) continue
      latest.set(meterId, { value: numberOrNull(row.reading_value), recordedAt: text(row.recorded_at) })
    }
  }

  return source.map((row) => {
    const meterId = text(row.meter_id)
    const reading = latest.get(meterId)
    return {
      meterId,
      equipmentId: text(row.equipment_id),
      name: text(row.name),
      meterType: text(row.meter_type),
      unit: text(row.unit),
      rolloverValue: numberOrNull(row.rollover_value),
      latestValue: reading?.value ?? null,
      latestRecordedAt: reading?.recordedAt || '',
    }
  })
}

export async function recordMeterReading(input: { meterId: string; value: number; note?: string }) {
  if (!Number.isFinite(input.value)) throw new Error('Giá trị meter không hợp lệ.')
  const { data, error } = await supabase.rpc('rpc_cmms_record_meter_reading', {
    p_meter_id: input.meterId,
    p_value: input.value,
    p_recorded_at: new Date().toISOString(),
    p_source_type: 'MANUAL',
    p_note: input.note?.trim() || null,
  })
  if (error) throw new Error(error.message || 'Không ghi được chỉ số meter.')
  return data
}
