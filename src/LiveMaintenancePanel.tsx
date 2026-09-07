import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './Maintenance.css'
import { canCreateMaintenance, canTransitionMaintenance, useAppRole } from './auth/AppRoleContext'
import { MaintenanceSpareFlow } from './MaintenanceSpareFlow'
import { createManualWorkOrder, getMaintenanceCacheSnapshot, loadLiveMaintenance, transitionLiveMaintenance, type LiveHandover, type LiveMaintenanceWorkOrder, type MaintenanceEquipmentOption } from './data/liveMaintenance'
import type { MaintenanceWorkflowAction, MaintenanceWorkflowStatus } from './domain/workflow'
import { getWorkOrderActionState, MAINTENANCE_QUEUE_FILTERS, workOrderQueueMatches, type MaintenanceQueueFilter } from './maintenance/workOrderQueue'

const statusLabel: Record<string, string> = {
  OPEN: 'Mở', WAITING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã phê duyệt', IN_PROGRESS: 'Đang xử lý', COMPLETED: 'Đã hoàn tất', VERIFIED: 'Đã xác nhận', RELEASED: 'Đã bàn giao',
}
const priorityLabel: Record<string,string> = { LOW:'Thấp', MEDIUM:'Trung bình', HIGH:'Cao', CRITICAL:'Khẩn cấp' }
const priorityGuide: Record<string,string> = {
  LOW: 'Không ảnh hưởng ngay đến sản xuất; có thể xếp lịch xử lý.',
  MEDIUM: 'Cần bảo trì sớm nhưng thiết bị vẫn có thể vận hành có kiểm soát.',
  HIGH: 'Ảnh hưởng sản xuất / chất lượng hoặc có nguy cơ dừng máy nếu trì hoãn.',
  CRITICAL: 'Máy đang dừng, có rủi ro an toàn hoặc cần xử lý khẩn cấp.',
}
const sourceLabel: Record<string,string> = { MANUAL:'Tạo thủ công', DAILY_INSPECTION:'Từ kiểm tra', INSPECTION:'Từ kiểm tra', PM:'Từ kế hoạch bảo dưỡng', REQUEST:'Từ yêu cầu' }
const roleLabel: Record<string,string> = { MAINTENANCE:'Bảo trì', SUPERVISOR:'Giám sát', QUALITY:'Chất lượng', MANAGER:'Quản lý', ADMIN:'Quản trị hệ thống', UNKNOWN:'Chưa xác định' }
const WORKFLOW_STAGES = ['Tiếp nhận', 'Phê duyệt', 'Sửa chữa', 'Xác nhận', 'Bàn giao'] as const
const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const STATUS_RANK: Record<MaintenanceWorkflowStatus, number> = { OPEN: 0, WAITING_APPROVAL: 1, APPROVED: 2, IN_PROGRESS: 3, COMPLETED: 4, VERIFIED: 5, RELEASED: 6 }

