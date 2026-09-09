import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
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
type ScheduleBasis = 'start' | 'due'

type PendingMove = {
  event: LiveSchedulerEvent
  startAt: string
  endAt: string
  conflicts: SchedulerConflict[]
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const TERMINAL = new Set(['COMPLETED', 'COMPLETE', 'VERIFIED', 'RELEASED', 'CANCELLED', 'CLOSED'])
const GRID_START_HOUR = 6
const GRID_END_HOUR = 22
const GRID_HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, index) => GRID_START_HOUR + index)

function pad(value: number) { return String(value).padStart(2, '0') }
function dateKey(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function startOfDay(date: Date) { const next = new Date(date); next.setHours(0, 0, 0, 0); return next }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
function startOfWeek(date: Date) { return addDays(startOfDay(date), -date.getDay()) }
function startOfMonthGrid(date: Date) { return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)) }
function endOfMonthGrid(date: Date) { return addDays(startOfMonthGrid(date), 42) }
function formatMonth(date: Date) { return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(date) }
function formatDayHeading(date: Date) { return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) }
function formatShortDate(value: string) {
  if (!value) return 'Chưa xếp lịch'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'Mở', REQUESTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', PLANNED: 'Đã lên lịch', ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang làm', ON_HOLD: 'Tạm dừng', COMPLETED: 'Hoàn tất', VERIFIED: 'Đã xác nhận', DUE: 'Đến hạn PM', OVERDUE: 'Quá hạn',
  }
  return labels[status.toUpperCase()] || status || '—'
}
function sourceDate(event: LiveSchedulerEvent) {
  const keys = ['dueAt', 'due_at', 'dueDate', 'due_date', 'plannedDueAt', 'planned_due_at', 'deadlineAt', 'deadline_at']
  for (const key of keys) {
    const value = event.sourceData[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}
function displayDate(event: LiveSchedulerEvent, basis: ScheduleBasis) {
  if (basis === 'start') return event.startAt
  if (event.eventType === 'PM_DUE') return event.startAt
  return sourceDate(event) || event.endAt || event.startAt
}
function sameDay(value: string, date: Date) {
  if (!value) return false
  const candidate = new Date(value)
  return !Number.isNaN(candidate.getTime()) && dateKey(candidate) === dateKey(date)
}
function moveEventToDay(event: LiveSchedulerEvent, target: Date) {
  const start = event.startAt ? new Date(event.startAt) : new Date(target)
  const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000)
  const duration = Math.max(end.getTime() - start.getTime(), 30 * 60 * 1000)
  const nextStart = new Date(target)
  if (event.startAt) nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
  else nextStart.setHours(8, 0, 0, 0)
  return { startAt: nextStart.toISOString(), endAt: new Date(nextStart.getTime() + duration).toISOString() }
}
function canManageScheduler(role: string) { return ['SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role) }
function eventMinutes(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return GRID_START_HOUR * 60
  return date.getHours() * 60 + date.getMinutes()
}
function timeGridStyle(event: LiveSchedulerEvent, basis: ScheduleBasis): CSSProperties {
  const dateValue = displayDate(event, basis)
  const start = eventMinutes(dateValue)
  const end = basis === 'start' && event.endAt ? eventMinutes(event.endAt) : start + 60
  const gridStart = GRID_START_HOUR * 60
  const gridMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60
  const top = Math.max(0, Math.min(gridMinutes - 30, start - gridStart))
  const duration = Math.max(30, Math.min(gridMinutes - top, end - start || 60))
  return { top: `${(top / gridMinutes) * 100}%`, height: `${(duration / gridMinutes) * 100}%` }
}
function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function MaintenanceSchedulerPanel() {
  const role = useAppRole()
  const canManage = canManageScheduler(role)
  const [mode, setMode] = useState<CalendarMode>('week')
  const [basis, setBasis] = useState<ScheduleBasis>('start')
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
    if (mode === 'week') { const start = startOfWeek(cursor); return { start, end: addDays(start, 7) } }
    const start = startOfDay(cursor); return { start, end: addDays(start, 1) }
  }, [cursor, mode])
  const periodStartMs = period.start.getTime()
  const periodEndMs = period.end.getTime()

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setEvents(await loadSchedulerEvents({
        startAt: new Date(periodStartMs).toISOString(),
        endAt: new Date(periodEndMs).toISOString(),
        includeUnscheduled: true,
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải lịch bảo trì.')
    } finally { setLoading(false) }
  }, [periodEndMs, periodStartMs])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!selected && !pendingMove) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [pendingMove, selected])

  const equipmentOptions = useMemo(() => Array.from(new Map(events.filter((event) => event.equipmentId).map((event) => [event.equipmentId, event.equipmentName || event.equipmentId])).entries()).toSorted((a, b) => a[0].localeCompare(b[0])), [events])
  const personOptions = useMemo(() => Array.from(new Map(events.filter((event) => event.primaryPersonId).map((event) => [event.primaryPersonId, event.primaryPersonName || event.primaryPersonId])).entries()).toSorted((a, b) => a[1].localeCompare(b[1])), [events])
  const teamOptions = useMemo(() => Array.from(new Map(events.filter((event) => event.primaryTeamId).map((event) => [event.primaryTeamId, event.primaryTeamName || event.primaryTeamId])).entries()).toSorted((a, b) => a[1].localeCompare(b[1])), [events])

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
  const scheduled = filtered.filter((event) => !event.unscheduled && !!displayDate(event, basis))
  const calendarDays = useMemo(() => {
    const count = mode === 'month' ? 42 : mode === 'week' ? 7 : 1
    const start = mode === 'month' ? startOfMonthGrid(cursor) : mode === 'week' ? startOfWeek(cursor) : startOfDay(cursor)
    return Array.from({ length: count }, (_, index) => addDays(start, index))
  }, [cursor, mode])
  const riskCounts = useMemo(() => ({
    overdue: filtered.filter((event) => event.status.toUpperCase() === 'OVERDUE').length,
    unassigned: filtered.filter((event) => event.eventType === 'WORK_ORDER' && !event.primaryPersonId && !event.primaryTeamId && !TERMINAL.has(event.status.toUpperCase())).length,
    unscheduled: unscheduled.length,
    locked: filtered.filter((event) => event.eventType === 'WORK_ORDER' && event.scheduleLocked).length,
  }), [filtered, unscheduled.length])

  function changePeriod(direction: number) {
    const next = new Date(cursor)
    if (mode === 'month') next.setMonth(next.getMonth() + direction)
    else if (mode === 'week') next.setDate(next.getDate() + direction * 7)
    else next.setDate(next.getDate() + direction)
    setCursor(startOfDay(next))
  }

  async function requestMove(event: LiveSchedulerEvent, targetDay: Date) {
    if (basis !== 'start' || !canManage || event.eventType !== 'WORK_ORDER' || event.scheduleLocked || TERMINAL.has(event.status.toUpperCase())) return
    const moved = moveEventToDay(event, targetDay)
    setError(''); setMessage('')
    try {
      const conflicts = await loadSchedulerConflicts({ workOrderId: event.workOrderId, startAt: moved.startAt, endAt: moved.endAt, personId: event.primaryPersonId, teamId: event.primaryTeamId })
      if (conflicts.length) return setPendingMove({ event, ...moved, conflicts })
      await commitMove(event, moved.startAt, moved.endAt, false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra xung đột lịch.') }
  }

  async function commitMove(event: LiveSchedulerEvent, startAt: string, endAt: string, allowConflict: boolean) {
    setSaving(true); setError('')
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
      setPendingMove(null); setSelected(null); setMessage(`Đã cập nhật lịch ${event.workOrderId}.`); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật lịch.') }
    finally { setSaving(false) }
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

  const periodLabel = mode === 'month'
    ? formatMonth(cursor)
    : mode === 'week'
      ? `${formatDayHeading(period.start)} – ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(addDays(period.end, -1))}`
      : formatDayHeading(cursor)

  return <section className="scheduler-workspace" aria-labelledby="scheduler-title">
    <header className="scheduler-header">
      <div><p className="eyebrow">Scheduler</p><h2 id="scheduler-title">Lịch trình</h2><p>Điều phối Work Order và theo dõi các mốc Preventive Maintenance trong cùng một lịch.</p></div>
      <div className="scheduler-header-actions"><button type="button" onClick={() => void refresh()} disabled={loading}>Làm mới</button></div>
    </header>

    <div className="scheduler-controlbar">
      <div className="scheduler-basis-switch" role="group" aria-label="Cơ sở hiển thị lịch">
        <button type="button" className={basis === 'start' ? 'active' : ''} onClick={() => setBasis('start')}><strong>Ngày thực hiện</strong><small>Điều phối / kéo thả</small></button>
        <button type="button" className={basis === 'due' ? 'active' : ''} onClick={() => setBasis('due')}><strong>Ngày đến hạn</strong><small>Kế hoạch / tuân thủ</small></button>
      </div>
      <div className="scheduler-risk-strip" aria-label="Rủi ro lịch trình">
        <span className={riskCounts.overdue ? 'risk' : ''}>Quá hạn <b>{riskCounts.overdue}</b></span>
        <span className={riskCounts.unassigned ? 'risk' : ''}>Chưa phân công <b>{riskCounts.unassigned}</b></span>
        <span className={riskCounts.unscheduled ? 'risk' : ''}>Chưa xếp lịch <b>{riskCounts.unscheduled}</b></span>
        <span>Đã khóa <b>{riskCounts.locked}</b></span>
      </div>
    </div>

    <div className="scheduler-toolbar">
      <div className="scheduler-period-nav">
        <button type="button" aria-label="Kỳ trước" onClick={() => changePeriod(-1)}>‹</button>
        <button type="button" onClick={() => setCursor(startOfDay(new Date()))}>Hôm nay</button>
        <button type="button" aria-label="Kỳ sau" onClick={() => changePeriod(1)}>›</button>
        <strong>{periodLabel}</strong>
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

    {basis === 'due' ? <div className="scheduler-mode-note">Chế độ <strong>Ngày đến hạn</strong> dùng để kiểm soát kế hoạch. Kéo thả bị khóa để không vô tình thay đổi ngày thực hiện.</div> : null}
    {message ? <div className="scheduler-feedback" role="status">{message}</div> : null}
    {error ? <div className="scheduler-feedback error" role="alert">{error}</div> : null}

    <div className={`scheduler-layout${showUnscheduled ? '' : ' tray-hidden'}`}>
      {showUnscheduled ? <aside className="scheduler-unscheduled" aria-label="Công việc chưa xếp lịch">
        <header><div><strong>Chưa xếp lịch</strong><small>{basis === 'start' ? 'Kéo Work Order vào lịch' : 'Work Order chưa có ngày thực hiện'}</small></div><span>{unscheduled.length}</span></header>
        <div className="scheduler-unscheduled-list">{unscheduled.length ? unscheduled.map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} onSelect={setSelected} />) : <div className="scheduler-empty">Không có công việc chưa xếp lịch.</div>}</div>
      </aside> : null}

      <div className="scheduler-calendar-wrap">
        {loading ? <div className="scheduler-state" role="status">Đang tải lịch…</div> : mode === 'month'
          ? <MonthCalendar days={calendarDays} cursor={cursor} scheduled={scheduled} basis={basis} canManage={canManage} onDrop={onDrop} onSelect={setSelected} />
          : <TimeCalendar days={calendarDays} scheduled={scheduled} basis={basis} canManage={canManage} onDrop={onDrop} onSelect={setSelected} />}
      </div>
    </div>

    {selected ? <SchedulerDetail event={selected} basis={basis} canManage={canManage} saving={saving} onClose={() => setSelected(null)} onSave={saveFromDetail} /> : null}
    {pendingMove ? <ConflictDialog pending={pendingMove} saving={saving} onCancel={() => setPendingMove(null)} onConfirm={() => void commitMove(pendingMove.event, pendingMove.startAt, pendingMove.endAt, true)} /> : null}
  </section>
}

