import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
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
type SurfaceMode = 'calendar' | 'resources'
type ResourceKind = 'person' | 'team' | 'equipment'
type AssignmentOverride = { personId?: string; teamId?: string }
type PendingMove = { event: LiveSchedulerEvent; startAt: string; endAt: string; personId: string; teamId: string; conflicts: SchedulerConflict[] }
type ResourceRow = { id: string; label: string; secondary: string }
type MonthExpansion = { day: Date; events: LiveSchedulerEvent[] } | null

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const TERMINAL = new Set(['COMPLETED', 'COMPLETE', 'VERIFIED', 'RELEASED', 'CANCELLED', 'CLOSED'])
const GRID_START_HOUR = 6
const GRID_END_HOUR = 22
const GRID_HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, index) => GRID_START_HOUR + index)
const SNAP_MINUTES = 30
const UNASSIGNED = '__UNASSIGNED__'

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
function formatTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'Mở', REQUESTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', PLANNED: 'Đã lên lịch', ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang làm', ON_HOLD: 'Tạm dừng', COMPLETED: 'Hoàn tất', VERIFIED: 'Đã xác nhận', DUE: 'Đến hạn PM', OVERDUE: 'Quá hạn',
  }
  return labels[status.toUpperCase()] || status || '—'
}
function sourceString(event: LiveSchedulerEvent, keys: string[]) {
  for (const key of keys) {
    const value = event.sourceData[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}
function sourceBoolean(event: LiveSchedulerEvent, keys: string[]) {
  for (const key of keys) {
    const value = event.sourceData[key]
    if (value === true) return true
    if (typeof value === 'string' && ['TRUE', '1', 'YES'].includes(value.toUpperCase())) return true
  }
  return false
}
function sourceDate(event: LiveSchedulerEvent) {
  return sourceString(event, ['dueAt', 'due_at', 'dueDate', 'due_date', 'plannedDueAt', 'planned_due_at', 'deadlineAt', 'deadline_at'])
}
function pmState(event: LiveSchedulerEvent) {
  const dueAt = sourceString(event, ['next_due_at', 'nextDueAt', 'due_at', 'dueAt']) || event.startAt
  const triggerAt = sourceString(event, ['next_trigger_at', 'nextTriggerAt', 'trigger_at', 'triggerAt'])
  const generatedWorkOrderId = sourceString(event, ['last_generated_work_order_id', 'lastGeneratedWorkOrderId', 'generated_work_order_id', 'generatedWorkOrderId', 'work_order_id'])
  const overdue = event.status.toUpperCase() === 'OVERDUE' || sourceBoolean(event, ['is_overdue', 'overdue'])
  return { dueAt, triggerAt, generatedWorkOrderId, overdue }
}
function displayDate(event: LiveSchedulerEvent, basis: ScheduleBasis) {
  if (basis === 'start') return event.startAt
  if (event.eventType === 'PM_DUE') return pmState(event).dueAt || event.startAt
  return sourceDate(event) || event.endAt || event.startAt
}
function sameDay(value: string, date: Date) {
  if (!value) return false
  const candidate = new Date(value)
  return !Number.isNaN(candidate.getTime()) && dateKey(candidate) === dateKey(date)
}
function eventDurationMs(event: LiveSchedulerEvent) {
  const start = event.startAt ? Date.parse(event.startAt) : Number.NaN
  const end = event.endAt ? Date.parse(event.endAt) : Number.NaN
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) return Math.max(end - start, SNAP_MINUTES * 60_000)
  return 60 * 60_000
}
function moveEventToDay(event: LiveSchedulerEvent, target: Date) {
  const start = event.startAt ? new Date(event.startAt) : new Date(target)
  const nextStart = new Date(target)
  if (event.startAt) nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
  else nextStart.setHours(8, 0, 0, 0)
  return { startAt: nextStart.toISOString(), endAt: new Date(nextStart.getTime() + eventDurationMs(event)).toISOString() }
}
function moveEventToTime(event: LiveSchedulerEvent, target: Date) {
  const nextStart = new Date(target)
  nextStart.setSeconds(0, 0)
  return { startAt: nextStart.toISOString(), endAt: new Date(nextStart.getTime() + eventDurationMs(event)).toISOString() }
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
  const top = Math.max(0, Math.min(gridMinutes - SNAP_MINUTES, start - gridStart))
  const duration = Math.max(SNAP_MINUTES, Math.min(gridMinutes - top, end - start || 60))
  return { top: `${(top / gridMinutes) * 100}%`, height: `${(duration / gridMinutes) * 100}%` }
}
function overlapStyles(events: LiveSchedulerEvent[], basis: ScheduleBasis) {
  const sorted = [...events].sort((a, b) => eventMinutes(displayDate(a, basis)) - eventMinutes(displayDate(b, basis)))
  const result = new Map<string, CSSProperties>()
  let group: LiveSchedulerEvent[] = []
  let groupEnd = -1
  const flush = () => {
    if (!group.length) return
    const laneEnds: number[] = []
    const lanes = new Map<string, number>()
    for (const item of group) {
      const start = eventMinutes(displayDate(item, basis))
      const end = basis === 'start' && item.endAt ? Math.max(start + SNAP_MINUTES, eventMinutes(item.endAt)) : start + 60
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(end) } else laneEnds[lane] = end
      lanes.set(item.eventId, lane)
    }
    const count = Math.max(1, laneEnds.length)
    for (const item of group) {
      const lane = lanes.get(item.eventId) || 0
      const gap = 2
      result.set(item.eventId, { left: `calc(${(lane / count) * 100}% + ${gap}px)`, right: 'auto', width: `calc(${100 / count}% - ${gap * 2}px)` })
    }
    group = []
    groupEnd = -1
  }
  for (const item of sorted) {
    const start = eventMinutes(displayDate(item, basis))
    const end = basis === 'start' && item.endAt ? Math.max(start + SNAP_MINUTES, eventMinutes(item.endAt)) : start + 60
    if (group.length && start >= groupEnd) flush()
    group.push(item)
    groupEnd = Math.max(groupEnd, end)
  }
  flush()
  return result
}
function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
function eventHours(event: LiveSchedulerEvent) {
  if (!event.startAt || !event.endAt) return 0
  const start = Date.parse(event.startAt)
  const end = Date.parse(event.endAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return (end - start) / 3_600_000
}
function resourceId(event: LiveSchedulerEvent, kind: ResourceKind) {
  if (kind === 'person') return event.primaryPersonId || UNASSIGNED
  if (kind === 'team') return event.primaryTeamId || UNASSIGNED
  return event.equipmentId || UNASSIGNED
}
function resourceLabel(kind: ResourceKind) { return kind === 'person' ? 'Nhân sự' : kind === 'team' ? 'Nhóm' : 'Thiết bị' }
function schedulerUrlDate() {
  const value = new URLSearchParams(window.location.search).get('schedulerDate')
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? startOfDay(new Date()) : startOfDay(date)
}
function schedulerUrlPm() { return new URLSearchParams(window.location.search).get('pm')?.trim() || '' }
function snappedTimeFromPointer(event: DragEvent<HTMLDivElement>, day: Date) {
  const rect = event.currentTarget.getBoundingClientRect()
  const gridMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60
  const relativeY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
  const rawMinutes = rect.height ? (relativeY / rect.height) * gridMinutes : 0
  const snappedMinutes = Math.max(0, Math.min(gridMinutes - SNAP_MINUTES, Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES))
  const target = startOfDay(day)
  target.setMinutes(GRID_START_HOUR * 60 + snappedMinutes)
  return target
}
function snappedResizeEnd(clientY: number, dayElement: HTMLElement, startAt: string) {
  const rect = dayElement.getBoundingClientRect()
  const gridMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60
  const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top))
  const rawMinutes = rect.height ? (relativeY / rect.height) * gridMinutes : 0
  const snappedMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES
  const start = new Date(startAt)
  const startMinute = start.getHours() * 60 + start.getMinutes()
  const endMinute = Math.max(startMinute + SNAP_MINUTES, Math.min(GRID_END_HOUR * 60, GRID_START_HOUR * 60 + snappedMinutes))
  const end = startOfDay(start)
  end.setMinutes(endMinute)
  return end
}

