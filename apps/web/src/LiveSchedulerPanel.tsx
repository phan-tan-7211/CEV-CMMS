import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import './LiveSchedulerPanel.css'
import { useAppRole } from './auth/AppRoleContext'
import {
  loadSchedulerConflicts,
  loadSchedulerEvents,
  loadSchedulerOptions,
  rescheduleWorkOrder,
  setScheduleLock,
  type SchedulerEvent,
  type SchedulerOption,
  type SchedulerView,
} from './data/liveScheduler'

const HOUR_START = 6
const HOUR_END = 22

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }
function addDays(date: Date, count: number) { const next = new Date(date); next.setDate(next.getDate() + count); return next }
function startOfWeek(date: Date) {
  const day = startOfDay(date)
  const weekday = day.getDay() || 7
  return addDays(day, 1 - weekday)
}
function startOfMonthGrid(date: Date) { return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)) }
function endOfMonthGrid(date: Date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return addDays(startOfWeek(last), 7)
}
function toIso(date: Date) { return date.toISOString() }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function sameDay(value: string, date: Date) {
  if (!value) return false
  const parsed = new Date(value)
  return parsed.getFullYear() === date.getFullYear() && parsed.getMonth() === date.getMonth() && parsed.getDate() === date.getDate()
}
function timeText(value: string) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—' }
function dateTimeText(value: string) { return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa xếp lịch' }
function durationMs(event: SchedulerEvent) {
  if (!event.startAt || !event.endAt) return 60 * 60 * 1000
  const duration = new Date(event.endAt).getTime() - new Date(event.startAt).getTime()
  return Number.isFinite(duration) && duration > 0 ? duration : 60 * 60 * 1000
}
function priorityClass(priority: string) { return `priority-${(priority || 'normal').toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }

function rangeFor(view: SchedulerView, anchor: Date) {
  if (view === 'DAY') {
    const start = startOfDay(anchor)
    return { start, end: addDays(start, 1) }
  }
  if (view === 'WEEK') {
    const start = startOfWeek(anchor)
    return { start, end: addDays(start, 7) }
  }
  return { start: startOfMonthGrid(anchor), end: endOfMonthGrid(anchor) }
}

function viewTitle(view: SchedulerView, anchor: Date) {
  if (view === 'DAY') return anchor.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  if (view === 'WEEK') {
    const start = startOfWeek(anchor)
    const end = addDays(start, 6)
    return `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`
  }
  return anchor.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

function EventCard({ event, canManage, onSelect, onDragStart }: {
  event: SchedulerEvent
  canManage: boolean
  onSelect: (event: SchedulerEvent) => void
  onDragStart: (event: SchedulerEvent) => void
}) {
  const movable = canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && Boolean(event.workOrderId)
  return <button
    type="button"
    className={`scheduler-event ${event.eventType === 'PM_DUE' ? 'pm-due' : ''} ${priorityClass(event.priority)}`}
    draggable={movable}
    onDragStart={(drag) => { if (movable) { drag.dataTransfer.effectAllowed = 'move'; onDragStart(event) } }}
    onClick={() => onSelect(event)}
    title={`${event.title} · ${event.equipmentName || event.equipmentId}`}
  >
    <span className="scheduler-event-time">{event.unscheduled ? 'CHƯA XẾP' : timeText(event.startAt)}</span>
    <strong>{event.title}</strong>
    <small>{event.equipmentId}{event.primaryPersonName ? ` · ${event.primaryPersonName}` : ''}</small>
    {event.scheduleLocked || event.eventType === 'PM_DUE' ? <span className="scheduler-lock" aria-label="Đã khóa">●</span> : null}
  </button>
}

export function LiveSchedulerPanel() {
  const role = useAppRole()
  const canManage = ['SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role)
  const canLock = ['MANAGER', 'ADMIN'].includes(role)
  const [view, setView] = useState<SchedulerView>('WEEK')
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<SchedulerEvent[]>([])
  const [locations, setLocations] = useState<SchedulerOption[]>([])
  const [people, setPeople] = useState<SchedulerOption[]>([])
  const [teams, setTeams] = useState<SchedulerOption[]>([])
  const [locationId, setLocationId] = useState('')
  const [personId, setPersonId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [selected, setSelected] = useState<SchedulerEvent | null>(null)
  const [dragged, setDragged] = useState<SchedulerEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await loadSchedulerEvents({
        startAt: toIso(range.start), endAt: toIso(range.end), locationId, personId, teamId, includeUnscheduled: true,
      })
      setEvents(rows)
      setSelected((current) => current ? rows.find((row) => row.eventId === current.eventId) || null : null)
      setError('')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải lịch trình')
    } finally { setLoading(false) }
  }, [locationId, personId, range.end, range.start, teamId])

  useEffect(() => {
    loadSchedulerOptions().then((options) => {
      setLocations(options.locations); setPeople(options.people); setTeams(options.teams)
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không thể tải bộ lọc lịch'))
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const scheduled = useMemo(() => events.filter((event) => !event.unscheduled), [events])
  const unscheduled = useMemo(() => events.filter((event) => event.unscheduled && event.eventType === 'WORK_ORDER'), [events])

  async function moveWorkOrder(event: SchedulerEvent, start: Date, end = new Date(start.getTime() + durationMs(event))) {
    if (!canManage || event.eventType !== 'WORK_ORDER' || !event.workOrderId || event.scheduleLocked) return
    setSaving(true); setMessage('')
    try {
      const conflicts = await loadSchedulerConflicts(event.workOrderId, toIso(start), toIso(end), event.primaryPersonId, event.primaryTeamId)
      let allowConflict = false
      if (conflicts.length) {
        const summary = conflicts.slice(0, 5).map((item) => `${item.conflictType}: ${item.resourceName} · ${item.conflictingWorkOrderId}`).join('\n')
        allowConflict = window.confirm(`Phát hiện ${conflicts.length} xung đột lịch:\n\n${summary}\n\nVẫn xếp lịch?`)
        if (!allowConflict) return
      }
      await rescheduleWorkOrder({
        workOrderId: event.workOrderId, startAt: toIso(start), endAt: toIso(end),
        personId: event.primaryPersonId, teamId: event.primaryTeamId, allowConflict,
      })
      setMessage(`Đã xếp ${event.workOrderId}: ${dateTimeText(toIso(start))}`)
      await refresh()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể xếp lịch Work Order')
    } finally { setSaving(false); setDragged(null) }
  }

  function onDrop(event: DragEvent, slot: Date) {
    event.preventDefault()
    if (dragged) void moveWorkOrder(dragged, slot)
  }

  async function resizeSelected(minutes: number) {
    if (!selected?.workOrderId || !selected.startAt || !selected.endAt || !canManage) return
    const start = new Date(selected.startAt)
    const currentEnd = new Date(selected.endAt)
    const end = new Date(currentEnd.getTime() + minutes * 60_000)
    if (end <= start) return
    await moveWorkOrder(selected, start, end)
  }

  async function unscheduleSelected() {
    if (!selected?.workOrderId || !canManage || selected.scheduleLocked) return
    setSaving(true)
    try {
      await rescheduleWorkOrder({ workOrderId: selected.workOrderId, startAt: null, endAt: null })
      setMessage(`Đã đưa ${selected.workOrderId} về Chưa xếp lịch`)
      setSelected(null)
      await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể bỏ lịch') }
    finally { setSaving(false) }
  }

  async function toggleLock() {
    if (!selected?.workOrderId || !canLock) return
    setSaving(true)
    try {
      await setScheduleLock(selected.workOrderId, !selected.scheduleLocked)
      await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể thay đổi khóa lịch') }
    finally { setSaving(false) }
  }

  function shift(direction: -1 | 1) {
    setAnchor((current) => {
      const next = new Date(current)
      if (view === 'DAY') next.setDate(next.getDate() + direction)
      else if (view === 'WEEK') next.setDate(next.getDate() + direction * 7)
      else next.setMonth(next.getMonth() + direction)
      return next
    })
  }

  const calendar = view === 'MONTH'
    ? <MonthGrid rangeStart={range.start} anchor={anchor} events={scheduled} canManage={canManage} onSelect={setSelected} onDragStart={setDragged} onDrop={onDrop} />
    : <TimeGrid view={view} rangeStart={range.start} events={scheduled} canManage={canManage} onSelect={setSelected} onDragStart={setDragged} onDrop={onDrop} />

  return <div className="live-scheduler-page">
    <header className="scheduler-command">
      <div><p className="eyebrow">UpKeep parity · Scheduler</p><h2>Lịch trình công việc</h2><p>Kéo Work Order vào lịch, đổi thời lượng, xem PM đến hạn và phát hiện xung đột tài nguyên.</p></div>
      <div className="scheduler-command-actions"><button type="button" onClick={() => setAnchor(new Date())}>Hôm nay</button><button type="button" onClick={() => void refresh()}>Làm mới</button></div>
    </header>

    <section className="scheduler-toolbar" aria-label="Bộ điều khiển lịch">
      <div className="scheduler-nav"><button type="button" onClick={() => shift(-1)}>‹</button><strong>{viewTitle(view, anchor)}</strong><button type="button" onClick={() => shift(1)}>›</button></div>
      <div className="scheduler-view-switch">{(['MONTH','WEEK','DAY'] as SchedulerView[]).map((mode) => <button key={mode} type="button" className={view === mode ? 'active' : ''} onClick={() => setView(mode)}>{mode === 'MONTH' ? 'Tháng' : mode === 'WEEK' ? 'Tuần' : 'Ngày'}</button>)}</div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Lọc địa điểm"><option value="">Tất cả địa điểm</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Lọc kỹ thuật viên"><option value="">Tất cả kỹ thuật viên</option>{people.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Lọc nhóm"><option value="">Tất cả nhóm</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    </section>

    {message ? <div className="scheduler-message" role="status">{message}</div> : null}
    {error ? <div className="scheduler-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div> : null}
    {!canManage ? <div className="scheduler-readonly">Vai trò {role}: xem lịch. Kéo-thả/reschedule cần Supervisor, Manager hoặc Admin.</div> : null}

    <div className="scheduler-layout">
      <aside className="scheduler-unscheduled">
        <header><div><p className="eyebrow">Backlog</p><h3>Chưa xếp lịch</h3></div><span>{unscheduled.length}</span></header>
        <p>Kéo Work Order từ đây vào ngày/giờ cần thực hiện.</p>
        <div className="scheduler-unscheduled-list">
          {unscheduled.map((event) => <EventCard key={event.eventId} event={event} canManage={canManage} onSelect={setSelected} onDragStart={setDragged} />)}
          {!loading && !unscheduled.length ? <div className="scheduler-empty">Không có Work Order chưa xếp lịch trong bộ lọc hiện tại.</div> : null}
        </div>
      </aside>
      <section className="scheduler-calendar" aria-busy={loading}>{loading ? <div className="scheduler-loading">Đang tải lịch…</div> : calendar}</section>
    </div>

    {selected ? <section className="scheduler-detail" aria-label="Chi tiết sự kiện">
      <header><div><span>{selected.eventType === 'PM_DUE' ? 'PM ĐẾN HẠN' : selected.workOrderId}</span><h3>{selected.title}</h3></div><button type="button" onClick={() => setSelected(null)}>×</button></header>
      <div className="scheduler-detail-grid">
        <div><span>Thiết bị</span><b>{selected.equipmentId}</b><small>{selected.equipmentName}</small></div>
        <div><span>Thời gian</span><b>{dateTimeText(selected.startAt)}</b><small>{selected.endAt ? `→ ${dateTimeText(selected.endAt)}` : 'Chưa xếp lịch'}</small></div>
        <div><span>Người phụ trách</span><b>{selected.primaryPersonName || 'Chưa giao'}</b><small>{selected.primaryTeamName || 'Chưa có nhóm'}</small></div>
        <div><span>Trạng thái</span><b>{selected.status}</b><small>{selected.priority || 'Không đặt ưu tiên'}</small></div>
      </div>
      {selected.eventType === 'WORK_ORDER' ? <footer>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('cev:navigate', { detail: { view: 'work-orders', equipmentId: selected.equipmentId } }))}>Mở Work Order</button>
        {canManage && selected.startAt && !selected.scheduleLocked ? <><button type="button" disabled={saving} onClick={() => void resizeSelected(-30)}>−30 phút</button><button type="button" disabled={saving} onClick={() => void resizeSelected(30)}>+30 phút</button><button type="button" disabled={saving} onClick={() => void unscheduleSelected()}>Bỏ lịch</button></> : null}
        {canLock ? <button type="button" disabled={saving} onClick={() => void toggleLock()}>{selected.scheduleLocked ? 'Mở khóa lịch' : 'Khóa lịch'}</button> : null}
      </footer> : <footer><span>PM due được quản lý từ kế hoạch PM; Scheduler chỉ hiển thị và không kéo trực tiếp.</span></footer>}
    </section> : null}
  </div>
}

function MonthGrid({ rangeStart, anchor, events, canManage, onSelect, onDragStart, onDrop }: {
  rangeStart: Date; anchor: Date; events: SchedulerEvent[]; canManage: boolean
  onSelect: (event: SchedulerEvent) => void; onDragStart: (event: SchedulerEvent) => void; onDrop: (event: DragEvent, slot: Date) => void
}) {
  const days = Array.from({ length: 42 }, (_, index) => addDays(rangeStart, index))
  return <div className="scheduler-month-grid">
    {['T2','T3','T4','T5','T6','T7','CN'].map((label) => <div className="scheduler-weekday" key={label}>{label}</div>)}
    {days.map((day) => {
      const dayEvents = events.filter((event) => sameDay(event.startAt, day))
      const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8, 0, 0)
      return <div key={dayKey(day)} className={`scheduler-month-day ${day.getMonth() === anchor.getMonth() ? '' : 'outside'}`} onDragOver={(e) => { if (canManage) e.preventDefault() }} onDrop={(e) => onDrop(e, slot)}>
        <div className="scheduler-day-number">{day.getDate()}</div>
        <div className="scheduler-day-events">{dayEvents.slice(0, 6).map((event) => <EventCard key={event.eventId} event={event} canManage={canManage} onSelect={onSelect} onDragStart={onDragStart} />)}{dayEvents.length > 6 ? <span className="scheduler-more">+{dayEvents.length - 6} mục</span> : null}</div>
      </div>
    })}
  </div>
}

function TimeGrid({ view, rangeStart, events, canManage, onSelect, onDragStart, onDrop }: {
  view: SchedulerView; rangeStart: Date; events: SchedulerEvent[]; canManage: boolean
  onSelect: (event: SchedulerEvent) => void; onDragStart: (event: SchedulerEvent) => void; onDrop: (event: DragEvent, slot: Date) => void
}) {
  const days = Array.from({ length: view === 'DAY' ? 1 : 7 }, (_, index) => addDays(rangeStart, index))
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index)
  return <div className="scheduler-time-grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(150px, 1fr))` }}>
    <div className="scheduler-time-corner" />
    {days.map((day) => <div key={dayKey(day)} className="scheduler-time-day-head"><b>{day.toLocaleDateString('vi-VN', { weekday: 'short' })}</b><span>{day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span></div>)}
    {hours.flatMap((hour) => [
      <div key={`label-${hour}`} className="scheduler-hour-label">{String(hour).padStart(2, '0')}:00</div>,
      ...days.map((day) => {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)
        const slotEvents = events.filter((event) => sameDay(event.startAt, day) && new Date(event.startAt).getHours() === hour)
        return <div key={`${dayKey(day)}-${hour}`} className="scheduler-hour-slot" onDragOver={(e) => { if (canManage) e.preventDefault() }} onDrop={(e) => onDrop(e, slot)}>
          {slotEvents.map((event) => <EventCard key={event.eventId} event={event} canManage={canManage} onSelect={onSelect} onDragStart={onDragStart} />)}
        </div>
      }),
    ])}
  </div>
}