function MonthCalendar({ days, cursor, scheduled, basis, canManage, onDrop, onSelect }: { days: Date[]; cursor: Date; scheduled: LiveSchedulerEvent[]; basis: ScheduleBasis; canManage: boolean; onDrop: (event: DragEvent<HTMLDivElement>, day: Date) => void; onSelect: (event: LiveSchedulerEvent) => void }) {
  return <><div className="scheduler-weekdays month" aria-hidden="true">{days.slice(0, 7).map((day) => <span key={dateKey(day)}>{WEEKDAY[day.getDay()]}</span>)}</div><div className="scheduler-calendar-grid month">{days.map((day) => {
    const dayEvents = scheduled.filter((event) => sameDay(displayDate(event, basis), day)).toSorted((a, b) => displayDate(a, basis).localeCompare(displayDate(b, basis)))
    const outsideMonth = day.getMonth() !== cursor.getMonth()
    const today = dateKey(day) === dateKey(new Date())
    return <div key={dateKey(day)} className={`scheduler-day${outsideMonth ? ' outside' : ''}${today ? ' today' : ''}`} onDragOver={(event) => { if (basis === 'start' && canManage) event.preventDefault() }} onDrop={(event) => onDrop(event, day)}>
      <div className="scheduler-day-heading"><span>{day.getDate()}</span>{today ? <small>Hôm nay</small> : null}</div>
      <div className="scheduler-day-events">{dayEvents.slice(0, 5).map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} compact onSelect={onSelect} />)}{dayEvents.length > 5 ? <button className="scheduler-more" type="button">+{dayEvents.length - 5} công việc</button> : null}</div>
    </div>
  })}</div></>
}