export function MaintenanceSchedulerPanel() {
  const role = useAppRole()
  const canManage = canManageScheduler(role)
  const focusedPmId = useMemo(() => schedulerUrlPm(), [])
  const [mode, setMode] = useState<CalendarMode>('week')
  const [basis, setBasis] = useState<ScheduleBasis>(() => focusedPmId ? 'due' : 'start')
  const [surface, setSurface] = useState<SurfaceMode>('calendar')
  const [resourceKind, setResourceKind] = useState<ResourceKind>('person')
  const [cursor, setCursor] = useState(() => schedulerUrlDate())
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
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const period = useMemo(() => {
    if (surface === 'resources') { const start = startOfWeek(cursor); return { start, end: addDays(start, 7) } }
    if (mode === 'month') return { start: startOfMonthGrid(cursor), end: endOfMonthGrid(cursor) }
    if (mode === 'week') { const start = startOfWeek(cursor); return { start, end: addDays(start, 7) } }
    const start = startOfDay(cursor)
    return { start, end: addDays(start, 1) }
  }, [cursor, mode, surface])
  const periodStartMs = period.start.getTime()
  const periodEndMs = period.end.getTime()

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      setEvents(await loadSchedulerEvents({ startAt: new Date(periodStartMs).toISOString(), endAt: new Date(periodEndMs).toISOString(), includeUnscheduled: true }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải lịch bảo trì.')
    } finally { if (!silent) setLoading(false) }
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
      return [event.title, event.eventId, event.equipmentId, event.equipmentName, event.primaryPersonName, event.primaryTeamName, event.locationName].some((value) => value.toLocaleLowerCase('vi-VN').includes(needle))
    })
  }, [events, equipmentFilter, personFilter, query, teamFilter])
  const unscheduled = filtered.filter((event) => event.eventType === 'WORK_ORDER' && event.unscheduled)
  const scheduled = filtered.filter((event) => !event.unscheduled && !!displayDate(event, basis))
  const pmCounts = useMemo(() => ({
    total: filtered.filter((event) => event.eventType === 'PM_DUE').length,
    overdue: filtered.filter((event) => event.eventType === 'PM_DUE' && pmState(event).overdue).length,
    generated: filtered.filter((event) => event.eventType === 'PM_DUE' && !!pmState(event).generatedWorkOrderId).length,
  }), [filtered])
  const calendarDays = useMemo(() => {
    const count = surface === 'resources' ? 7 : mode === 'month' ? 42 : mode === 'week' ? 7 : 1
    const start = surface === 'resources' ? startOfWeek(cursor) : mode === 'month' ? startOfMonthGrid(cursor) : mode === 'week' ? startOfWeek(cursor) : startOfDay(cursor)
    return Array.from({ length: count }, (_, index) => addDays(start, index))
  }, [cursor, mode, surface])
  const resourceRows = useMemo<ResourceRow[]>(() => {
    const map = new Map<string, ResourceRow>()
    if (resourceKind !== 'equipment') map.set(UNASSIGNED, { id: UNASSIGNED, label: 'Chưa phân công', secondary: resourceKind === 'person' ? 'Chưa có người phụ trách' : 'Chưa có nhóm phụ trách' })
    for (const event of scheduled) {
      const id = resourceId(event, resourceKind)
      if (id === UNASSIGNED) continue
      const label = resourceKind === 'person' ? event.primaryPersonName || id : resourceKind === 'team' ? event.primaryTeamName || id : event.equipmentName || id
      map.set(id, { id, label, secondary: resourceKind === 'equipment' ? event.equipmentId : id })
    }
    return Array.from(map.values()).toSorted((a, b) => (a.id === UNASSIGNED ? -1 : b.id === UNASSIGNED ? 1 : a.label.localeCompare(b.label, 'vi')))
  }, [resourceKind, scheduled])
  const riskCounts = useMemo(() => ({
    overdue: filtered.filter((event) => event.status.toUpperCase() === 'OVERDUE').length,
    unassigned: filtered.filter((event) => event.eventType === 'WORK_ORDER' && !event.primaryPersonId && !event.primaryTeamId && !TERMINAL.has(event.status.toUpperCase())).length,
    unscheduled: unscheduled.length,
    locked: filtered.filter((event) => event.eventType === 'WORK_ORDER' && event.scheduleLocked).length,
  }), [filtered, unscheduled.length])

  function changePeriod(direction: number) {
    const next = new Date(cursor)
    if (surface === 'resources') next.setDate(next.getDate() + direction * 7)
    else if (mode === 'month') next.setMonth(next.getMonth() + direction)
    else if (mode === 'week') next.setDate(next.getDate() + direction * 7)
    else next.setDate(next.getDate() + direction)
    setCursor(startOfDay(next))
  }
  function openPmDetail(event: LiveSchedulerEvent) {
    const scheduleId = event.pmScheduleId || sourceString(event, ['schedule_id', 'scheduleId'])
    if (!scheduleId) return setSelected(event)
    const url = new URL(window.location.href)
    url.searchParams.set('phase3', 'maintenance')
    url.searchParams.set('pm', scheduleId)
    url.searchParams.delete('schedulerDate')
    window.history.replaceState({}, '', url)
    window.dispatchEvent(new CustomEvent('cev:navigate', { detail: { view: 'maintenance' } }))
  }
  function selectEvent(event: LiveSchedulerEvent) { event.eventType === 'PM_DUE' ? openPmDetail(event) : setSelected(event) }

  async function requestMove(event: LiveSchedulerEvent, target: Date, assignment?: AssignmentOverride, exactTime = false) {
    if (basis !== 'start' || !canManage || event.eventType !== 'WORK_ORDER' || event.scheduleLocked || TERMINAL.has(event.status.toUpperCase())) return
    const moved = exactTime ? moveEventToTime(event, target) : moveEventToDay(event, target)
    const personId = assignment?.personId ?? event.primaryPersonId
    const teamId = assignment?.teamId ?? event.primaryTeamId
    setError(''); setMessage('')
    try {
      const conflicts = await loadSchedulerConflicts({ workOrderId: event.workOrderId, startAt: moved.startAt, endAt: moved.endAt, personId, teamId })
      if (conflicts.length) return setPendingMove({ event, ...moved, personId, teamId, conflicts })
      await commitMove(event, moved.startAt, moved.endAt, false, { personId, teamId })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra xung đột lịch.') }
  }
  async function requestResize(event: LiveSchedulerEvent, endAt: string) {
    if (basis !== 'start' || !canManage || event.eventType !== 'WORK_ORDER' || !event.startAt || event.scheduleLocked || TERMINAL.has(event.status.toUpperCase())) return
    const personId = event.primaryPersonId
    const teamId = event.primaryTeamId
    setError(''); setMessage('')
    try {
      const conflicts = await loadSchedulerConflicts({ workOrderId: event.workOrderId, startAt: event.startAt, endAt, personId, teamId })
      if (conflicts.length) return setPendingMove({ event, startAt: event.startAt, endAt, personId, teamId, conflicts })
      await commitMove(event, event.startAt, endAt, false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra xung đột thời lượng.') }
  }
  async function commitMove(event: LiveSchedulerEvent, startAt: string, endAt: string, allowConflict: boolean, assignment?: AssignmentOverride) {
    const personId = assignment?.personId ?? event.primaryPersonId
    const teamId = assignment?.teamId ?? event.primaryTeamId
    const personName = personId ? personOptions.find(([id]) => id === personId)?.[1] || (personId === event.primaryPersonId ? event.primaryPersonName : personId) : ''
    const teamName = teamId ? teamOptions.find(([id]) => id === teamId)?.[1] || (teamId === event.primaryTeamId ? event.primaryTeamName : teamId) : ''
    const snapshot = events
    setSaving(true); setError(''); setPendingMove(null); setSelected(null)
    setEvents((current) => current.map((candidate) => candidate.eventId === event.eventId ? { ...candidate, startAt, endAt, unscheduled: false, primaryPersonId: personId, primaryPersonName: personName, primaryTeamId: teamId, primaryTeamName: teamName } : candidate))
    try {
      await rescheduleWorkOrder({ workOrderId: event.workOrderId, startAt, endAt, personId, teamId, allowConflict, note: allowConflict ? 'CEV Scheduler: supervisor accepted detected conflict' : surface === 'resources' ? 'CEV Scheduler resource planning' : 'CEV Scheduler drag/drop or resize' })
      setMessage(`Đã cập nhật lịch ${event.workOrderId}.`)
      void refresh(true)
    } catch (cause) {
      setEvents(snapshot)
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật lịch.')
    } finally { setSaving(false) }
  }
  async function unscheduleWorkOrder(event: LiveSchedulerEvent) {
    if (basis !== 'start' || !canManage || event.eventType !== 'WORK_ORDER' || event.unscheduled || event.scheduleLocked || TERMINAL.has(event.status.toUpperCase())) return
    const snapshot = events
    setSaving(true); setError(''); setSelected(null)
    setEvents((current) => current.map((candidate) => candidate.eventId === event.eventId ? { ...candidate, startAt: '', endAt: '', unscheduled: true } : candidate))
    try {
      await rescheduleWorkOrder({ workOrderId: event.workOrderId, startAt: null, endAt: null, personId: event.primaryPersonId, teamId: event.primaryTeamId, allowConflict: false, note: 'CEV Scheduler: moved back to unscheduled tray' })
      setMessage(`Đã hủy xếp lịch ${event.workOrderId}.`)
      void refresh(true)
    } catch (cause) {
      setEvents(snapshot)
      setError(cause instanceof Error ? cause.message : 'Không thể hủy xếp lịch.')
    } finally { setSaving(false) }
  }
  async function saveFromDetail(event: LiveSchedulerEvent, startValue: string, endValue: string) {
    if (!startValue || !endValue) return
    await commitMove(event, new Date(startValue).toISOString(), new Date(endValue).toISOString(), false)
  }
  function findDraggedEvent(event: DragEvent<HTMLElement>) {
    const eventId = event.dataTransfer.getData('text/cev-scheduler-event')
    return events.find((candidate) => candidate.eventId === eventId)
  }
  function onDrop(event: DragEvent<HTMLDivElement>, day: Date) { event.preventDefault(); const item = findDraggedEvent(event); if (item) void requestMove(item, day) }
  function onTimeDrop(event: DragEvent<HTMLDivElement>, day: Date) { event.preventDefault(); const item = findDraggedEvent(event); if (item) void requestMove(item, snappedTimeFromPointer(event, day), undefined, true) }
  function onResourceDrop(event: DragEvent<HTMLDivElement>, day: Date, row: ResourceRow) {
    event.preventDefault(); const item = findDraggedEvent(event); if (!item) return
    const assignment: AssignmentOverride = resourceKind === 'person' ? { personId: row.id === UNASSIGNED ? '' : row.id } : resourceKind === 'team' ? { teamId: row.id === UNASSIGNED ? '' : row.id } : {}
    void requestMove(item, day, assignment)
  }
  function onUnscheduledDrop(event: DragEvent<HTMLElement>) { event.preventDefault(); const item = findDraggedEvent(event); if (item) void unscheduleWorkOrder(item) }

  const periodLabel = surface === 'resources'
    ? `${formatDayHeading(period.start)} – ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(addDays(period.end, -1))}`
    : mode === 'month' ? formatMonth(cursor)
      : mode === 'week' ? `${formatDayHeading(period.start)} – ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(addDays(period.end, -1))}`
        : formatDayHeading(cursor)

  return <section className="scheduler-workspace" aria-labelledby="scheduler-title">
    <header className="scheduler-header">
      <div><p className="eyebrow">Scheduler</p><h2 id="scheduler-title">Lịch trình</h2><p>Điều phối Work Order và theo dõi các mốc Preventive Maintenance trong cùng một lịch.</p></div>
      <div className="scheduler-header-actions"><button type="button" onClick={() => void refresh()} disabled={loading}>Làm mới</button></div>
    </header>

    <div className="scheduler-surface-switch" role="group" aria-label="Kiểu lập kế hoạch">
      <button type="button" className={surface === 'calendar' ? 'active' : ''} onClick={() => setSurface('calendar')}><strong>Lịch</strong><small>Ngày / tuần / tháng</small></button>
      <button type="button" className={surface === 'resources' ? 'active' : ''} onClick={() => { setSurface('resources'); setMode('week') }}><strong>Nguồn lực</strong><small>Người / nhóm / thiết bị</small></button>
    </div>

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

    {pmCounts.total ? <div className="scheduler-pm-strip" aria-label="Tình trạng Preventive Maintenance"><span>PM trong kỳ <b>{pmCounts.total}</b></span><span className={pmCounts.overdue ? 'danger' : ''}>PM quá hạn <b>{pmCounts.overdue}</b></span><span>Đã sinh WO <b>{pmCounts.generated}</b></span></div> : null}

    <div className="scheduler-toolbar">
      <div className="scheduler-period-nav"><button type="button" aria-label="Kỳ trước" onClick={() => changePeriod(-1)}>‹</button><button type="button" onClick={() => setCursor(startOfDay(new Date()))}>Hôm nay</button><button type="button" aria-label="Kỳ sau" onClick={() => changePeriod(1)}>›</button><strong>{periodLabel}</strong></div>
      {surface === 'calendar' ? <div className="scheduler-view-switch" role="group" aria-label="Kiểu hiển thị lịch">{(['day', 'week', 'month'] as CalendarMode[]).map((item) => <button key={item} type="button" className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item === 'day' ? 'Ngày' : item === 'week' ? 'Tuần' : 'Tháng'}</button>)}</div>
        : <div className="scheduler-resource-switch" role="group" aria-label="Nhóm nguồn lực">{(['person', 'team', 'equipment'] as ResourceKind[]).map((item) => <button key={item} type="button" className={resourceKind === item ? 'active' : ''} onClick={() => setResourceKind(item)}>{resourceLabel(item)}</button>)}</div>}
    </div>

    <div className="scheduler-filterbar">
      <label className="scheduler-search"><span className="sr-only">Tìm kiếm lịch</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm Work Order, thiết bị, người phụ trách…" /></label>
      <label><span className="sr-only">Thiết bị</span><select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}><option value="">Tất cả thiết bị</option>{equipmentOptions.map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select></label>
      <label><span className="sr-only">Nhân sự</span><select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="">Tất cả nhân sự</option>{personOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label><span className="sr-only">Nhóm</span><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">Tất cả nhóm</option>{teamOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <button type="button" className={showUnscheduled ? 'active' : ''} onClick={() => setShowUnscheduled((current) => !current)}>Chưa xếp lịch {unscheduled.length ? `(${unscheduled.length})` : ''}</button>
    </div>

    {focusedPmId ? <div className="scheduler-mode-note"><strong>PM focus:</strong> lịch đã mở tại kỳ Next Due của PM. Nhấn card PM để quay lại đúng PM Detail.</div> : null}
    {basis === 'due' ? <div className="scheduler-mode-note">Chế độ <strong>Ngày đến hạn</strong> dùng để kiểm soát kế hoạch. Kéo thả bị khóa để không vô tình thay đổi ngày thực hiện.</div> : null}
    {surface === 'calendar' && basis === 'start' && mode !== 'month' ? <div className="scheduler-mode-note"><strong>Snap 30 phút:</strong> thả Work Order vào đúng vị trí thời gian; kéo mép dưới card để đổi thời lượng theo mốc 30 phút.</div> : null}
    {surface === 'resources' && basis === 'start' ? <div className="scheduler-mode-note"><strong>Resource Planning:</strong> kéo Work Order sang ô ngày của nhân sự hoặc nhóm để đổi lịch và phân công trong một thao tác. View Thiết bị chỉ đổi ngày, không đổi Equipment ID.</div> : null}
    {message ? <div className="scheduler-feedback" role="status">{message}</div> : null}
    {error ? <div className="scheduler-feedback error" role="alert">{error}</div> : null}

    <div className={`scheduler-layout${showUnscheduled ? '' : ' tray-hidden'}`}>
      {showUnscheduled ? <aside className="scheduler-unscheduled" aria-label="Công việc chưa xếp lịch" onDragOver={(event) => { if (basis === 'start' && canManage) event.preventDefault() }} onDrop={onUnscheduledDrop}>
        <header><div><strong>Chưa xếp lịch</strong><small>{basis === 'start' ? 'Kéo vào lịch · kéo từ lịch về đây để hủy xếp lịch' : 'Work Order chưa có ngày thực hiện'}</small></div><span>{unscheduled.length}</span></header>
        <div className="scheduler-unscheduled-list">{unscheduled.length ? unscheduled.map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} onSelect={selectEvent} />) : <div className="scheduler-empty">Không có công việc chưa xếp lịch.<br />Thả Work Order từ lịch vào đây để hủy xếp lịch.</div>}</div>
      </aside> : null}
      <div className="scheduler-calendar-wrap">
        {loading ? <div className="scheduler-state" role="status">Đang tải lịch…</div> : surface === 'resources'
          ? <ResourceCalendar days={calendarDays} rows={resourceRows} scheduled={scheduled} resourceKind={resourceKind} basis={basis} canManage={canManage} onDrop={onResourceDrop} onSelect={selectEvent} />
          : mode === 'month'
            ? <MonthCalendar days={calendarDays} cursor={cursor} scheduled={scheduled} basis={basis} canManage={canManage} onDrop={onDrop} onSelect={selectEvent} />
            : <TimeCalendar days={calendarDays} scheduled={scheduled} basis={basis} canManage={canManage} now={now} onDrop={onTimeDrop} onResize={requestResize} onSelect={selectEvent} />}
      </div>
    </div>

    {selected ? <SchedulerDetail event={selected} basis={basis} canManage={canManage} saving={saving} onClose={() => setSelected(null)} onSave={saveFromDetail} /> : null}
    {pendingMove ? <ConflictDialog pending={pendingMove} saving={saving} onCancel={() => setPendingMove(null)} onConfirm={() => void commitMove(pendingMove.event, pendingMove.startAt, pendingMove.endAt, true, { personId: pendingMove.personId, teamId: pendingMove.teamId })} /> : null}
  </section>
}

