import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAppRole } from '../auth/AppRoleContext'
import {
  generatePreventiveMaintenanceWorkOrder,
  loadPreventiveMaintenance,
  savePreventiveMaintenanceSchedule,
  setPreventiveMaintenanceActive,
  type PmScheduleType,
  type PmTimeUnit,
  type PreventiveMaintenanceInput,
  type PreventiveMaintenanceSchedule,
  type PreventiveMaintenanceSnapshot,
} from '../data/livePreventiveMaintenance'
import './PreventiveMaintenancePanel.css'

type StatusFilter = 'ALL' | 'DUE' | 'ACTIVE' | 'INACTIVE'
type DetailTab = 'details' | 'schedule' | 'work-orders'

const EMPTY: PreventiveMaintenanceSnapshot = { schedules: [], workOrders: [], equipment: [], meters: [], checklistTemplates: [], people: [], teams: [] }
const TYPE_LABEL: Record<PmScheduleType, string> = { TIME: 'Theo thời gian', METER: 'Theo đồng hồ', EITHER: 'Thời gian hoặc đồng hồ' }
const UNIT_LABEL: Record<PmTimeUnit, string> = { HOURS: 'giờ', DAYS: 'ngày', WEEKS: 'tuần', MONTHS: 'tháng', YEARS: 'năm' }

