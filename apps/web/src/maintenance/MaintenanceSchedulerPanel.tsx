import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { useAppRole } from '../auth/AppRoleContext'
import {
  loadSchedulerConflicts,
  loadSchedulerEvents,
  rescheduleWorkOrder,
  type LiveSchedulerEvent,
  type SchedulerConflict,
} from '../data/liveScheduler'
import './MaintenanceSchedulerPanel.css'

type CalendarMode = 'month' | 'week' | 'day'

type PendingMove = {
  event: LiveSchedulerEvent
  startAt: string
  endAt: string
  conflicts: SchedulerConflict[]
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const TERMINAL = new Set(['COMPLETED', 'COMPLETE', 'VERIFIED', 'RELEASED', 'CANCELLED', 'CLOSED'])

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay())
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  return startOfWeek(first)
}

function endOfMonthGrid(date: Date) {
  return addDays(startOfMonthGrid(date), 42)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(date)
}

function formatShortDate(value: string) {
  if (!value) return 'Chưa xếp lịch'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatDayHeading(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function sameDay(value: string, date: Date) {
  if (!value) return false
  const candidate = new Date(value)
  return !Number.isNaN(candidate.getTime()) && dateKey(candidate) === dateKey(date)
}

function statusLabel(status: string) {
  const normalized = status.toUpperCase()
  const labels: Record<string, string> = {
    OPEN: 'Mở',
    REQUESTED: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    PLANNED: 'Đã lên lịch',
    ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang làm',
    ON_HOLD: 'Tạm dừng',
    COMPLETED: 'Hoàn tất',
    VERIFIED: 'Đã xác nhận',
    DUE: 'Đến hạn PM',
    OVERDUE: 'Quá hạn',
  }
  return labels[normalized] || status || '—'
}

function moveEventToDay(event: LiveSchedulerEvent, target: Date) {
  const start = event.startAt ? new Date(event.startAt) : new Date(target)
  const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000)
  const duration = Math.max(end.getTime() - start.getTime(), 30 * 60 * 1000)
  const nextStart = new Date(target)
  if (event.startAt) nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
  else nextStart.setHours(8, 0, 0, 0)
  return {
    startAt: nextStart.toISOString(),
    endAt: new Date(nextStart.getTime() + duration).toISOString(),
  }
}

function canManageScheduler(role: string) {
  return role === 'SUPERVISOR' || role === 'MANAGER' || role === 'ADMIN'
}

export function MaintenanceSchedulerPanel() {
  const role = useAppRole()
  const canManage = canManageScheduler(role)
  const [mode, setMode] = useState<CalendarMode>('month')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState<LiveSchedulerEvent[]>([])
  const [selected, setSelected] = useState<LiveSchedulerEvent | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [query, setQuery] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [showUnscheduled, setShowUnscheduled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const period = useMemo(() => {
    if (mode === 'month') return { start: startOfMonthGrid(cursor), end: endOfMonthGrid(cursor) }
    if (mode === 'week') {
      const start = startOfWeek(cursor)
      return { start, end: addDays(start, 7) }
    }
    const start = startOfDay(cursor)
    return { start, end: addDays(start, 1) }
  }, [cursor, mode])
  const periodStartMs = period.start.getTime()
  const periodEndMs = period.end.getTime()

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const next = await loadSchedulerEvents({
        startAt: period.start.toISOString(),
        endAt: period.end.toISOString(),
        includeUnscheduled: true,
      })
      setEvents(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải lịch bảo trì.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [periodStartMs, periodEndMs])

  const equipmentOptions = useMemo(() => Array.from(new Map(events.filter((event) => event.equipmentId).map((event) => [event.equipmentId, event.equipmentName || event.equipmentId])).entries()).sort((a, b) => a[0].localeCompare(b[0])), [events])
  const personOptions = useMemo(() => Array.from(new Map(events.filter((event) => event.primaryPersonId).map((event) => [event.primaryPersonId, event.primaryPersonName || event.primaryPersonId])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [events])
  const teamOptions = useMemo(() => Array.from(new Map(events.filter((event) => event.primaryTeamId).map((event) => [event.primaryTeamId, event.primaryTeamName || event.primaryTeamId])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [events])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN')
    return events.filter((event) => {
      if (equipmentFilter && event.equipmentId !== equipmentFilter) return false
      if (personFilter && event.primaryPersonId !== personFilter) return false
      if (teamFilter && event.primaryTeamId !== teamFilter) return false
      if (!needle) return true
      return [event.title, event.eventId, event.equipmentId, event.equipmentName, event.primaryPersonName, event.primaryTeamName, event.locationName]
        .some((value) => value.toLocaleLowerCase('vi-VN').includes(needle))
    })
  }, [events, equipmentFilter, personFilter, query, teamFilter])

  const unscheduled = filtered.filter((event) => event.eventType === 'WORK_ORDER' && event.unscheduled)
  const scheduled = filtered.filter((event) => !event.unscheduled)

  const calendarDays = useMemo(() => {
    const count = mode === 'month' ? 42 : mode === 'week' ? 7 : 1
    const start = mode === 'month' ? startOfMonthGrid(cursor) : mode === 'week' ? startOfWeek(cursor) : startOfDay(cursor)
    return Array.from({ length: count }, (_, index) => addDays(start, index))
  }, [cursor, mode])

  function changePeriod(direction: number) {
    const next = new Date(cursor)
    if (mode === 'month') next.setMonth(next.getMonth() + direction)
    else if (mode === 'week') next.setDate(next.getDate() + direction * 7)
    else next.setDate(next.getDate() + direction)
    setCursor(startOfDay(next))
  }

  async function requestMove(event: LiveSchedulerEvent, targetDay: Date) {
    if (!canManage || event.eventType !== 'WORK_ORDER' || event.scheduleLocked || TERMINAL.has(event.status.toUpperCase())) return
    const moved = moveEventToDay(event, targetDay)
    setError('')
    setMessage('')
    try {
      const conflicts = await loadSchedulerConflicts({
        workOrderId: event.workOrderId,
        startAt: moved.startAt,
        endAt: moved.endAt,
        personId: event.primaryPersonId,
        teamId: event.primaryTeamId,
      })
      if (conflicts.length) {
        setPendingMove({ event, ...moved, conflicts })
        return
      }
      await commitMove(event, moved.startAt, moved.endAt, false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra xung đột lịch.')
    }
  }

  async function commitMove(event: LiveSchedulerEvent, startAt: string, endAt: string, allowConflict: boolean) {
    setSaving(true)
    setError('')
    try {
      await rescheduleWorkOrder({
        workOrderId: event.workOrderId,
        startAt,
        endAt,
        personId: event.primaryPersonId,
        teamId: event.primaryTeamId,
        allowConflict,
        note: allowConflict ? 'CEV Scheduler: supervisor accepted detected conflict' : 'CEV Scheduler drag/drop',
      })
      setPendingMove(null)
      setSelected(null)
      setMessage(`Đã cập nhật lịch ${event.workOrderId}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật lịch.')
    } finally {
      setSaving(false)
    }
  }

  async function saveFromDetail(event: LiveSchedulerEvent, startValue: string, endValue: string) {
    if (!startValue || !endValue) return
    await commitMove(event, new Date(startValue).toISOString(), new Date(endValue).toISOString(), false)
  }

  function onDrop(event: DragEvent<HTMLDivElement>, day: Date) {
    event.preventDefault()
    const eventId = event.dataTransfer.getData('text/cev-scheduler-event')
    const item = events.find((candidate) => candidate.eventId === eventId)
    if (item) void requestMove(item, day)
  }

  return <section className="scheduler-workspace" aria-labelledby="scheduler-title">
    <header className="scheduler-header">
      <div>
        <p className="eyebrow">CMMS · Kế hoạch bảo trì</p>
        <h2 id="scheduler-title">Lịch trình</h2>
        <p>Lệnh công việc và kỳ bảo trì phòng ngừa trên cùng một lịch. Kéo lệnh công việc sang ngày khác để xếp lại lịch; kỳ PM được giữ như mốc kiểm soát IATF.</p>
      </div>
      <div className="scheduler-header-actions">
        <button type="button" onClick={() => void refresh()} disabled={loading}>Làm mới</button>
      </div>
    </header>

    <div className="scheduler-toolbar">
      <div className="scheduler-period-nav">
        <button type="button" aria-label="Kỳ trước" onClick={() => changePeriod(-1)}>‹</button>
        <button type="button" onClick={() => setCursor(startOfDay(new Date()))}>Hôm nay</button>
        <button type="button" aria-label="Kỳ sau" onClick={() => changePeriod(1)}>›</button>
        <strong>{mode === 'month' ? formatMonth(cursor) : mode === 'week' ? `${formatDayHeading(period.start)} – ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(addDays(period.end, -1))}` : formatDayHeading(cursor)}</strong>
      </div>
      <div className="scheduler-view-switch" role="group" aria-label="Kiểu hiển thị lịch">
        {(['day', 'week', 'month'] as CalendarMode[]).map((item) => <button key={item} type="button" className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item === 'day' ? 'Ngày' : item === 'week' ? 'Tuần' : 'Tháng'}</button>)}
      </div>
    </div>

    <div className="scheduler-filterbar">
      <label className="scheduler-search"><span className="sr-only">Tìm kiếm lịch</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm Work Order, thiết bị, người phụ trách…" /></label>
      <label><span className="sr-only">Thiết bị</span><select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}><option value="">Tất cả thiết bị</option>{equipmentOptions.map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select></label>
      <label><span className="sr-only">Nhân sự</span><select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="">Tất cả nhân sự</option>{personOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label><span className="sr-only">Nhóm</span><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">Tất cả nhóm</option>{teamOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <button type="button" className={showUnscheduled ? 'active' : ''} onClick={() => setShowUnscheduled((current) => !current)}>Chưa xếp lịch {unscheduled.length ? `(${unscheduled.length})` : ''}</button>
    </div>

    {message ? <div className="scheduler-feedback" role="status">{message}</div> : null}
    {error ? <div className="scheduler-feedback error" role="alert">{error}</div> : null}

    <div className={`scheduler-layout${showUnscheduled ? '' : ' tray-hidden'}`}>
      {showUnscheduled ? <aside className="scheduler-unscheduled" aria-label="Công việc chưa xếp lịch">
        <header><div><strong>Chưa xếp lịch</strong><small>Kéo Work Order vào lịch</small></div><span>{unscheduled.length}</span></header>
        <div className="scheduler-unscheduled-list">
          {unscheduled.length ? unscheduled.map((event) => <SchedulerEventCard key={event.eventId} event={event} canManage={canManage} onSelect={setSelected} />) : <div className="scheduler-empty">Không có công việc chưa xếp lịch.</div>}
        </div>
      </aside> : null}

      <div className="scheduler-calendar-wrap">
        {loading ? <div className="scheduler-state" role="status">Đang tải lịch…</div> : <>
          {mode !== 'day' ? <div className={`scheduler-weekdays ${mode}`} aria-hidden="true">{calendarDays.slice(0, mode === 'month' ? 7 : calendarDays.length).map((day) => <span key={dateKey(day)}>{mode === 'month' ? WEEKDAY[day.getDay()] : `${WEEKDAY[day.getDay()]} ${day.getDate()}/${day.getMonth() + 1}`}</span>)}</div> : null}
          <div className={`scheduler-calendar-grid ${mode}`}>
            {calendarDays.map((day) => {
              const dayEvents = scheduled.filter((event) => sameDay(event.startAt, day))
              const outsideMonth = mode === 'month' && day.getMonth() !== cursor.getMonth()
              const today = dateKey(day) === dateKey(new Date())
              return <div key={dateKey(day)} className={`scheduler-day${outsideMonth ? ' outside' : ''}${today ? ' today' : ''}`} onDragOver={(event) => { if (canManage) event.preventDefault() }} onDrop={(event) => onDrop(event, day)}>
                <div className="scheduler-day-heading"><span>{mode === 'day' ? formatDayHeading(day) : day.getDate()}</span>{today ? <small>Hôm nay</small> : null}</div>
                <div className="scheduler-day-events">
                  {dayEvents.map((event) => <SchedulerEventCard key={event.eventId} event={event} canManage={canManage} onSelect={setSelected} />)}
                </div>
              </div>
            })}
          </div>
        </>}
      </div>
    </div>

    {selected ? <SchedulerDetail event={selected} canManage={canManage} saving={saving} onClose={() => setSelected(null)} onSave={saveFromDetail} /> : null}
    {pendingMove ? <ConflictDialog pending={pendingMove} saving={saving} onCancel={() => setPendingMove(null)} onConfirm={() => void commitMove(pendingMove.event, pendingMove.startAt, pendingMove.endAt, true)} /> : null}
  </section>
}

function SchedulerEventCard({ event, canManage, onSelect }: { event: LiveSchedulerEvent; canManage: boolean; onSelect: (event: LiveSchedulerEvent) => void }) {
  const draggable = canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && !TERMINAL.has(event.status.toUpperCase())
  return <button
    type="button"
    className={`scheduler-event ${event.eventType === 'PM_DUE' ? 'pm' : 'wo'} priority-${(event.priority || 'normal').toLowerCase()}`}
    draggable={draggable}
    onDragStart={(dragEvent) => {
      dragEvent.dataTransfer.effectAllowed = 'move'
      dragEvent.dataTransfer.setData('text/cev-scheduler-event', event.eventId)
    }}
    onClick={() => onSelect(event)}
    title={`${event.eventId} · ${event.equipmentId}`}
  >
    <span className="scheduler-event-kicker">{event.eventType === 'PM_DUE' ? 'PM' : event.workOrderId || 'WO'}{event.scheduleLocked ? ' · 🔒' : ''}</span>
    <strong>{event.title || (event.eventType === 'PM_DUE' ? 'Bảo trì phòng ngừa' : 'Lệnh công việc')}</strong>
    <span>{event.equipmentId}{event.equipmentName ? ` · ${event.equipmentName}` : ''}</span>
    <small>{event.unscheduled ? 'Chưa xếp lịch' : formatShortDate(event.startAt)} · {statusLabel(event.status)}</small>
  </button>
}

function SchedulerDetail({ event, canManage, saving, onClose, onSave }: { event: LiveSchedulerEvent; canManage: boolean; saving: boolean; onClose: () => void; onSave: (event: LiveSchedulerEvent, start: string, end: string) => Promise<void> }) {
  const [startValue, setStartValue] = useState(() => event.startAt ? toLocalInput(event.startAt) : '')
  const [endValue, setEndValue] = useState(() => event.endAt ? toLocalInput(event.endAt) : '')
  const editable = canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && !TERMINAL.has(event.status.toUpperCase())

  return <div className="scheduler-layer" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}>
    <aside className="scheduler-drawer" role="dialog" aria-modal="true" aria-labelledby="scheduler-detail-title">
      <header><div><p className="eyebrow">{event.eventType === 'PM_DUE' ? 'Bảo trì phòng ngừa' : 'Lệnh công việc'}</p><h2 id="scheduler-detail-title">{event.title || event.eventId}</h2><span>{event.eventId}</span></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header>
      <div className="scheduler-drawer-body">
        <dl>
          <div><dt>Thiết bị</dt><dd><strong>{event.equipmentId}</strong><span>{event.equipmentName || '—'}</span></dd></div>
          <div><dt>Trạng thái</dt><dd>{statusLabel(event.status)}</dd></div>
          <div><dt>Ưu tiên</dt><dd>{event.priority || '—'}</dd></div>
          <div><dt>Địa điểm</dt><dd>{event.locationName || '—'}</dd></div>
          <div><dt>Người phụ trách</dt><dd>{event.primaryPersonName || '—'}</dd></div>
          <div><dt>Nhóm</dt><dd>{event.primaryTeamName || '—'}</dd></div>
        </dl>
        <div className="scheduler-iatf-note"><strong>IATF 16949</strong><p>{event.eventType === 'PM_DUE' ? 'Mốc PM này là thời hạn kiểm soát của kế hoạch bảo trì. Thực hiện Work Order và lưu bằng chứng/kết quả để đóng vòng hồ sơ.' : 'Thời gian kế hoạch, người phụ trách và lịch sử thay đổi được dùng làm bằng chứng kiểm soát bảo trì.'}</p></div>
        <div className="scheduler-time-editor">
          <label><span>Bắt đầu</span><input type="datetime-local" value={startValue} disabled={!editable} onChange={(changeEvent) => setStartValue(changeEvent.target.value)} /></label>
          <label><span>Kết thúc</span><input type="datetime-local" value={endValue} disabled={!editable} onChange={(changeEvent) => setEndValue(changeEvent.target.value)} /></label>
        </div>
      </div>
      <footer><button type="button" onClick={onClose}>Đóng</button>{editable ? <button className="primary" type="button" disabled={saving || !startValue || !endValue} onClick={() => void onSave(event, startValue, endValue)}>{saving ? 'Đang lưu…' : 'Lưu lịch'}</button> : null}</footer>
    </aside>
  </div>
}

function ConflictDialog({ pending, saving, onCancel, onConfirm }: { pending: PendingMove; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="scheduler-layer conflict" role="presentation">
    <section className="scheduler-conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="scheduler-conflict-title">
      <header><div><p className="eyebrow">Cảnh báo xung đột</p><h2 id="scheduler-conflict-title">Lịch đang trùng nguồn lực</h2></div></header>
      <div className="scheduler-conflict-body">
        <p>Hệ thống phát hiện {pending.conflicts.length} xung đột cho <strong>{pending.event.workOrderId}</strong>. Kiểm tra trước khi ghi đè lịch.</p>
        <ul>{pending.conflicts.map((conflict) => <li key={`${conflict.conflictType}-${conflict.conflictingWorkOrderId}-${conflict.resourceId}`}><strong>{conflict.conflictType}</strong><span>{conflict.resourceName || conflict.resourceId}</span><small>{conflict.conflictingWorkOrderId} · {formatShortDate(conflict.plannedStartAt)} · {conflict.title}</small></li>)}</ul>
      </div>
      <footer><button type="button" onClick={onCancel}>Hủy</button><button className="danger" type="button" disabled={saving} onClick={onConfirm}>{saving ? 'Đang lưu…' : 'Vẫn xếp lịch'}</button></footer>
    </section>
  </div>
}

function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export const schedulerDateUtils = { dateKey, startOfWeek, startOfMonthGrid, moveEventToDay }