function ResourceCalendar({ days, rows, scheduled, resourceKind, basis, canManage, onDrop, onSelect }: { days: Date[]; rows: ResourceRow[]; scheduled: LiveSchedulerEvent[]; resourceKind: ResourceKind; basis: ScheduleBasis; canManage: boolean; onDrop: (event: DragEvent<HTMLDivElement>, day: Date, row: ResourceRow) => void; onSelect: (event: LiveSchedulerEvent) => void }) {
  if (!rows.length) return <div className="scheduler-state">Chưa có nguồn lực phù hợp với bộ lọc hiện tại.</div>
  return <div className="scheduler-resource-board">
    <div className="scheduler-resource-head"><span>{resourceLabel(resourceKind)}</span>{days.map((day) => <strong key={dateKey(day)} className={dateKey(day) === dateKey(new Date()) ? 'today' : ''}>{WEEKDAY[day.getDay()]}<small>{day.getDate()}/{day.getMonth() + 1}</small></strong>)}<span>Tổng</span></div>
    <div className="scheduler-resource-rows">{rows.map((row) => {
      const rowEvents = scheduled.filter((event) => resourceId(event, resourceKind) === row.id)
      const totalHours = rowEvents.reduce((sum, event) => sum + eventHours(event), 0)
      return <div className={`scheduler-resource-row${row.id === UNASSIGNED ? ' unassigned' : ''}`} key={row.id}>
        <header><strong>{row.label}</strong><small>{row.secondary}</small></header>
        {days.map((day) => {
          const cellEvents = rowEvents.filter((event) => sameDay(displayDate(event, basis), day))
          const hours = cellEvents.reduce((sum, event) => sum + eventHours(event), 0)
          return <div key={dateKey(day)} className="scheduler-resource-cell" onDragOver={(event) => { if (basis === 'start' && canManage) event.preventDefault() }} onDrop={(event) => onDrop(event, day, row)}>
            <div className="scheduler-resource-cell-meta"><span>{cellEvents.length ? `${cellEvents.length} WO/PM` : '—'}</span>{hours > 0 ? <b>{hours.toFixed(1)}h</b> : null}</div>
            {cellEvents.slice(0, 4).map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} compact onSelect={onSelect} />)}
            {cellEvents.length > 4 ? <span className="scheduler-resource-more">+{cellEvents.length - 4}</span> : null}
          </div>
        })}
        <footer><strong>{rowEvents.length}</strong><small>{totalHours.toFixed(1)}h</small></footer>
      </div>
    })}</div>
  </div>
}