function pad(value: number) { return String(value).padStart(2, '0') }
function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`
}
function toIso(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
function triggerDate(schedule: PreventiveMaintenanceSchedule) {
  if (!schedule.nextDueAt || !schedule.leadTimeMinutes) return schedule.nextDueAt
  return new Date(new Date(schedule.nextDueAt).getTime() - schedule.leadTimeMinutes * 60_000).toISOString()
}
function recurrence(schedule: PreventiveMaintenanceSchedule) {
  const time = schedule.timeInterval && schedule.timeUnit ? `Mỗi ${schedule.timeInterval} ${UNIT_LABEL[schedule.timeUnit]}` : ''
  const meter = schedule.meterInterval != null ? `Mỗi ${schedule.meterInterval.toLocaleString('vi-VN')} ${schedule.meterUnit || ''}`.trim() : ''
  if (schedule.scheduleType === 'EITHER') return `${time} hoặc ${meter}`
  return schedule.scheduleType === 'METER' ? meter : time
}
function canManage(role: string) { return ['SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role) }
function nextMonthIso() { const date = new Date(); date.setMonth(date.getMonth() + 1); return date.toISOString() }
function statusText(schedule: PreventiveMaintenanceSchedule) { return schedule.isDue ? 'Đến trigger' : schedule.active ? 'Đang hoạt động' : 'Tạm dừng' }
function urlPmTarget() { return new URLSearchParams(window.location.search).get('pm')?.trim() || '' }
function openScheduler(schedule?: PreventiveMaintenanceSchedule) {
  const url = new URL(window.location.href)
  url.searchParams.set('phase3', 'scheduler')
  if (schedule?.scheduleId) url.searchParams.set('pm', schedule.scheduleId)
  else url.searchParams.delete('pm')
  if (schedule?.nextDueAt) url.searchParams.set('schedulerDate', schedule.nextDueAt)
  else url.searchParams.delete('schedulerDate')
  window.history.replaceState({}, '', url)
  window.dispatchEvent(new CustomEvent('cev:navigate', { detail: { view: 'scheduler' } }))
}

function draftFromSchedule(schedule?: PreventiveMaintenanceSchedule): PreventiveMaintenanceInput {
  if (!schedule) return {
    equipmentId: '', title: '', description: '', scheduleType: 'TIME', priority: 'NORMAL', active: true,
    startAt: new Date().toISOString(), nextDueAt: nextMonthIso(), timeInterval: 1, timeUnit: 'MONTHS',
    meterId: '', meterInterval: null, nextMeterDue: null, leadTimeMinutes: 10_080,
    checklistTemplateId: '', defaultPersonId: '', defaultTeamId: '',
  }
  return {
    scheduleId: schedule.scheduleId, equipmentId: schedule.equipmentId, title: schedule.title,
    description: schedule.description, scheduleType: schedule.scheduleType, priority: schedule.priority,
    active: schedule.active, startAt: schedule.startAt, nextDueAt: schedule.nextDueAt,
    timeInterval: schedule.timeInterval, timeUnit: schedule.timeUnit, meterId: schedule.meterId,
    meterInterval: schedule.meterInterval, nextMeterDue: schedule.nextMeterDue,
    leadTimeMinutes: schedule.leadTimeMinutes, checklistTemplateId: schedule.checklistTemplateId,
    defaultPersonId: schedule.defaultPersonId, defaultTeamId: schedule.defaultTeamId,
  }
}

export function PreventiveMaintenancePanel() {
  const role = useAppRole()
  const writable = canManage(role)
  const [snapshot, setSnapshot] = useState<PreventiveMaintenanceSnapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [draft, setDraft] = useState<PreventiveMaintenanceInput | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [detailTab, setDetailTab] = useState<DetailTab>('details')

  async function refresh() {
    const next = await loadPreventiveMaintenance()
    setSnapshot(next)
    setError('')
  }

  useEffect(() => {
    let active = true
    loadPreventiveMaintenance()
      .then((next) => {
        if (!active) return
        setSnapshot(next)
        const target = urlPmTarget()
        if (target && next.schedules.some((schedule) => schedule.scheduleId === target)) {
          setSelectedScheduleId(target)
          setDetailTab('schedule')
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Preventive Maintenance.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!draft && !selectedScheduleId) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [draft, selectedScheduleId])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN')
    return snapshot.schedules.filter((schedule) => {
      if (statusFilter === 'DUE' && !schedule.isDue) return false
      if (statusFilter === 'ACTIVE' && !schedule.active) return false
      if (statusFilter === 'INACTIVE' && schedule.active) return false
      if (!needle) return true
      return [schedule.title, schedule.equipmentId, schedule.equipmentName, schedule.defaultPersonName, schedule.defaultTeamName, schedule.checklistTemplateName]
        .some((value) => value.toLocaleLowerCase('vi-VN').includes(needle))
    })
  }, [query, snapshot.schedules, statusFilter])

  const metersForDraft = useMemo(() => snapshot.meters.filter((meter) => !draft?.equipmentId || meter.equipmentId === draft.equipmentId), [draft?.equipmentId, snapshot.meters])
  const selectedSchedule = useMemo(() => snapshot.schedules.find((schedule) => schedule.scheduleId === selectedScheduleId) || null, [selectedScheduleId, snapshot.schedules])
  const selectedWorkOrders = useMemo(() => snapshot.workOrders.filter((workOrder) => workOrder.scheduleId === selectedScheduleId), [selectedScheduleId, snapshot.workOrders])

  function openNew() {
    const next = draftFromSchedule()
    next.equipmentId = snapshot.equipment[0]?.id || ''
    setDraft(next)
    setError('')
    setMessage('')
  }

  function openDetail(schedule: PreventiveMaintenanceSchedule) {
    setSelectedScheduleId(schedule.scheduleId)
    setDetailTab('details')
  }

  function editFromDetail(schedule: PreventiveMaintenanceSchedule) {
    setSelectedScheduleId('')
    setDraft(draftFromSchedule(schedule))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft || !writable) return
    setSaving(true); setError(''); setMessage('')
    try {
      await savePreventiveMaintenanceSchedule(draft)
      setDraft(null)
      setMessage('Đã lưu kế hoạch Preventive Maintenance.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu kế hoạch PM.')
    } finally { setSaving(false) }
  }

  async function toggle(schedule: PreventiveMaintenanceSchedule) {
    if (!writable) return
    setSaving(true); setError(''); setMessage('')
    try {
      await setPreventiveMaintenanceActive(schedule.scheduleId, !schedule.active)
      setMessage(schedule.active ? 'Đã tạm dừng kế hoạch.' : 'Đã kích hoạt kế hoạch.')
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đổi trạng thái PM.') }
    finally { setSaving(false) }
  }

  async function generate(schedule: PreventiveMaintenanceSchedule) {
    if (!writable) return
    setSaving(true); setError(''); setMessage('')
    try {
      const result = await generatePreventiveMaintenanceWorkOrder(schedule.scheduleId)
      const count = Number(result.generatedCount || 0)
      setMessage(count ? `Đã tạo ${count} Work Order từ PM.` : 'PM chưa đến trigger nên chưa tạo Work Order.')
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo Work Order PM.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="maintenance-state">Đang tải Preventive Maintenance…</div>

  return <section className="pm-modern" aria-labelledby="pm-modern-title">
    <header className="pm-modern-header">
      <div><p className="eyebrow">Preventive Maintenance</p><h2 id="pm-modern-title">Bảo trì phòng ngừa</h2><p>Định nghĩa công việc, lịch trigger và nguồn lực. Khi đến trigger, hệ thống tự tạo Work Order để đưa vào Lịch trình.</p></div>
      <div className="pm-modern-actions"><button type="button" onClick={() => openScheduler()}>Lịch trình</button>{writable ? <button className="primary" type="button" onClick={openNew}>+ Tạo PM</button> : null}</div>
    </header>

    <div className="pm-modern-toolbar">
      <input aria-label="Tìm Preventive Maintenance" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm PM, thiết bị, người phụ trách…" />
      <div className="pm-modern-filter" role="group" aria-label="Lọc Preventive Maintenance">
        {(['ALL','DUE','ACTIVE','INACTIVE'] as StatusFilter[]).map((filter) => <button key={filter} type="button" className={statusFilter === filter ? 'active' : ''} onClick={() => setStatusFilter(filter)}>{filter === 'ALL' ? 'Tất cả' : filter === 'DUE' ? 'Đến trigger' : filter === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm dừng'}</button>)}
      </div>
    </div>

    {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}
    {error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}

    <div className="pm-modern-table-wrap">
      <table className="pm-modern-table">
        <thead><tr><th>Preventive Maintenance</th><th>Thiết bị</th><th>Trigger</th><th>Next due</th><th>Next trigger</th><th>Phụ trách</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{filtered.map((schedule) => <tr key={schedule.scheduleId}>
          <td><button className="pm-title-button" type="button" onClick={() => openDetail(schedule)}><strong>{schedule.title}</strong><small>{TYPE_LABEL[schedule.scheduleType]} · {recurrence(schedule) || '—'}</small></button></td>
          <td><strong>{schedule.equipmentName}</strong><small>{schedule.equipmentId}</small></td>
          <td><span className="pm-trigger-type">{schedule.scheduleType}</span>{schedule.scheduleType !== 'TIME' ? <small>{schedule.latestMeterValue?.toLocaleString('vi-VN') ?? '—'} / {schedule.nextMeterDue?.toLocaleString('vi-VN') ?? '—'} {schedule.meterUnit}</small> : null}</td>
          <td>{formatDate(schedule.nextDueAt)}{schedule.nextMeterDue != null ? <small>Meter: {schedule.nextMeterDue.toLocaleString('vi-VN')} {schedule.meterUnit}</small> : null}</td>
          <td>{formatDate(triggerDate(schedule))}<small>{schedule.leadTimeMinutes ? `Lead time ${Math.round(schedule.leadTimeMinutes / 1440)} ngày` : 'Không lead time'}</small></td>
          <td>{schedule.defaultPersonName || schedule.defaultTeamName || 'Chưa phân công'}<small>{schedule.checklistTemplateName || 'Chưa gắn checklist'}</small></td>
          <td><span className={`pm-modern-status ${schedule.isDue ? 'due' : schedule.active ? 'active' : 'inactive'}`}>{statusText(schedule)}</span>{schedule.lastGeneratedWorkOrderId ? <small>WO gần nhất: {schedule.lastGeneratedWorkOrderId}</small> : null}</td>
          <td><div className="pm-row-actions"><button type="button" onClick={() => openDetail(schedule)}>Chi tiết</button><button type="button" onClick={() => openScheduler(schedule)}>Trên lịch</button>{writable ? <><button type="button" onClick={() => setDraft(draftFromSchedule(schedule))}>Sửa</button><button type="button" onClick={() => void toggle(schedule)} disabled={saving}>{schedule.active ? 'Tạm dừng' : 'Kích hoạt'}</button>{schedule.isDue ? <button type="button" onClick={() => void generate(schedule)} disabled={saving}>Tạo WO</button> : null}</> : null}</div></td>
        </tr>)}</tbody>
      </table>
      {!filtered.length ? <div className="maintenance-state">Chưa có Preventive Maintenance phù hợp bộ lọc.</div> : null}
    </div>

    {selectedSchedule ? <div className="pm-modern-layer pm-detail-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedScheduleId('') }}><aside className="pm-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="pm-detail-title">
      <header className="pm-detail-header"><div><p className="eyebrow">Preventive Maintenance</p><h2 id="pm-detail-title">{selectedSchedule.title}</h2><div className="pm-detail-meta"><span>{selectedSchedule.equipmentName}</span><span>{selectedSchedule.equipmentId}</span><span className={`pm-modern-status ${selectedSchedule.isDue ? 'due' : selectedSchedule.active ? 'active' : 'inactive'}`}>{statusText(selectedSchedule)}</span></div></div><div className="pm-detail-header-actions">{writable ? <button type="button" onClick={() => editFromDetail(selectedSchedule)}>Sửa</button> : null}<button type="button" aria-label="Đóng chi tiết PM" onClick={() => setSelectedScheduleId('')}>×</button></div></header>
      <nav className="pm-detail-tabs" aria-label="Chi tiết Preventive Maintenance">{([['details','Chi tiết'],['schedule','Lịch / Trigger'],['work-orders',`Work Orders (${selectedWorkOrders.length})`]] as Array<[DetailTab,string]>).map(([tab,label]) => <button key={tab} type="button" className={detailTab === tab ? 'active' : ''} aria-current={detailTab === tab ? 'page' : undefined} onClick={() => setDetailTab(tab)}>{label}</button>)}</nav>
      <div className="pm-detail-content">
        {detailTab === 'details' ? <div className="pm-detail-grid">
          <section><h3>Tổng quan</h3><dl><div><dt>Mô tả</dt><dd>{selectedSchedule.description || 'Chưa có mô tả'}</dd></div><div><dt>Ưu tiên</dt><dd>{selectedSchedule.priority}</dd></div><div><dt>Thiết bị</dt><dd>{selectedSchedule.equipmentName}<small>{selectedSchedule.equipmentId}</small></dd></div><div><dt>Trạng thái</dt><dd>{statusText(selectedSchedule)}</dd></div></dl></section>
          <section><h3>Nguồn lực mặc định</h3><dl><div><dt>Người phụ trách</dt><dd>{selectedSchedule.defaultPersonName || 'Chưa phân công'}</dd></div><div><dt>Nhóm</dt><dd>{selectedSchedule.defaultTeamName || 'Chưa phân công'}</dd></div><div><dt>Checklist</dt><dd>{selectedSchedule.checklistTemplateName || 'Chưa gắn checklist'}</dd></div><div><dt>WO gần nhất</dt><dd>{selectedSchedule.lastGeneratedWorkOrderId || 'Chưa có'}</dd></div></dl></section>
        </div> : null}

        {detailTab === 'schedule' ? <div className="pm-detail-grid">
          <section><h3>Trigger</h3><dl><div><dt>Kiểu trigger</dt><dd>{TYPE_LABEL[selectedSchedule.scheduleType]}</dd></div><div><dt>Chu kỳ</dt><dd>{recurrence(selectedSchedule) || '—'}</dd></div><div><dt>Bắt đầu</dt><dd>{formatDate(selectedSchedule.startAt)}</dd></div><div><dt>Next due</dt><dd>{formatDate(selectedSchedule.nextDueAt)}</dd></div><div><dt>Next trigger</dt><dd>{formatDate(triggerDate(selectedSchedule))}<small>{selectedSchedule.leadTimeMinutes ? `Lead time ${Math.round(selectedSchedule.leadTimeMinutes / 1440)} ngày` : 'Không lead time'}</small></dd></div></dl><button type="button" onClick={() => openScheduler(selectedSchedule)}>Mở đúng ngày trên Lịch trình</button></section>
          <section><h3>Meter trigger</h3>{selectedSchedule.scheduleType === 'TIME' ? <div className="pm-detail-empty">PM này chỉ chạy theo thời gian.</div> : <dl><div><dt>Đồng hồ</dt><dd>{selectedSchedule.meterName || '—'}</dd></div><div><dt>Giá trị hiện tại</dt><dd>{selectedSchedule.latestMeterValue?.toLocaleString('vi-VN') ?? '—'} {selectedSchedule.meterUnit}</dd></div><div><dt>Ngưỡng kế tiếp</dt><dd>{selectedSchedule.nextMeterDue?.toLocaleString('vi-VN') ?? '—'} {selectedSchedule.meterUnit}</dd></div><div><dt>Chu kỳ meter</dt><dd>{selectedSchedule.meterInterval?.toLocaleString('vi-VN') ?? '—'} {selectedSchedule.meterUnit}</dd></div></dl>}</section>
        </div> : null}

        {detailTab === 'work-orders' ? <section className="pm-history"><div className="pm-history-head"><div><h3>Work Orders được tạo từ PM</h3><p>Lịch sử thực thi thuộc CMMS; biểu mẫu audit/IATF lấy bằng chứng từ các Work Order này.</p></div>{selectedSchedule.isDue && writable ? <button className="primary" type="button" onClick={() => void generate(selectedSchedule)} disabled={saving}>Tạo Work Order</button> : null}</div>{selectedWorkOrders.length ? <div className="pm-history-list">{selectedWorkOrders.map((workOrder) => <article key={workOrder.workOrderId}><div><strong>{workOrder.workOrderId}</strong><small>{formatDate(workOrder.createdAt)} · {workOrder.reason || selectedSchedule.title}</small></div><div className="pm-history-state"><span>{workOrder.status}</span><small>{workOrder.priority}</small></div></article>)}</div> : <div className="pm-detail-empty">Chưa có Work Order nào được tạo từ kế hoạch PM này.</div>}</section> : null}
      </div>
      <footer className="pm-detail-footer"><button type="button" onClick={() => openScheduler(selectedSchedule)}>Mở Lịch trình</button>{writable ? <button type="button" onClick={() => void toggle(selectedSchedule)} disabled={saving}>{selectedSchedule.active ? 'Tạm dừng PM' : 'Kích hoạt PM'}</button> : null}</footer>
    </aside></div> : null}

    {draft && writable ? <div className="pm-modern-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}><aside className="pm-modern-drawer" role="dialog" aria-modal="true" aria-labelledby="pm-editor-title">
      <header><div><p className="eyebrow">Preventive Maintenance</p><h2 id="pm-editor-title">{draft.scheduleId ? 'Sửa kế hoạch PM' : 'Tạo Preventive Maintenance'}</h2></div><button type="button" aria-label="Đóng" onClick={() => setDraft(null)}>×</button></header>
      <form onSubmit={submit}>
        <label><span>Tiêu đề</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Bảo trì định kỳ máy ép 60T" /></label>
        <label><span>Thiết bị</span><select required value={draft.equipmentId} onChange={(event) => setDraft({ ...draft, equipmentId: event.target.value, meterId: '' })}>{snapshot.equipment.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.meta}</option>)}</select></label>
        <label className="wide"><span>Mô tả công việc</span><textarea rows={3} value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label><span>Kiểu trigger</span><select value={draft.scheduleType} onChange={(event) => setDraft({ ...draft, scheduleType: event.target.value as PmScheduleType })}><option value="TIME">Theo thời gian</option><option value="METER">Theo đồng hồ</option><option value="EITHER">Thời gian hoặc đồng hồ</option></select></label>
        <label><span>Ưu tiên</span><select value={draft.priority || 'NORMAL'} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label>

        {draft.scheduleType !== 'METER' ? <><label><span>Chu kỳ thời gian</span><input type="number" min="1" required value={draft.timeInterval ?? ''} onChange={(event) => setDraft({ ...draft, timeInterval: Number(event.target.value) || null })} /></label><label><span>Đơn vị</span><select value={draft.timeUnit || 'MONTHS'} onChange={(event) => setDraft({ ...draft, timeUnit: event.target.value as PmTimeUnit })}><option value="HOURS">Giờ</option><option value="DAYS">Ngày</option><option value="WEEKS">Tuần</option><option value="MONTHS">Tháng</option><option value="YEARS">Năm</option></select></label><label><span>Next due</span><input type="datetime-local" required value={toLocalInput(draft.nextDueAt || '')} onChange={(event) => setDraft({ ...draft, nextDueAt: toIso(event.target.value) })} /></label><label><span>Lead time (ngày)</span><input type="number" min="0" value={Math.round((draft.leadTimeMinutes || 0) / 1440)} onChange={(event) => setDraft({ ...draft, leadTimeMinutes: Math.max(0, Number(event.target.value) || 0) * 1440 })} /></label></> : null}

        {draft.scheduleType !== 'TIME' ? <><label><span>Đồng hồ</span><select required value={draft.meterId || ''} onChange={(event) => setDraft({ ...draft, meterId: event.target.value })}><option value="">Chọn đồng hồ</option>{metersForDraft.map((meter) => <option key={meter.id} value={meter.id}>{meter.label} · {meter.latestValue ?? '—'} {meter.unit}</option>)}</select></label><label><span>Chu kỳ đồng hồ</span><input type="number" min="0.000001" step="any" required value={draft.meterInterval ?? ''} onChange={(event) => setDraft({ ...draft, meterInterval: Number(event.target.value) || null })} /></label><label><span>Next meter due</span><input type="number" step="any" required value={draft.nextMeterDue ?? ''} onChange={(event) => setDraft({ ...draft, nextMeterDue: Number(event.target.value) || null })} /></label></> : null}

        <label><span>Checklist template</span><select value={draft.checklistTemplateId || ''} onChange={(event) => setDraft({ ...draft, checklistTemplateId: event.target.value })}><option value="">Không gắn</option>{snapshot.checklistTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Người phụ trách</span><select value={draft.defaultPersonId || ''} onChange={(event) => setDraft({ ...draft, defaultPersonId: event.target.value })}><option value="">Chưa chọn</option>{snapshot.people.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Nhóm</span><select value={draft.defaultTeamId || ''} onChange={(event) => setDraft({ ...draft, defaultTeamId: event.target.value })}><option value="">Chưa chọn</option>{snapshot.teams.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <footer><button type="button" onClick={() => setDraft(null)}>Hủy</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu PM'}</button></footer>
      </form>
    </aside></div> : null}
  </section>
}