function TimeCalendar({ days, scheduled, basis, canManage, onDrop, onSelect }: { days: Date[]; scheduled: LiveSchedulerEvent[]; basis: ScheduleBasis; canManage: boolean; onDrop: (event: DragEvent<HTMLDivElement>, day: Date) => void; onSelect: (event: LiveSchedulerEvent) => void }) {
  return <div className="scheduler-time-grid-shell">
    <div className="scheduler-time-header"><span className="scheduler-time-corner">GMT+7</span>{days.map((day) => <strong key={dateKey(day)} className={dateKey(day) === dateKey(new Date()) ? 'today' : ''}>{WEEKDAY[day.getDay()]}<small>{day.getDate()}/{day.getMonth() + 1}</small></strong>)}</div>
    <div className="scheduler-time-body">
      <div className="scheduler-time-axis">{GRID_HOURS.map((hour) => <span key={hour}>{pad(hour)}:00</span>)}</div>
      {days.map((day) => {
        const dayEvents = scheduled.filter((event) => sameDay(displayDate(event, basis), day))
        return <div key={dateKey(day)} className="scheduler-time-day" onDragOver={(event) => { if (basis === 'start' && canManage) event.preventDefault() }} onDrop={(event) => onDrop(event, day)}>
          <div className="scheduler-hour-lines">{GRID_HOURS.map((hour) => <i key={hour} />)}</div>
          <div className="scheduler-time-events">{dayEvents.map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} style={timeGridStyle(event, basis)} onSelect={onSelect} />)}</div>
        </div>
      })}
    </div>
  </div>
}

