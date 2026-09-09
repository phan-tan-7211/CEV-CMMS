import { supabase } from '../../../lib/supabase/client'

function rows(data: unknown): Array<Record<string, unknown>> {
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : []
}
function text(value: unknown) { return String(value ?? '').trim() }
function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export type OeeMetric = {
  equipmentId: string
  equipmentName: string
  locationId: string
  locationName: string
  periodCount: number
  plannedProductionMinutes: number
  downtimeMinutes: number
  operatingMinutes: number
  totalCount: number
  goodCount: number
  availabilityPercent: number | null
  performancePercent: number | null
  qualityPercent: number | null
  oeePercent: number | null
}

export type OeePeriodInput = {
  equipmentId: string
  periodStartAt: string
  periodEndAt: string
  shiftCode?: string
  plannedProductionMinutes: number
  idealCycleSeconds: number
  totalCount: number
  goodCount: number
  note?: string
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function listOeeMetrics(days = 30): Promise<OeeMetric[]> {
  const end = new Date()
  const start = new Date(end.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000)
  const { data, error } = await supabase.rpc('rpc_cmms_analytics_oee', {
    p_start_at: start.toISOString(),
    p_end_at: end.toISOString(),
    p_location_id: null,
    p_equipment_id: null,
  })
  if (error) throw new Error(error.message || 'Không tải được dữ liệu OEE.')
  return rows(data).map((row) => ({
    equipmentId: text(row.equipment_id),
    equipmentName: text(row.equipment_name),
    locationId: text(row.location_id),
    locationName: text(row.location_name),
    periodCount: number(row.period_count),
    plannedProductionMinutes: number(row.planned_production_minutes),
    downtimeMinutes: number(row.downtime_minutes),
    operatingMinutes: number(row.operating_minutes),
    totalCount: number(row.total_count),
    goodCount: number(row.good_count),
    availabilityPercent: nullableNumber(row.availability_percent),
    performancePercent: nullableNumber(row.performance_percent),
    qualityPercent: nullableNumber(row.quality_percent),
    oeePercent: nullableNumber(row.oee_percent),
  }))
}

export async function saveOeePeriod(input: OeePeriodInput) {
  if (!input.equipmentId.trim()) throw new Error('Chọn thiết bị trước khi lưu OEE.')
  if (!(input.periodEndAt > input.periodStartAt)) throw new Error('Thời gian ca không hợp lệ.')
  if (!Number.isFinite(input.plannedProductionMinutes) || input.plannedProductionMinutes <= 0) throw new Error('Phút sản xuất kế hoạch phải lớn hơn 0.')
  if (!Number.isFinite(input.idealCycleSeconds) || input.idealCycleSeconds <= 0) throw new Error('Chu kỳ lý tưởng phải lớn hơn 0.')
  if (!Number.isFinite(input.totalCount) || input.totalCount < 0) throw new Error('Tổng sản lượng không hợp lệ.')
  if (!Number.isFinite(input.goodCount) || input.goodCount < 0 || input.goodCount > input.totalCount) throw new Error('Sản lượng đạt phải nằm từ 0 đến tổng sản lượng.')

  const { data, error } = await supabase.rpc('rpc_cmms_upsert_oee_period', {
    p_input: {
      equipmentId: input.equipmentId.trim(),
      periodStartAt: input.periodStartAt,
      periodEndAt: input.periodEndAt,
      shiftCode: input.shiftCode?.trim() || '',
      plannedProductionMinutes: input.plannedProductionMinutes,
      idealCycleSeconds: input.idealCycleSeconds,
      totalCount: input.totalCount,
      goodCount: input.goodCount,
      sourceType: 'MANUAL',
      note: input.note?.trim() || '',
    },
  })
  if (error) throw new Error(error.message || 'Không lưu được dữ liệu OEE.')
  return data
}
