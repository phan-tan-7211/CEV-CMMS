import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppRole } from '../auth/AppRoleContext'
import { loadCurrentMaintenancePerson, loadMaintenanceAssignees, type CurrentMaintenancePerson, type MaintenanceAssigneeOption } from '../data/maintenanceAssignment'
import { getMaintenanceCacheSnapshot, loadLiveMaintenance, type LiveMaintenanceWorkOrder } from '../data/liveMaintenance'
import { workOrderQueueMatches } from './workOrderQueue'
import { buildMaintenanceWorkload, countUnassignedOpen } from './workOrderWorkload'
import './MaintenanceWorkloadPanel.css'

const priorityLabel: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Khẩn cấp' }
const statusLabel: Record<string, string> = { OPEN: 'Mở', WAITING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã phê duyệt', IN_PROGRESS: 'Đang xử lý', COMPLETED: 'Đã hoàn tất', VERIFIED: 'Đã xác nhận', RELEASED: 'Đã bàn giao' }

function dateTime(value: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
}

function dueState(item: LiveMaintenanceWorkOrder, now = Date.now()) {
  if (!item.plannedEndAt) return 'NO_DUE'
  const due = Date.parse(item.plannedEndAt)
  if (Number.isNaN(due)) return 'NO_DUE'
  if (due < now) return 'OVERDUE'
  if (due - now <= 24 * 60 * 60 * 1000) return 'DUE_SOON'
  return 'ON_TRACK'
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value: Date, amount: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function dayKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function plannedMinutes(item: LiveMaintenanceWorkOrder) {
  if (!item.plannedStartAt || !item.plannedEndAt) return 0
  const start = Date.parse(item.plannedStartAt)
  const end = Date.parse(item.plannedEndAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.round((end - start) / 60_000)
}
function openScheduler() { window.dispatchEvent(new CustomEvent('cev:navigate', { detail: { view: 'scheduler' } })) }

export function MaintenanceWorkloadPanel() {
  const role = useAppRole()
  const initial = getMaintenanceCacheSnapshot()
  const [workOrders, setWorkOrders] = useState<LiveMaintenanceWorkOrder[]>(() => initial?.workOrders || [])
  const [people, setPeople] = useState<MaintenanceAssigneeOption[]>([])
  const [currentPerson, setCurrentPerson] = useState<CurrentMaintenancePerson | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [maintenance, assignees, person] = await Promise.all([
        loadLiveMaintenance({ force: true }),
        loadMaintenanceAssignees(),
        loadCurrentMaintenancePerson(),
      ])
      setWorkOrders(maintenance.workOrders)
      setPeople(assignees)
      setCurrentPerson(person)
      setError('')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu phân công')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([loadLiveMaintenance(), loadMaintenanceAssignees(), loadCurrentMaintenancePerson()])
      .then(([maintenance, assignees, person]) => {
        if (!active) return
        setWorkOrders(maintenance.workOrders)
        setPeople(assignees)
        setCurrentPerson(person)
        setError('')
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu phân công') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const onChanged = () => { void refresh() }
    window.addEventListener('cev:maintenance-assignment-changed', onChanged)
    return () => window.removeEventListener('cev:maintenance-assignment-changed', onChanged)
  }, [refresh])

  const workload = buildMaintenanceWorkload(people, workOrders)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN')
  const visibleWorkload = normalizedQuery
    ? workload.filter((item) => [item.displayName, item.personCode, item.unitCode, item.jobTitle].join(' ').toLocaleLowerCase('vi-VN').includes(normalizedQuery))
    : workload
  const activeOrders = workOrders.filter((item) => item.status !== 'RELEASED')
  const unassignedOpen = countUnassignedOpen(workOrders)
  const overdueOpen = activeOrders.filter((item) => dueState(item) === 'OVERDUE').length
  const dueSoonOpen = activeOrders.filter((item) => dueState(item) === 'DUE_SOON').length
  const myActionItems = currentPerson
    ? workOrders.filter((item) => item.assignedPersonCode === currentPerson.personCode && workOrderQueueMatches(item.status, 'ACTION', role))
      .toSorted((left, right) => {
        const leftDue = left.plannedEndAt ? Date.parse(left.plannedEndAt) : Number.POSITIVE_INFINITY
        const rightDue = right.plannedEndAt ? Date.parse(right.plannedEndAt) : Number.POSITIVE_INFINITY
        return leftDue - rightDue
      })
    : []

  const planningDays = useMemo(() => {
    const start = startOfLocalDay()
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [])

  const planningRows = useMemo(() => visibleWorkload.map((person) => {
    const personOrders = activeOrders.filter((item) => item.assignedPersonCode === person.personCode && !!item.plannedStartAt)
    const days = planningDays.map((day) => {
      const dayOrders = personOrders.filter((item) => dayKey(item.plannedStartAt) === dayKey(day))
      const minutes = dayOrders.reduce((sum, item) => sum + plannedMinutes(item), 0)
      return { orders: dayOrders, minutes }
    })
    return { person, days, totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0) }
  }), [activeOrders, planningDays, visibleWorkload])

  return <section className="maintenance-workload-page" aria-labelledby="maintenance-workload-title">
    <header className="maintenance-workload-header">
      <div><p className="eyebrow">Workload · Assignment</p><h2 id="maintenance-workload-title">Phân công & tải công việc</h2><p>So sánh số lệnh đang mở, mức ưu tiên, deadline và tải lịch 7 ngày theo từng nhân sự. Supervisor dùng dữ liệu này để cân bằng nguồn lực trước khi xếp lịch chi tiết.</p></div>
      <div className="maintenance-workload-header-actions"><button type="button" onClick={openScheduler}>Mở Lịch trình</button><button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Đang tải…' : '↻ Làm mới'}</button></div>
    </header>

    <div className="maintenance-workload-summary" aria-label="Tổng quan phân công">
      <article className={unassignedOpen ? 'attention' : ''}><span>Chưa giao</span><strong>{unassignedOpen}</strong><small>Lệnh mở chưa có người phụ trách</small></article>
      <article className={overdueOpen ? 'attention' : ''}><span>Quá hạn</span><strong>{overdueOpen}</strong><small>{dueSoonOpen} lệnh sẽ đến hạn trong 24 giờ</small></article>
      <article><span>Đang mở</span><strong>{activeOrders.length}</strong><small>{activeOrders.filter((item) => item.status === 'IN_PROGRESS').length} đang sửa chữa</small></article>
      <article className={myActionItems.length ? 'personal' : ''}><span>Việc của tôi</span><strong>{currentPerson ? myActionItems.length : '—'}</strong><small>{currentPerson ? currentPerson.displayName : 'Chưa liên kết email đăng nhập'}</small></article>
    </div>

    {error ? <div className="maintenance-workload-feedback error" role="alert">{error}</div> : null}

    <section className="maintenance-my-work" aria-labelledby="maintenance-my-work-title">
      <header><div><span className="eyebrow">My Work</span><h3 id="maintenance-my-work-title">Việc cần tôi xử lý</h3></div><small>{currentPerson ? `${currentPerson.displayName} · ${currentPerson.personCode}` : 'Cần mapping tài khoản ↔ nhân sự'}</small></header>
      {!currentPerson ? <div className="maintenance-workload-empty">Vào Tổ chức & nhân sự và điền Email đăng nhập cho đúng nhân sự để kích hoạt hàng đợi cá nhân.</div> : myActionItems.length ? <div className="maintenance-my-work-list">{myActionItems.slice(0, 8).map((item) => {
        const due = dueState(item)
        return <article key={item.workOrderId}>
          <div><strong>{item.workOrderId}</strong><span>{item.equipmentId}</span></div>
          <p>{item.reason || 'Không có mô tả'}</p>
          <div className="maintenance-my-work-meta"><span className={`priority-${item.priority.toLowerCase()}`}>{priorityLabel[item.priority] || item.priority}</span><span>{statusLabel[item.status] || item.status}</span><time className={due === 'OVERDUE' ? 'overdue' : ''}>{item.plannedEndAt ? `Hạn ${dateTime(item.plannedEndAt)}` : 'Chưa đặt hạn'}</time></div>
        </article>
      })}</div> : <div className="maintenance-workload-empty">Không có Work Order được giao cho bạn ở bước mà vai trò hiện tại có thể xử lý ngay.</div>}
    </section>

    <section className="maintenance-resource-plan" aria-labelledby="maintenance-resource-plan-title">
      <header><div><span className="eyebrow">Resource planning</span><h3 id="maintenance-resource-plan-title">Tải lịch 7 ngày</h3><p>Đọc từ thời gian đã xếp của Work Order. Số giờ là tổng planned duration; không tự suy luận công suất hay ngưỡng quá tải.</p></div></header>
      <div className="maintenance-resource-grid-wrap">
        <div className="maintenance-resource-grid" style={{ '--resource-days': planningDays.length } as React.CSSProperties}>
          <div className="maintenance-resource-head resource-person">Nhân sự</div>
          {planningDays.map((day) => <div className="maintenance-resource-head" key={dayKey(day)}><strong>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(day)}</strong><span>{day.getDate()}/{day.getMonth() + 1}</span></div>)}
          <div className="maintenance-resource-head resource-total">Tổng</div>
          {planningRows.map(({ person, days, totalMinutes }) => <div className="maintenance-resource-row" key={person.personCode} style={{ '--resource-days': planningDays.length } as React.CSSProperties}>
            <div className="maintenance-resource-person"><strong>{person.displayName}</strong><span>{person.personCode}{person.jobTitle ? ` · ${person.jobTitle}` : ''}</span></div>
            {days.map((day, index) => <div className={`maintenance-resource-cell${day.orders.length ? ' has-work' : ''}`} key={`${person.personCode}-${dayKey(planningDays[index])}`} title={day.orders.map((item) => `${item.workOrderId} · ${item.equipmentId}`).join('\n')}><strong>{day.orders.length || '—'}</strong><span>{day.minutes ? `${(day.minutes / 60).toFixed(day.minutes % 60 ? 1 : 0)}h` : ''}</span></div>)}
            <div className="maintenance-resource-total"><strong>{(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h</strong><span>{days.reduce((sum, day) => sum + day.orders.length, 0)} WO</span></div>
          </div>)}
        </div>
      </div>
      {!planningRows.length ? <div className="maintenance-workload-empty">Không có nhân sự phù hợp bộ lọc.</div> : null}
    </section>

    <section className="maintenance-team-load" aria-labelledby="maintenance-team-load-title">
      <header><div><span className="eyebrow">Team workload</span><h3 id="maintenance-team-load-title">Tải theo nhân sự</h3></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã, bộ phận…" aria-label="Tìm nhân sự trong bảng tải công việc" /></header>
      <div className="maintenance-team-load-table"><table><thead><tr><th>Nhân sự</th><th>Đang mở</th><th>High / Critical</th><th>Quá hạn</th><th>≤ 24h</th><th>Đang sửa</th><th>Hạn gần nhất</th></tr></thead><tbody>{visibleWorkload.map((item) => <tr key={item.personCode} className={currentPerson?.personCode === item.personCode ? 'is-me' : ''}><td><strong>{item.displayName}</strong><small>{item.personCode}{item.jobTitle ? ` · ${item.jobTitle}` : ''}{item.unitCode ? ` · ${item.unitCode}` : ''}</small></td><td><b>{item.openCount}</b></td><td className={item.criticalHighCount ? 'attention' : ''}>{item.criticalHighCount}</td><td className={item.overdueCount ? 'danger' : ''}>{item.overdueCount}</td><td className={item.dueSoonCount ? 'attention' : ''}>{item.dueSoonCount}</td><td>{item.inProgressCount}</td><td>{dateTime(item.nearestDueAt)}</td></tr>)}</tbody></table></div>
      {!visibleWorkload.length ? <div className="maintenance-workload-empty">Không có nhân sự phù hợp.</div> : null}
    </section>
  </section>
}