function MonthCalendar({ days, cursor, scheduled, basis, canManage, onDrop, onSelect }: { days: Date[]; cursor: Date; scheduled: LiveSchedulerEvent[]; basis: ScheduleBasis; canManage: boolean; onDrop: (event: DragEvent<HTMLDivElement>, day: Date) => void; onSelect: (event: LiveSchedulerEvent) => void }) {
  const [expanded, setExpanded] = useState<MonthExpansion>(null)
  return <><div className="scheduler-weekdays month" aria-hidden="true">{days.slice(0, 7).map((day) => <span key={dateKey(day)}>{WEEKDAY[day.getDay()]}</span>)}</div><div className="scheduler-calendar-grid month">{days.map((day) => {
    const dayEvents = scheduled.filter((event) => sameDay(displayDate(event, basis), day)).toSorted((a, b) => displayDate(a, basis).localeCompare(displayDate(b, basis)))
    const outsideMonth = day.getMonth() !== cursor.getMonth()
    const today = dateKey(day) === dateKey(new Date())
    return <div key={dateKey(day)} className={`scheduler-day${outsideMonth ? ' outside' : ''}${today ? ' today' : ''}`} onDragOver={(event) => { if (basis === 'start' && canManage) event.preventDefault() }} onDrop={(event) => onDrop(event, day)}>
      <div className="scheduler-day-heading"><span>{day.getDate()}</span>{today ? <small>Hôm nay</small> : null}</div>
      <div className="scheduler-day-events">{dayEvents.slice(0, 5).map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} compact onSelect={onSelect} />)}{dayEvents.length > 5 ? <button className="scheduler-more" type="button" onClick={() => setExpanded({ day, events: dayEvents })}>+{dayEvents.length - 5} công việc</button> : null}</div>
    </div>
  })}</div>{expanded ? <div className="scheduler-month-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(null) }}><section className="scheduler-month-popover" role="dialog" aria-modal="true" aria-label={`Công việc ${formatDayHeading(expanded.day)}`}><header><div><strong>{formatDayHeading(expanded.day)}</strong><small>{expanded.events.length} công việc / PM</small></div><button type="button" aria-label="Đóng danh sách ngày" onClick={() => setExpanded(null)}>×</button></header><div>{expanded.events.map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} onSelect={(item) => { setExpanded(null); onSelect(item) }} />)}</div></section></div> : null}</>
}

