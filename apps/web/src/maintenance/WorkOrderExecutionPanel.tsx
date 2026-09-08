import { useEffect, useMemo, useState } from 'react'
import { useAppRole } from '../auth/AppRoleContext'
import { loadMaintenanceExecutionDetail, saveMaintenanceExecutionDetail, type MaintenanceExecutionDetail } from '../data/maintenanceExecution'
import './WorkOrderExecutionPanel.css'

const CAUSES = [
  ['','— Chưa phân loại —'],
  ['MECHANICAL','Hỏng cơ khí'],
  ['ELECTRICAL','Hỏng điện'],
  ['WAITING_MATERIAL','Chờ vật tư'],
  ['UNPLANNED_MAINTENANCE','Bảo dưỡng đột xuất'],
  ['SETUP_CHANGEOVER','Chuẩn bị / thay khuôn'],
  ['PROCESS_ERROR','Lỗi quy trình'],
  ['OTHER','Khác'],
] as const

function localInput(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
function iso(value: string) { return value ? new Date(value).toISOString() : '' }
function dateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}
function operationId(workOrderId: string) { return `execution-${workOrderId}-${crypto.randomUUID()}` }

export function WorkOrderExecutionPanel({ workOrderId }: { workOrderId: string }) {
  const role = useAppRole()
  const [detail, setDetail] = useState<MaintenanceExecutionDetail | null>(null)
  const canEdit = detail?.status !== 'RELEASED' && ['MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN'].includes(role)
  const [rootCause, setRootCause] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [executionNote, setExecutionNote] = useState('')
  const [actualStartAt, setActualStartAt] = useState('')
  const [actualCompletedAt, setActualCompletedAt] = useState('')
  const [downtimeStartedAt, setDowntimeStartedAt] = useState('')
  const [downtimeEndedAt, setDowntimeEndedAt] = useState('')
  const [downtimeCauseCategory, setDowntimeCauseCategory] = useState('')
  const [downtimeDetail, setDowntimeDetail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    void loadMaintenanceExecutionDetail(workOrderId)
      .then((next) => {
        if (!active) return
        setDetail(next)
        setRootCause(next.rootCause)
        setCorrectiveAction(next.correctiveAction)
        setPreventiveAction(next.preventiveAction)
        setExecutionNote(next.executionNote)
        setActualStartAt(localInput(next.actualStartAt))
        setActualCompletedAt(localInput(next.actualCompletedAt))
        setDowntimeStartedAt(localInput(next.downtimeStartedAt))
        setDowntimeEndedAt(localInput(next.downtimeEndedAt))
        setDowntimeCauseCategory(next.downtimeCauseCategory)
        setDowntimeDetail(next.downtimeDetail)
        setError('')
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu thực hiện') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workOrderId])

  const downtimeMinutes = useMemo(() => {
    if (!downtimeStartedAt || !downtimeEndedAt) return 0
    const start = new Date(downtimeStartedAt).getTime(); const end = new Date(downtimeEndedAt).getTime()
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 60000) : 0
  }, [downtimeStartedAt, downtimeEndedAt])

  async function save() {
    if (!canEdit) return
    if (actualStartAt && actualCompletedAt && new Date(actualCompletedAt).getTime() < new Date(actualStartAt).getTime()) return setError('Thời gian hoàn tất thực tế phải sau thời gian bắt đầu.')
    if (downtimeStartedAt && downtimeEndedAt && new Date(downtimeEndedAt).getTime() < new Date(downtimeStartedAt).getTime()) return setError('Thời gian chạy lại phải sau thời điểm dừng máy.')
    setSaving(true); setError(''); setMessage('')
    try {
      await saveMaintenanceExecutionDetail({
        workOrderId, rootCause, correctiveAction, preventiveAction, executionNote,
        actualStartAt: iso(actualStartAt), actualCompletedAt: iso(actualCompletedAt),
        downtimeStartedAt: iso(downtimeStartedAt), downtimeEndedAt: iso(downtimeEndedAt),
        downtimeCauseCategory, downtimeDetail,
        operationId: operationId(workOrderId),
      })
      const next = await loadMaintenanceExecutionDetail(workOrderId)
      setDetail(next)
      setMessage('Đã lưu dữ liệu thực hiện và audit trail.')
      window.dispatchEvent(new CustomEvent('cev:maintenance-execution-changed', { detail: { workOrderId } }))
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : 'Không thể lưu dữ liệu thực hiện'
      setError(raw.replace('WORK_ORDER_ALREADY_RELEASED', 'Lệnh đã bàn giao, không thể chỉnh sửa.').replace('DOWNTIME_END_BEFORE_START', 'Thời gian chạy lại phải sau thời điểm dừng máy.'))
    } finally { setSaving(false) }
  }

  return <section className="wo-execution" aria-labelledby={`wo-execution-${workOrderId}`}>
    <header>
      <div><span>Execution record</span><h3 id={`wo-execution-${workOrderId}`}>Thực hiện sửa chữa</h3><p>Ghi nguyên nhân, biện pháp xử lý và thời gian thực tế ngay trong Work Order.</p></div>
      <strong>{detail?.actualCompletedAt ? 'Đã ghi hoàn tất' : detail?.actualStartAt ? 'Đang thực hiện' : 'Chưa ghi thực tế'}</strong>
    </header>
    {loading ? <p className="wo-execution-state">Đang tải dữ liệu thực hiện…</p> : <div className="wo-execution-body">
      <div className="wo-execution-grid">
        <label className="wide"><span>Nguyên nhân gốc</span><textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} disabled={!canEdit} placeholder="Ví dụ: bạc đạn motor mòn gây rung và tăng nhiệt…" /></label>
        <label className="wide"><span>Biện pháp xử lý / khắc phục</span><textarea rows={3} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} disabled={!canEdit} placeholder="Nội dung đã thực hiện để khôi phục thiết bị…" /></label>
        <label className="wide"><span>Phòng ngừa tái diễn</span><textarea rows={2} value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} disabled={!canEdit} /></label>
        <label className="wide"><span>Ghi chú thực hiện</span><textarea rows={2} value={executionNote} onChange={(e) => setExecutionNote(e.target.value)} disabled={!canEdit} /></label>
        <label><span>Bắt đầu thực tế</span><input type="datetime-local" value={actualStartAt} onChange={(e) => setActualStartAt(e.target.value)} disabled={!canEdit} /></label>
        <label><span>Hoàn tất thực tế</span><input type="datetime-local" value={actualCompletedAt} onChange={(e) => setActualCompletedAt(e.target.value)} disabled={!canEdit} /></label>
      </div>

      <section className="wo-execution-downtime">
        <header><div><span>Downtime</span><b>Dừng máy liên quan</b></div>{downtimeMinutes ? <strong>{downtimeMinutes.toLocaleString('vi-VN')} phút</strong> : <small>{detail?.downtimeId || 'Chưa có sự kiện'}</small>}</header>
        <div className="wo-execution-grid">
          <label><span>Thời điểm dừng</span><input type="datetime-local" value={downtimeStartedAt} onChange={(e) => setDowntimeStartedAt(e.target.value)} disabled={!canEdit} /></label>
          <label><span>Thời điểm chạy lại</span><input type="datetime-local" value={downtimeEndedAt} onChange={(e) => setDowntimeEndedAt(e.target.value)} disabled={!canEdit || !downtimeStartedAt} /></label>
          <label><span>Nhóm nguyên nhân</span><select value={downtimeCauseCategory} onChange={(e) => setDowntimeCauseCategory(e.target.value)} disabled={!canEdit}>{CAUSES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide"><span>Mô tả dừng máy</span><input value={downtimeDetail} onChange={(e) => setDowntimeDetail(e.target.value)} disabled={!canEdit} /></label>
        </div>
      </section>

      <div className="wo-execution-audit"><span>Verify</span><b>{detail?.verifiedBy || '—'}</b><small>{dateTime(detail?.verifiedAt || '')}</small><span>Release</span><b>{detail?.releasedBy || '—'}</b><small>{dateTime(detail?.releasedAt || '')}</small></div>
      {canEdit ? <button className="wo-execution-save" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu dữ liệu thực hiện'}</button> : <p className="wo-execution-state">Lệnh đã bàn giao, dữ liệu thực hiện chỉ đọc.</p>}
    </div>}
    {message ? <div className="wo-execution-message success" role="status">{message}</div> : null}
    {error ? <div className="wo-execution-message error" role="alert">{error}</div> : null}
  </section>
}
