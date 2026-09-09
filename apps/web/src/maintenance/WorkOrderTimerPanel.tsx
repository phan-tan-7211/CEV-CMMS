import { useEffect, useMemo, useState } from 'react'
import {
  cancelWorkOrderTimer,
  loadWorkOrderTimer,
  pauseWorkOrderTimer,
  resumeWorkOrderTimer,
  startWorkOrderTimer,
  stopWorkOrderTimer,
  type WorkOrderTimerState,
} from '../data/workOrderTimer'
import './WorkOrderTimerPanel.css'

const EMPTY: WorkOrderTimerState = { active: false, timerId: '', workOrderId: '', personId: '', status: '', elapsedSeconds: 0, note: '' }

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
}

export function WorkOrderTimerPanel({ workOrderId, enabled }: { workOrderId: string; enabled: boolean }) {
  const [timer, setTimer] = useState<WorkOrderTimerState>(EMPTY)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const next = await loadWorkOrderTimer(workOrderId)
    setTimer(next)
    setDisplaySeconds(next.elapsedSeconds)
    if (next.note && !note) setNote(next.note)
  }

  useEffect(() => {
    let active = true
    void loadWorkOrderTimer(workOrderId)
      .then((next) => { if (active) { setTimer(next); setDisplaySeconds(next.elapsedSeconds); if (next.note) setNote(next.note) } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được bộ đếm giờ công') })
    return () => { active = false }
  }, [workOrderId])

  useEffect(() => {
    setDisplaySeconds(timer.elapsedSeconds)
    if (!timer.active || timer.status !== 'RUNNING') return undefined
    const baseline = timer.elapsedSeconds
    const started = Date.now()
    const id = window.setInterval(() => setDisplaySeconds(baseline + Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [timer.active, timer.elapsedSeconds, timer.status])

  const status = useMemo(() => !timer.active ? 'Chưa chạy' : timer.status === 'RUNNING' ? 'Đang tính giờ' : 'Đã tạm dừng', [timer.active, timer.status])

  async function run(task: () => Promise<unknown>, after?: () => void) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await task()
      await reload()
      after?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không cập nhật được bộ đếm giờ công')
    } finally { setBusy(false) }
  }

  async function stop() {
    if (!timer.timerId || !window.confirm('Dừng bộ đếm và ghi thời gian này vào giờ công?')) return
    await run(() => stopWorkOrderTimer(timer.timerId, note), () => window.dispatchEvent(new CustomEvent('cev:work-order-labor-changed', { detail: { workOrderId } })))
  }

  async function cancel() {
    if (!timer.timerId || !window.confirm('Hủy phiên tính giờ? Phiên này sẽ không tạo giờ công.')) return
    await run(() => cancelWorkOrderTimer(timer.timerId))
  }

  return <section className="wo-timer" aria-label="Bộ đếm giờ công">
    <div className="wo-timer-head">
      <div><span>Labor timer</span><b>{status}</b></div>
      <strong>{formatElapsed(displaySeconds)}</strong>
    </div>
    {error ? <div className="wo-timer-error" role="alert">{error}</div> : null}
    {!enabled && !timer.active ? <p>Timer khả dụng khi Work Order đang ở trạng thái IN_PROGRESS.</p> : null}
    {(enabled || timer.active) ? <input value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} placeholder="Ghi chú công việc (tùy chọn)" /> : null}
    <div className="wo-timer-actions">
      {!timer.active ? <button type="button" disabled={!enabled || busy} onClick={() => void run(() => startWorkOrderTimer(workOrderId, note))}>▶ Bắt đầu</button> : null}
      {timer.active && timer.status === 'RUNNING' ? <button type="button" disabled={busy} onClick={() => void run(() => pauseWorkOrderTimer(timer.timerId))}>Ⅱ Tạm dừng</button> : null}
      {timer.active && timer.status === 'PAUSED' ? <button type="button" disabled={busy} onClick={() => void run(() => resumeWorkOrderTimer(timer.timerId))}>▶ Tiếp tục</button> : null}
      {timer.active ? <button type="button" disabled={busy} onClick={() => void stop()}>■ Dừng & ghi giờ</button> : null}
      {timer.active ? <button className="danger" type="button" disabled={busy} onClick={() => void cancel()}>Hủy phiên</button> : null}
    </div>
  </section>
}