function TimeCalendar({ days, scheduled, basis, canManage, now, onDrop, onResize, onSelect }: { days: Date[]; scheduled: LiveSchedulerEvent[]; basis: ScheduleBasis; canManage: boolean; now: Date; onDrop: (event: DragEvent<HTMLDivElement>, day: Date) => void; onResize: (event: LiveSchedulerEvent, endAt: string) => Promise<void>; onSelect: (event: LiveSchedulerEvent) => void }) {
  const gridMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const nowVisible = nowMinute >= GRID_START_HOUR * 60 && nowMinute <= GRID_END_HOUR * 60
  return <div className="scheduler-time-grid-shell">
    <div className="scheduler-time-header"><span className="scheduler-time-corner">GMT+7</span>{days.map((day) => <strong key={dateKey(day)} className={dateKey(day) === dateKey(now) ? 'today' : ''}>{WEEKDAY[day.getDay()]}<small>{day.getDate()}/{day.getMonth() + 1}</small></strong>)}</div>
    <div className="scheduler-time-body">
      <div className="scheduler-time-axis">{GRID_HOURS.map((hour) => <span key={hour}>{pad(hour)}:00</span>)}</div>
      {days.map((day) => {
        const dayEvents = scheduled.filter((event) => sameDay(displayDate(event, basis), day))
        const overlaps = overlapStyles(dayEvents, basis)
        const today = dateKey(day) === dateKey(now)
        return <div key={dateKey(day)} className="scheduler-time-day" onDragOver={(event) => { if (basis === 'start' && canManage) event.preventDefault() }} onDrop={(event) => onDrop(event, day)}>
          <div className="scheduler-half-hour-lines" aria-hidden="true">{Array.from({ length: (GRID_END_HOUR - GRID_START_HOUR) * 2 }, (_, index) => <i key={index} />)}</div>
          {today && nowVisible ? <div className="scheduler-now-line" style={{ top: `${((nowMinute - GRID_START_HOUR * 60) / gridMinutes) * 100}%` }} aria-label={`Thời gian hiện tại ${formatTime(now.toISOString())}`}><span>{formatTime(now.toISOString())}</span></div> : null}
          <div className="scheduler-time-events">{dayEvents.map((event) => <SchedulerEventCard key={event.eventId} event={event} basis={basis} canManage={canManage} style={{ ...timeGridStyle(event, basis), ...(overlaps.get(event.eventId) || {}) }} resizable onResize={onResize} onSelect={onSelect} />)}</div>
        </div>
      })}
    </div>
  </div>
}