function operationId(prefix: string) { return `${prefix}-${crypto.randomUUID()}` }
function dateTime(value: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
}
function toIso(value: string) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}
function workflowStage(status: MaintenanceWorkflowStatus) {
  if (status === 'OPEN') return 0
  if (status === 'WAITING_APPROVAL' || status === 'APPROVED') return 1
  if (status === 'IN_PROGRESS' || status === 'COMPLETED') return 2
  if (status === 'VERIFIED') return 3
  return 4
}
function requestedAtValue(value: string) {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

export function LiveMaintenancePanel() {
  const role = useAppRole()
  const canCreate = canCreateMaintenance(role)
  const [initialSnapshot] = useState(getMaintenanceCacheSnapshot)
  const [equipment, setEquipment] = useState<MaintenanceEquipmentOption[]>(() => initialSnapshot?.equipment || [])
  const [workOrders, setWorkOrders] = useState<LiveMaintenanceWorkOrder[]>(() => initialSnapshot?.workOrders || [])
  const [handovers, setHandovers] = useState<LiveHandover[]>(() => initialSnapshot?.handovers || [])
  const [loading, setLoading] = useState(!initialSnapshot)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [queueFilter, setQueueFilter] = useState<MaintenanceQueueFilter>('ACTION')
  const [statusFilter, setStatusFilter] = useState<'ALL' | MaintenanceWorkflowStatus>('ALL')
  const [selectedId, setSelectedId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [equipmentId, setEquipmentId] = useState(() => initialSnapshot?.equipment[0]?.equipmentId || '')
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [method, setMethod] = useState('')
  const [plannedStartAt, setPlannedStartAt] = useState('')
  const [plannedEndAt, setPlannedEndAt] = useState('')

  const applyResult = useCallback((result: Awaited<ReturnType<typeof loadLiveMaintenance>>) => {
    setEquipment(result.equipment)
    setWorkOrders(result.workOrders)
    setHandovers(result.handovers)
    setEquipmentId((current) => current || result.equipment[0]?.equipmentId || '')
    setError('')
  }, [])

  const refresh = useCallback(async () => applyResult(await loadLiveMaintenance({ force: true })), [applyResult])
  const applyCachedMutation = useCallback(() => {
    const snapshot = getMaintenanceCacheSnapshot()
    if (snapshot) applyResult(snapshot)
  }, [applyResult])

  useEffect(() => {
    let active = true
    loadLiveMaintenance()
      .then((result) => { if (active) applyResult(result) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu bảo trì') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applyResult])

  useEffect(() => {
    if (!selectedId && !createOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelectedId(''); setCreateOpen(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedId, createOpen])

  const actionCount = workOrders.filter((item) => workOrderQueueMatches(item.status, 'ACTION', role)).length
  const criticalActionCount = workOrders.filter((item) => workOrderQueueMatches(item.status, 'ACTION', role) && item.priority === 'CRITICAL').length
  const inProgressCount = workOrders.filter((item) => item.status === 'IN_PROGRESS').length
  const verifyCount = workOrders.filter((item) => item.status === 'COMPLETED' || item.status === 'VERIFIED').length
  const releasedCount = workOrders.filter((item) => item.status === 'RELEASED').length
  const acceptedHandovers = useMemo(() => handovers.filter((item) => item.accepted), [handovers])
  const handoverByWorkOrder = useMemo(() => new Map(acceptedHandovers.map((item) => [item.workOrderId, item])), [acceptedHandovers])
  const equipmentName = useMemo(() => new Map(equipment.map((item) => [item.equipmentId, item.equipmentName])), [equipment])
  const queueCounts = useMemo(() => Object.fromEntries(MAINTENANCE_QUEUE_FILTERS.map((filter) => [filter.id, workOrders.filter((item) => workOrderQueueMatches(item.status, filter.id, role)).length])) as Record<MaintenanceQueueFilter, number>, [workOrders, role])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredWorkOrders = useMemo(() => workOrders
    .filter((item) => {
      if (!workOrderQueueMatches(item.status, queueFilter, role)) return false
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (!normalizedQuery) return true
      return [item.workOrderId, item.equipmentId, equipmentName.get(item.equipmentId), item.reason, item.priority, item.sourceType, item.requestedBy, item.method]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery)
    })
    .toSorted((left, right) => (PRIORITY_RANK[left.priority] ?? 9) - (PRIORITY_RANK[right.priority] ?? 9)
      || STATUS_RANK[left.status] - STATUS_RANK[right.status]
      || requestedAtValue(left.requestedAt) - requestedAtValue(right.requestedAt)), [workOrders, queueFilter, statusFilter, normalizedQuery, equipmentName, role])
  const selected = selectedId ? workOrders.find((item) => item.workOrderId === selectedId) || null : null
  const selectedHandover = selected ? handoverByWorkOrder.get(selected.workOrderId) || null : null
  const selectedAction = selected ? getWorkOrderActionState(selected.status, role) : null
  const selectedNext = selectedAction?.next || null
  const selectedStage = selected ? workflowStage(selected.status) : -1

  const openCreate = () => {
    setCreateError('')
    setCreateOpen(true)
  }

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    setCreateError('')
    if (!canCreate) return setCreateError(`Vai trò ${roleLabel[role] || role} không có quyền tạo lệnh công việc.`)
    if (!equipmentId) return setCreateError('Chọn thiết bị cần bảo trì.')
    if (!reason.trim()) return setCreateError('Nhập lý do / hiện tượng cần xử lý.')
    if (plannedStartAt && plannedEndAt && new Date(plannedEndAt).getTime() < new Date(plannedStartAt).getTime()) {
      return setCreateError('Thời gian kết thúc dự kiến phải sau thời gian bắt đầu.')
    }
    setBusy('create'); setError(''); setMessage('')
    try {
      const result = await createManualWorkOrder({
        operationId: operationId('create-wo'),
        input: {
          equipmentId,
          sourceType: 'MANUAL',
          sourceId: '',
          reason: reason.trim(),
          priority,
          method: method.trim(),
          plannedStartAt: toIso(plannedStartAt),
          plannedEndAt: toIso(plannedEndAt),
        },
      })
      applyCachedMutation()
      setMessage(`Đã tạo ${result.result.workOrderId}`)
      setReason('')
      setMethod('')
      setPlannedStartAt('')
      setPlannedEndAt('')
      setPriority('MEDIUM')
      setCreateOpen(false)
      setQueueFilter('ACTION')
      setStatusFilter('ALL')
      setSelectedId(result.result.workOrderId)
    } catch (cause: unknown) {
      setCreateError(cause instanceof Error ? cause.message : 'Không thể tạo lệnh công việc')
    } finally { setBusy('') }
  }

  const advance = async (workOrderId: string, action: MaintenanceWorkflowAction) => {
    if (!canTransitionMaintenance(role, action)) return setError(`Vai trò ${roleLabel[role] || role} không có quyền thực hiện thao tác này.`)
    setBusy(workOrderId); setError(''); setMessage('')
    try {
      const result = await transitionLiveMaintenance({ workOrderId, workflowAction: action, operationId: operationId(`maintenance-${action.toLowerCase()}`) })
      applyCachedMutation()
      setMessage(`${workOrderId}: ${statusLabel[result.result.status] || result.result.status}`)
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể chuyển trạng thái lệnh công việc') }
    finally { setBusy('') }
  }

  return <div className="maintenance-page">
    <section className="maintenance-summary" aria-label="Tổng quan bảo trì">
      <article><span>Cần tôi xử lý</span><strong>{actionCount}</strong><small>{criticalActionCount} lệnh khẩn cấp</small></article>
      <article><span>Đang sửa chữa</span><strong>{inProgressCount}</strong><small>Đang thực hiện công việc</small></article>
      <article><span>Chờ xác nhận</span><strong>{verifyCount}</strong><small>Chạy thử / bàn giao</small></article>
      <article><span>Đã bàn giao</span><strong>{releasedCount}</strong><small>Quy trình hoàn tất</small></article>
    </section>

    <section className="maintenance-surface" aria-labelledby="maintenance-title">
      <header className="maintenance-header">
        <div><p className="eyebrow">Work Order · IATF workflow</p><h2 id="maintenance-title">Hàng đợi bảo trì</h2><p>Mặc định chỉ hiện các lệnh mà vai trò hiện tại có thể xử lý ngay. Mở lệnh để xem bước tiếp theo, người chịu trách nhiệm và hồ sơ liên quan.</p></div>
        {canCreate ? <button className="maintenance-primary" type="button" onClick={openCreate}>+ Tạo lệnh công việc</button> : <span className="maintenance-readonly">Chỉ xem · {roleLabel[role] || role}</span>}
      </header>

      <div className="maintenance-queue-tabs" aria-label="Nhóm lệnh công việc">
        {MAINTENANCE_QUEUE_FILTERS.map((filter) => <button type="button" key={filter.id} className={queueFilter === filter.id ? 'active' : ''} aria-pressed={queueFilter === filter.id} onClick={() => setQueueFilter(filter.id)}><span>{filter.label}</span><b>{queueCounts[filter.id]}</b></button>)}
      </div>

      <div className="maintenance-toolbar" role="search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã lệnh, mã máy, lý do, người yêu cầu…" aria-label="Tìm lệnh công việc" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Lọc trạng thái chi tiết">
          <option value="ALL">Mọi trạng thái trong nhóm</option>
          {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={() => void refresh()}>↻ Làm mới</button>
      </div>

      {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}
      {error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}
      {loading && !workOrders.length ? <div className="maintenance-state">Đang tải dữ liệu bảo trì…</div> : null}

      {!loading || workOrders.length ? <div className="maintenance-order-list" aria-live="polite">
        {filteredWorkOrders.map((item) => {
          const handover = handoverByWorkOrder.get(item.workOrderId)
          const itemAction = getWorkOrderActionState(item.status, role)
          return <article className={`maintenance-order-card priority-band-${item.priority.toLowerCase()}`} key={item.workOrderId}>
            <header className="maintenance-order-head">
              <div><button className="maintenance-link" type="button" onClick={() => setSelectedId(item.workOrderId)}>{item.workOrderId}</button><small>{sourceLabel[item.sourceType] || item.sourceType || 'Tạo thủ công'}</small></div>
              <div className="maintenance-order-badges"><span className={`maintenance-priority priority-${item.priority.toLowerCase()}`}>{priorityLabel[item.priority] || item.priority || '—'}</span><span className={`maintenance-status status-${item.status.toLowerCase()}`}>{statusLabel[item.status] || item.status}</span></div>
            </header>
            <div className="maintenance-order-body">
              <div className="maintenance-order-equipment"><span>Thiết bị</span><strong>{item.equipmentId}</strong><small>{equipmentName.get(item.equipmentId) || '—'}</small></div>
              <div className="maintenance-order-reason"><span>Lý do / hiện tượng</span><p>{item.reason || '—'}</p></div>
            </div>
            <div className="maintenance-order-meta"><span><b>Yêu cầu:</b> {dateTime(item.requestedAt)}</span><span><b>Người yêu cầu:</b> {item.requestedBy || '—'}</span>{item.plannedStartAt ? <span><b>Dự kiến:</b> {dateTime(item.plannedStartAt)}</span> : null}{handover ? <span className="maintenance-handover yes">BM-05 · Đã chấp nhận</span> : null}</div>
            <footer><div className="maintenance-next-action"><span>Tiếp theo</span><strong>{itemAction.next?.label || 'Quy trình đã hoàn tất'}</strong>{itemAction.next ? <small>{itemAction.actionable ? 'Bạn có quyền xử lý bước này' : `Chờ ${itemAction.owner}`}</small> : null}</div><button className="maintenance-row-action" type="button" onClick={() => setSelectedId(item.workOrderId)}>Mở lệnh</button></footer>
          </article>
        })}
        {!filteredWorkOrders.length ? <div className="maintenance-state">Không có lệnh công việc phù hợp trong nhóm này.</div> : null}
      </div> : null}
    </section>

    {selected ? <div className="maintenance-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId('') }}>
      <aside className="maintenance-drawer" role="dialog" aria-modal="true" aria-labelledby="wo-detail-title">
        <header><div><p className="eyebrow">Chi tiết lệnh công việc</p><h2 id="wo-detail-title">{selected.workOrderId}</h2><p>{selected.equipmentId} · {equipmentName.get(selected.equipmentId) || '—'}</p></div><button type="button" aria-label="Đóng" onClick={() => setSelectedId('')}>×</button></header>
        <div className="maintenance-detail-grid">
          <div><span>Trạng thái</span><strong>{statusLabel[selected.status] || selected.status}</strong></div>
          <div><span>Ưu tiên</span><strong>{priorityLabel[selected.priority] || selected.priority || '—'}</strong></div>
          <div><span>Nguồn</span><strong>{sourceLabel[selected.sourceType] || selected.sourceType || '—'}</strong></div>
          <div><span>Người yêu cầu</span><strong>{selected.requestedBy || '—'}</strong></div>
          <div><span>Thời gian yêu cầu</span><strong>{dateTime(selected.requestedAt)}</strong></div>
          <div><span>BM-05</span><strong>{selectedHandover ? `${selectedHandover.handoverId} · Đã chấp nhận` : 'Chưa chấp nhận'}</strong></div>
          <div><span>Bắt đầu dự kiến</span><strong>{dateTime(selected.plannedStartAt)}</strong></div>
          <div><span>Kết thúc dự kiến</span><strong>{dateTime(selected.plannedEndAt)}</strong></div>
        </div>
        <section className="maintenance-detail-section"><span>Lý do / hiện tượng</span><p>{selected.reason || '—'}</p></section>
        {selected.method ? <section className="maintenance-detail-section"><span>Xử lý dự kiến / ghi chú tiếp nhận</span><p>{selected.method}</p></section> : null}
        {selected.approvedBy ? <section className="maintenance-detail-section"><span>Phê duyệt</span><p>{selected.approvedBy} · {dateTime(selected.approvedAt)}</p></section> : null}
        {selectedAction ? <section className={`maintenance-action-callout ${selectedAction.actionable ? 'ready' : 'waiting'}`} aria-label="Việc cần làm tiếp"><span>Việc cần làm tiếp</span><strong>{selectedAction.next?.label || 'Quy trình đã hoàn tất'}</strong><small>{selectedAction.next ? selectedAction.actionable ? `Vai trò ${roleLabel[role] || role} có thể thực hiện ngay.` : `Đang chờ ${selectedAction.owner} thực hiện bước này.` : 'Lệnh công việc đã được bàn giao và đóng quy trình.'}</small></section> : null}
        <MaintenanceSpareFlow equipmentId={selected.equipmentId} workOrderId={selected.workOrderId} />
        <div className="maintenance-workflow" aria-label="Tiến độ lệnh công việc">{WORKFLOW_STAGES.map((stage, index) => <div key={stage} className={`maintenance-workflow-step${index < selectedStage ? ' done' : ''}${index === selectedStage ? ' active' : ''}`}><span>{index < selectedStage ? '✓' : index + 1}</span><small>{stage}</small></div>)}</div>
        <footer>{selectedNext ? <>
          {selected.status === 'VERIFIED' && !selectedHandover ? <p className="maintenance-release-lock">Cần BM-05 được chấp nhận trước khi bàn giao.</p> : null}
          {selectedAction?.actionable ? <button className="maintenance-primary" type="button" disabled={busy === selected.workOrderId || (selected.status === 'VERIFIED' && !selectedHandover)} onClick={() => void advance(selected.workOrderId, selectedNext.action)}>{busy === selected.workOrderId ? 'Đang xử lý…' : selectedNext.label}</button> : <span className="maintenance-readonly">Chờ {selectedAction?.owner}: {selectedNext.label}</span>}
        </> : <span className="maintenance-complete">Quy trình đã hoàn tất</span>}</footer>
      </aside>
    </div> : null}

    {createOpen && canCreate ? <div className="maintenance-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false) }}>
      <aside className="maintenance-drawer create" role="dialog" aria-modal="true" aria-labelledby="create-wo-title">
        <header><div><p className="eyebrow">Tiếp nhận công việc</p><h2 id="create-wo-title">Tạo yêu cầu bảo trì</h2><p>Ghi đủ hiện tượng, mức ưu tiên và thời gian dự kiến để người xử lý nhận việc ngay.</p></div><button type="button" aria-label="Đóng" onClick={() => setCreateOpen(false)}>×</button></header>
        <form className="maintenance-create-form" onSubmit={onCreate}>
          <label><span>Thiết bị *</span><select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} required>{equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentId} · {item.equipmentName}</option>)}</select></label>
          <label><span>Mức ưu tiên *</span><select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="CRITICAL">Khẩn cấp</option></select></label>
          <div className={`maintenance-priority-guide wide priority-${priority.toLowerCase()}`} role="note"><strong>{priorityLabel[priority]}</strong><span>{priorityGuide[priority]}</span></div>
          <label className="wide"><span>Lý do / hiện tượng *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={5} required autoFocus placeholder="Mô tả hiện tượng quan sát được, vị trí lỗi, tình trạng máy…" /></label>
          <label className="wide"><span>Xử lý dự kiến / ghi chú tiếp nhận</span><textarea value={method} onChange={(event) => setMethod(event.target.value)} rows={3} placeholder="Ví dụ: kiểm tra motor, thay bạc đạn, cần nhà cung cấp hỗ trợ…" /></label>
          <label><span>Bắt đầu dự kiến</span><input type="datetime-local" value={plannedStartAt} onChange={(event) => setPlannedStartAt(event.target.value)} /></label>
          <label><span>Kết thúc dự kiến</span><input type="datetime-local" value={plannedEndAt} onChange={(event) => setPlannedEndAt(event.target.value)} /></label>
          {createError ? <div className="maintenance-form-error wide" role="alert">{createError}</div> : null}
          <footer><button type="button" onClick={() => setCreateOpen(false)}>Hủy</button><button className="maintenance-primary" type="submit" disabled={busy === 'create' || !equipment.length}>{busy === 'create' ? 'Đang tạo…' : 'Tạo lệnh công việc'}</button></footer>
        </form>
      </aside>
    </div> : null}
  </div>
}