function SchedulerEventCard({ event, basis, canManage, compact = false, style, onSelect }: { event: LiveSchedulerEvent; basis: ScheduleBasis; canManage: boolean; compact?: boolean; style?: CSSProperties; onSelect: (event: LiveSchedulerEvent) => void }) {
  const draggable = basis === 'start' && canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && !TERMINAL.has(event.status.toUpperCase())
  const shownDate = displayDate(event, basis)
  return <button type="button" style={style} className={`scheduler-event ${event.eventType === 'PM_DUE' ? 'pm' : 'wo'} priority-${(event.priority || 'normal').toLowerCase()}${compact ? ' compact' : ''}`} draggable={draggable} onDragStart={(dragEvent) => { dragEvent.dataTransfer.effectAllowed = 'move'; dragEvent.dataTransfer.setData('text/cev-scheduler-event', event.eventId) }} onClick={() => onSelect(event)} title={`${event.eventId} · ${event.equipmentId}`}>
    <span className="scheduler-event-kicker">{event.eventType === 'PM_DUE' ? 'PM' : event.workOrderId || 'WO'}{event.scheduleLocked ? ' · 🔒' : ''}</span>
    <strong>{event.title || (event.eventType === 'PM_DUE' ? 'Bảo trì phòng ngừa' : 'Lệnh công việc')}</strong>
    {!compact ? <span>{event.equipmentId}{event.primaryPersonName ? ` · ${event.primaryPersonName}` : event.primaryTeamName ? ` · ${event.primaryTeamName}` : ''}</span> : null}
    <small>{event.unscheduled ? 'Chưa xếp lịch' : formatShortDate(shownDate)} · {statusLabel(event.status)}</small>
  </button>
}