function SchedulerEventCard({ event, basis, canManage, compact = false, style, resizable = false, onResize, onSelect }: { event: LiveSchedulerEvent; basis: ScheduleBasis; canManage: boolean; compact?: boolean; style?: CSSProperties; resizable?: boolean; onResize?: (event: LiveSchedulerEvent, endAt: string) => Promise<void>; onSelect: (event: LiveSchedulerEvent) => void }) {
  const [resizing, setResizing] = useState(false)
  const [previewEndAt, setPreviewEndAt] = useState('')
  const draggable = basis === 'start' && canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && !TERMINAL.has(event.status.toUpperCase())
  const resizeEnabled = resizable && draggable && !!event.startAt && !!onResize
  const shownDate = displayDate(event, basis)
  const pm = event.eventType === 'PM_DUE' ? pmState(event) : null
  const previewStyle = useMemo<CSSProperties>(() => {
    if (!previewEndAt || !event.startAt || !style) return style || {}
    const startMinute = eventMinutes(event.startAt)
    const endMinute = eventMinutes(previewEndAt)
    const duration = Math.max(SNAP_MINUTES, endMinute - startMinute)
    return { ...style, height: `${(duration / ((GRID_END_HOUR - GRID_START_HOUR) * 60)) * 100}%` }
  }, [event.startAt, previewEndAt, style])

  function startResize(pointerEvent: ReactPointerEvent<HTMLSpanElement>) {
    if (!resizeEnabled || !event.startAt || !onResize) return
    pointerEvent.preventDefault(); pointerEvent.stopPropagation()
    const dayElement = pointerEvent.currentTarget.closest('.scheduler-time-day') as HTMLElement | null
    if (!dayElement) return
    setResizing(true)
    const pointerId = pointerEvent.pointerId
    pointerEvent.currentTarget.setPointerCapture(pointerId)
    const handle = pointerEvent.currentTarget
    const onPointerMove = (nativeEvent: PointerEvent) => setPreviewEndAt(snappedResizeEnd(nativeEvent.clientY, dayElement, event.startAt).toISOString())
    const cancel = () => {
      handle.removeEventListener('pointermove', onPointerMove); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel)
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
      setResizing(false); setPreviewEndAt('')
    }
    const finish = (nativeEvent: PointerEvent) => {
      const end = snappedResizeEnd(nativeEvent.clientY, dayElement, event.startAt)
      cancel(); void onResize(event, end.toISOString())
    }
    handle.addEventListener('pointermove', onPointerMove); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', cancel)
  }

  return <button type="button" style={previewStyle} className={`scheduler-event ${event.eventType === 'PM_DUE' ? 'pm' : 'wo'} priority-${(event.priority || 'normal').toLowerCase()}${compact ? ' compact' : ''}${resizing ? ' resizing' : ''}${pm?.overdue ? ' pm-overdue' : ''}`} draggable={draggable && !resizing} onDragStart={(dragEvent) => { dragEvent.dataTransfer.effectAllowed = 'move'; dragEvent.dataTransfer.setData('text/cev-scheduler-event', event.eventId) }} onClick={() => { if (!resizing) onSelect(event) }} title={`${event.eventId} · ${event.equipmentId}`}>
    <span className="scheduler-event-kicker">{event.eventType === 'PM_DUE' ? 'PM' : event.workOrderId || 'WO'}{event.scheduleLocked ? ' · 🔒' : ''}</span>
    <strong>{event.title || (event.eventType === 'PM_DUE' ? 'Bảo trì phòng ngừa' : 'Lệnh công việc')}</strong>
    {!compact ? <span>{event.equipmentId}{event.primaryPersonName ? ` · ${event.primaryPersonName}` : event.primaryTeamName ? ` · ${event.primaryTeamName}` : ''}</span> : null}
    {pm ? <span className="scheduler-pm-badges"><em className={pm.overdue ? 'danger' : ''}>{pm.overdue ? 'Quá hạn' : 'Next due'}</em>{pm.triggerAt ? <em>Trigger {formatTime(pm.triggerAt)}</em> : null}{pm.generatedWorkOrderId ? <em className="generated">WO {pm.generatedWorkOrderId}</em> : <em>Chưa sinh WO</em>}</span> : null}
    <small>{event.unscheduled ? 'Chưa xếp lịch' : formatShortDate(shownDate)} · {statusLabel(event.status)}</small>
    {resizeEnabled ? <span className="scheduler-resize-handle" role="separator" aria-label="Kéo để đổi thời lượng" onPointerDown={startResize}><i /></span> : null}
  </button>
}

