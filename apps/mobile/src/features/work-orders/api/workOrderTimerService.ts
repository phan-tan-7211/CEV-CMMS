import { supabase } from '../../../lib/supabase/client'

function text(value: unknown) { return String(value ?? '').trim() }
function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export type WorkOrderTimerState = {
  active: boolean
  timerId: string
  workOrderId: string
  personId: string
  status: 'RUNNING' | 'PAUSED' | ''
  startedAt: string
  runningSince: string
  pausedAt: string
  elapsedSeconds: number
  hourlyRate: number | null
  note: string
}

function parseTimerState(data: unknown): WorkOrderTimerState {
  const value = record(data)
  const rate = value.hourlyRate ?? value.hourly_rate
  return {
    active: Boolean(value.active),
    timerId: text(value.timerId ?? value.timer_id),
    workOrderId: text(value.workOrderId ?? value.work_order_id),
    personId: text(value.personId ?? value.person_id),
    status: (text(value.status).toUpperCase() || '') as WorkOrderTimerState['status'],
    startedAt: text(value.startedAt ?? value.started_at),
    runningSince: text(value.runningSince ?? value.running_since),
    pausedAt: text(value.pausedAt ?? value.paused_at),
    elapsedSeconds: Math.max(0, numberValue(value.elapsedSeconds ?? value.elapsed_seconds)),
    hourlyRate: rate === null || rate === undefined || rate === '' ? null : numberValue(rate),
    note: text(value.note),
  }
}

export async function getWorkOrderTimerState(workOrderId: string): Promise<WorkOrderTimerState> {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_timer_state', {
    p_work_order_id: workOrderId.trim(),
  })
  if (error) throw new Error(error.message || 'Không tải được bộ đếm giờ công.')
  return parseTimerState(data)
}

export async function startWorkOrderTimer(workOrderId: string, note = '') {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_timer_start', {
    p_work_order_id: workOrderId.trim(),
    p_hourly_rate: null,
    p_note: note.trim() || null,
  })
  if (error) throw new Error(error.message || 'Không bắt đầu được bộ đếm giờ công.')
  return parseTimerState(data)
}

export async function pauseWorkOrderTimer(timerId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_timer_pause', { p_timer_id: timerId })
  if (error) throw new Error(error.message || 'Không tạm dừng được bộ đếm.')
  return parseTimerState(data)
}

export async function resumeWorkOrderTimer(timerId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_timer_resume', { p_timer_id: timerId })
  if (error) throw new Error(error.message || 'Không tiếp tục được bộ đếm.')
  return parseTimerState(data)
}

export async function stopWorkOrderTimer(timerId: string, note = '') {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_timer_stop', {
    p_timer_id: timerId,
    p_note: note.trim() || null,
  })
  if (error) throw new Error(error.message || 'Không dừng được bộ đếm giờ công.')
  return record(data)
}

export async function cancelWorkOrderTimer(timerId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_work_order_timer_cancel', { p_timer_id: timerId })
  if (error) throw new Error(error.message || 'Không hủy được bộ đếm giờ công.')
  return record(data)
}