function SchedulerDetail({ event, basis, canManage, saving, onClose, onSave }: { event: LiveSchedulerEvent; basis: ScheduleBasis; canManage: boolean; saving: boolean; onClose: () => void; onSave: (event: LiveSchedulerEvent, start: string, end: string) => Promise<void> }) {
  const [startValue, setStartValue] = useState(() => event.startAt ? toLocalInput(event.startAt) : '')
  const [endValue, setEndValue] = useState(() => event.endAt ? toLocalInput(event.endAt) : '')
  const editable = basis === 'start' && canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && !TERMINAL.has(event.status.toUpperCase())
  const dueValue = sourceDate(event)
  return <div className="scheduler-layer" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}><aside className="scheduler-drawer" role="dialog" aria-modal="true" aria-labelledby="scheduler-detail-title">
    <header><div><p className="eyebrow">{event.eventType === 'PM_DUE' ? 'Preventive Maintenance' : 'Work Order'}</p><h2 id="scheduler-detail-title">{event.title || event.eventId}</h2><span>{event.eventId}</span></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header>
    <div className="scheduler-drawer-body">
      <dl>
        <div><dt>Thiết bị</dt><dd><strong>{event.equipmentId}</strong><span>{event.equipmentName || '—'}</span></dd></div>
        <div><dt>Trạng thái</dt><dd>{statusLabel(event.status)}</dd></div>
        <div><dt>Ưu tiên</dt><dd>{event.priority || '—'}</dd></div>
        <div><dt>Địa điểm</dt><dd>{event.locationName || '—'}</dd></div>
        <div><dt>Người phụ trách</dt><dd>{event.primaryPersonName || '—'}</dd></div>
        <div><dt>Nhóm</dt><dd>{event.primaryTeamName || '—'}</dd></div>
      </dl>
      <section className="scheduler-date-summary"><div><span>Ngày thực hiện</span><strong>{formatShortDate(event.startAt)}</strong></div><div><span>Ngày đến hạn</span><strong>{formatShortDate(event.eventType === 'PM_DUE' ? event.startAt : dueValue)}</strong></div></section>
      <div className="scheduler-time-editor"><label><span>Bắt đầu</span><input type="datetime-local" value={startValue} disabled={!editable} onChange={(changeEvent) => setStartValue(changeEvent.target.value)} /></label><label><span>Kết thúc</span><input type="datetime-local" value={endValue} disabled={!editable} onChange={(changeEvent) => setEndValue(changeEvent.target.value)} /></label></div>
      {basis === 'due' ? <p className="scheduler-readonly-hint">Đang xem theo ngày đến hạn. Chuyển sang <strong>Ngày thực hiện</strong> để reschedule Work Order.</p> : null}
    </div>
    <footer><button type="button" onClick={onClose}>Đóng</button>{editable ? <button className="primary" type="button" disabled={saving || !startValue || !endValue} onClick={() => void onSave(event, startValue, endValue)}>{saving ? 'Đang lưu…' : 'Lưu lịch'}</button> : null}</footer>
  </aside></div>
}

function ConflictDialog({ pending, saving, onCancel, onConfirm }: { pending: PendingMove; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="scheduler-layer conflict" role="presentation"><section className="scheduler-conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="scheduler-conflict-title">
    <header><div><p className="eyebrow">Cảnh báo xung đột</p><h2 id="scheduler-conflict-title">Lịch đang trùng nguồn lực</h2></div></header>
    <div className="scheduler-conflict-body"><p>Hệ thống phát hiện {pending.conflicts.length} xung đột cho <strong>{pending.event.workOrderId}</strong>. Kiểm tra trước khi ghi đè lịch.</p><ul>{pending.conflicts.map((conflict) => <li key={`${conflict.conflictType}-${conflict.conflictingWorkOrderId}-${conflict.resourceId}`}><strong>{conflict.conflictType}</strong><span>{conflict.resourceName || conflict.resourceId}</span><small>{conflict.conflictingWorkOrderId} · {formatShortDate(conflict.plannedStartAt)} · {conflict.title}</small></li>)}</ul></div>
    <footer><button type="button" onClick={onCancel}>Hủy</button><button className="danger" type="button" disabled={saving} onClick={onConfirm}>{saving ? 'Đang lưu…' : 'Vẫn xếp lịch'}</button></footer>
  </section></div>
}

export const schedulerDateUtils = { dateKey, startOfWeek, startOfMonthGrid, moveEventToDay, displayDate }