function SchedulerDetail({ event, basis, canManage, saving, onClose, onSave }: { event: LiveSchedulerEvent; basis: ScheduleBasis; canManage: boolean; saving: boolean; onClose: () => void; onSave: (event: LiveSchedulerEvent, start: string, end: string) => Promise<void> }) {
  const [startValue, setStartValue] = useState(() => event.startAt ? toLocalInput(event.startAt) : '')
  const [endValue, setEndValue] = useState(() => event.endAt ? toLocalInput(event.endAt) : '')
  const editable = basis === 'start' && canManage && event.eventType === 'WORK_ORDER' && !event.scheduleLocked && !TERMINAL.has(event.status.toUpperCase())
  const dueValue = sourceDate(event)
  return <div className="scheduler-layer" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}><aside className="scheduler-drawer" role="dialog" aria-modal="true" aria-labelledby="scheduler-detail-title">
    <header><div><p className="eyebrow">{event.eventType === 'PM_DUE' ? 'Preventive Maintenance' : 'Work Order'}</p><h2 id="scheduler-detail-title">{event.title || event.eventId}</h2><span>{event.eventId}</span></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header>
    <div className="scheduler-drawer-body"><dl><div><dt>Thiết bị</dt><dd><strong>{event.equipmentId}</strong><span>{event.equipmentName || '—'}</span></dd></div><div><dt>Trạng thái</dt><dd>{statusLabel(event.status)}</dd></div><div><dt>Ưu tiên</dt><dd>{event.priority || '—'}</dd></div><div><dt>Địa điểm</dt><dd>{event.locationName || '—'}</dd></div><div><dt>Người phụ trách</dt><dd>{event.primaryPersonName || '—'}</dd></div><div><dt>Nhóm</dt><dd>{event.primaryTeamName || '—'}</dd></div></dl>
      <section className="scheduler-date-summary"><div><span>Ngày thực hiện</span><strong>{formatShortDate(event.startAt)}</strong></div><div><span>Ngày đến hạn</span><strong>{formatShortDate(event.eventType === 'PM_DUE' ? event.startAt : dueValue)}</strong></div></section>
      <div className="scheduler-time-editor"><label><span>Bắt đầu</span><input type="datetime-local" value={startValue} disabled={!editable} onChange={(changeEvent) => setStartValue(changeEvent.target.value)} /></label><label><span>Kết thúc</span><input type="datetime-local" value={endValue} disabled={!editable} onChange={(changeEvent) => setEndValue(changeEvent.target.value)} /></label></div>
      {basis === 'due' ? <p className="scheduler-readonly-hint">Đang xem theo ngày đến hạn. Chuyển sang <strong>Ngày thực hiện</strong> để reschedule Work Order.</p> : null}</div>
    <footer><button type="button" onClick={onClose}>Đóng</button>{editable ? <button className="primary" type="button" disabled={saving || !startValue || !endValue} onClick={() => void onSave(event, startValue, endValue)}>{saving ? 'Đang lưu…' : 'Lưu lịch'}</button> : null}</footer>
  </aside></div>
}

