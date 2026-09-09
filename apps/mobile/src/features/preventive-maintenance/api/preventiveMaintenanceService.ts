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
  scheduleType: string
  nextDueAt: string
  nextMeterDue: number | null
  latestMeterValue: number | null
  timeDue: boolean
  meterDue: boolean
  isDue: boolean
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
  const { data, error } = await supabase.rpc('rpc_cmms_pm_due_list', {
    p_as_of: new Date().toISOString(),
    p_include_not_due: includeNotDue,
  })
  if (error) throw new Error(error.message || 'Không tải được lịch bảo trì phòng ngừa.')
  return rows(data).map((row) => ({
    scheduleId: text(row.schedule_id),
    equipmentId: text(row.equipment_id),
    title: text(row.title),
    scheduleType: text(row.schedule_type),
    nextDueAt: text(row.next_due_at),
    nextMeterDue: numberOrNull(row.next_meter_due),
    latestMeterValue: numberOrNull(row.latest_meter_value),
    timeDue: Boolean(row.time_due),
    meterDue: Boolean(row.meter_due),
    isDue: Boolean(row.is_due),
  }))
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
