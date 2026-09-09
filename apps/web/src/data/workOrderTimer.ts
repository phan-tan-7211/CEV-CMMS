import { dataGateway } from './dataGateway'

function text(value: unknown) { return String(value ?? '').trim() }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export type WorkOrderTimerState = {
  active: boolean
  timerId: string
  workOrderId: string
  personId: string
  status: 'RUNNING' | 'PAUSED' | ''
  elapsedSeconds: number
  note: string
}

function parseState(value: unknown): WorkOrderTimerState {
  const row = record(value)
  return {
    active: Boolean(row.active),
    timerId: text(row.timerId ?? row.timer_id),
    workOrderId: text(row.workOrderId ?? row.work_order_id),
    personId: text(row.personId ?? row.person_id),
    status: (text(row.status).toUpperCase() || '') as WorkOrderTimerState['status'],
    elapsedSeconds: Math.max(0, numberValue(row.elapsedSeconds ?? row.elapsed_seconds)),
    note: text(row.note),
  }
}

async function timerRpc(name: string, args: Record<string, unknown>) {
  const result = await dataGateway.rpc(name, args)
  if (result.error) throw result.error
  return result.data
}

export async function loadWorkOrderTimer(workOrderId: string) {
  return parseState(await timerRpc('rpc_cmms_work_order_timer_state', { p_work_order_id: workOrderId }))
}
export async function startWorkOrderTimer(workOrderId: string, note = '') {
  return parseState(await timerRpc('rpc_cmms_work_order_timer_start', { p_work_order_id: workOrderId, p_hourly_rate: null, p_note: note.trim() || null }))
}
export async function pauseWorkOrderTimer(timerId: string) {
  return parseState(await timerRpc('rpc_cmms_work_order_timer_pause', { p_timer_id: timerId }))
}
export async function resumeWorkOrderTimer(timerId: string) {
  return parseState(await timerRpc('rpc_cmms_work_order_timer_resume', { p_timer_id: timerId }))
}
export async function stopWorkOrderTimer(timerId: string, note = '') {
  return record(await timerRpc('rpc_cmms_work_order_timer_stop', { p_timer_id: timerId, p_note: note.trim() || null }))
}
export async function cancelWorkOrderTimer(timerId: string) {
  return record(await timerRpc('rpc_cmms_work_order_timer_cancel', { p_timer_id: timerId }))
}