function ConflictDialog({ pending, saving, onCancel, onConfirm }: { pending: PendingMove; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="scheduler-layer conflict" role="presentation"><section className="scheduler-conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="scheduler-conflict-title"><header><div><p className="eyebrow">Cảnh báo xung đột</p><h2 id="scheduler-conflict-title">Lịch đang trùng nguồn lực</h2></div></header><div className="scheduler-conflict-body"><p>Hệ thống phát hiện {pending.conflicts.length} xung đột cho <strong>{pending.event.workOrderId}</strong>. Kiểm tra trước khi ghi đè lịch.</p><ul>{pending.conflicts.map((conflict) => <li key={`${conflict.conflictType}-${conflict.conflictingWorkOrderId}-${conflict.resourceId}`}><strong>{conflict.conflictType}</strong><span>{conflict.resourceName || conflict.resourceId}</span><small>{conflict.conflictingWorkOrderId} · {formatShortDate(conflict.plannedStartAt)} · {conflict.title}</small></li>)}</ul></div><footer><button type="button" onClick={onCancel}>Hủy</button><button className="danger" type="button" disabled={saving} onClick={onConfirm}>{saving ? 'Đang lưu…' : 'Vẫn xếp lịch'}</button></footer></section></div>
}

export const schedulerDateUtils = { dateKey, startOfWeek, startOfMonthGrid, moveEventToDay, moveEventToTime, displayDate }
