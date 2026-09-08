import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './EquipmentProfileOps.css'
import { canCreateMaintenance, useAppRole } from './auth/AppRoleContext'
import type { LiveEquipment } from './data/liveEquipment'
import { createManualWorkOrder, loadLiveMaintenance } from './data/liveMaintenance'
import { loadSpareParts, saveSparePart, type LiveSparePart } from './data/liveSpareParts'
import type { EquipmentHistory } from './data/supabaseEquipment'

type Props = {
  equipment: LiveEquipment
  history: EquipmentHistory
  issueOpen: boolean
  onIssueOpenChange: (open: boolean) => void
  onNavigate: (view: 'maintenance' | 'inspection' | 'spare' | 'qr') => void
  onHistoryRefresh: () => void
}

const OPEN_WO = new Set(['OPEN','WAITING_APPROVAL','APPROVED','IN_PROGRESS','COMPLETED','VERIFIED'])
const statusLabel: Record<string,string> = { OPEN:'Mở', WAITING_APPROVAL:'Chờ phê duyệt', APPROVED:'Đã phê duyệt', IN_PROGRESS:'Đang xử lý', COMPLETED:'Đã hoàn tất', VERIFIED:'Đã xác nhận' }
const classificationLabel: Record<string,string> = { NORMAL:'Thông thường', RECOMMENDED:'Khuyến nghị dự trữ', REQUIRED:'Bắt buộc dự trữ' }
const resultLabel: Record<string,string> = { PASS:'Đạt', FAIL:'Không đạt', LIMITED_USE:'Sử dụng hạn chế' }
const roleLabel: Record<string,string> = { MAINTENANCE:'Bảo trì', SUPERVISOR:'Giám sát', QUALITY:'Chất lượng', MANAGER:'Quản lý', ADMIN:'Quản trị hệ thống', UNKNOWN:'Chưa xác định' }

function dateValue(value: unknown) {
  const date = value ? new Date(String(value)) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function formatDate(value: unknown) {
  const date = dateValue(value)
  return date ? date.toLocaleDateString('vi-VN') : '—'
}

function eventTime(row: Record<string, unknown>) {
  return String(row.created_at || row.started_at || row.inspection_date || row.calibration_date || '')
}

export function EquipmentProfileOps({ equipment, history, issueOpen, onIssueOpenChange, onNavigate, onHistoryRefresh }: Props) {
  const role = useAppRole()
  const canCreateWo = canCreateMaintenance(role)
  const canLinkSpare = ['MAINTENANCE','MANAGER','ADMIN'].includes(role)
  const [maintenance, setMaintenance] = useState<Awaited<ReturnType<typeof loadLiveMaintenance>> | null>(null)
  const [parts, setParts] = useState<LiveSparePart[]>([])
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState<'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'>('MEDIUM')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [partToLink, setPartToLink] = useState('')
  const [partQuery, setPartQuery] = useState('')

  async function refreshContext() {
    const [maintenanceResult, partResult] = await Promise.all([loadLiveMaintenance(), loadSpareParts()])
    setMaintenance(maintenanceResult)
    setParts(partResult)
  }

  useEffect(() => {
    let active = true
    void Promise.all([loadLiveMaintenance(), loadSpareParts()])
      .then(([maintenanceResult, partResult]) => {
        if (!active) return
        setMaintenance(maintenanceResult)
        setParts(partResult)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được ngữ cảnh thiết bị') })
    return () => { active = false }
  }, [])

  const linkedParts = useMemo(() => parts.filter((part) => part.equipment.some((item) => item.equipmentId === equipment.equipmentId)), [parts, equipment.equipmentId])
  const unlinkedParts = useMemo(() => {
    const query = partQuery.trim().toLowerCase()
    return parts.filter((part) => !part.equipment.some((item) => item.equipmentId === equipment.equipmentId))
      .filter((part) => !query || [part.partId, part.partName, part.partNumber, part.maker].join(' ').toLowerCase().includes(query))
      .slice(0, 40)
  }, [parts, equipment.equipmentId, partQuery])

  const openWorkOrders = useMemo(() => (maintenance?.workOrders || []).filter((item) => item.equipmentId === equipment.equipmentId && OPEN_WO.has(item.status)), [maintenance, equipment.equipmentId])
  const overduePlans = useMemo(() => (maintenance?.plans || []).filter((item) => item.equipmentId === equipment.equipmentId && item.status === 'OVERDUE'), [maintenance, equipment.equipmentId])
  const latestCalibration = history.calibration[0]
  const calibrationDue = latestCalibration ? dateValue(latestCalibration.next_due_date) : null
  const calibrationOverdue = Boolean(calibrationDue && calibrationDue.getTime() < new Date().setHours(0,0,0,0))
  const abnormalInspections = history.inspections.filter((row) => {
    const mark = String(row.overall_mark || '').trim().toUpperCase()
    return Boolean(mark && !['V','OK','PASS','GOOD'].includes(mark)) || Boolean(String(row.note || '').trim())
  }).slice(0, 3)

  const alerts = [
    ...openWorkOrders.map((item) => ({ key: item.workOrderId, tone: item.priority === 'CRITICAL' ? 'danger' : 'warn', title: `${item.workOrderId} · ${statusLabel[item.status] || item.status}`, detail: item.reason || 'Lệnh công việc đang mở' })),
    ...overduePlans.map((item) => ({ key: item.planId, tone: 'danger', title: `Bảo dưỡng quá hạn · ${item.planId}`, detail: item.plannedDate || item.maintenanceType || 'Kế hoạch bảo dưỡng cần xử lý' })),
    ...(calibrationOverdue ? [{ key: 'calibration-due', tone: 'danger', title: 'Hiệu chuẩn quá hạn', detail: `Hạn: ${formatDate(latestCalibration?.next_due_date)}` }] : []),
    ...abnormalInspections.map((row, index) => ({ key: `inspection-${index}`, tone: 'warn', title: `Kiểm tra bất thường · ${String(row.overall_mark || 'Có ghi chú')}`, detail: String(row.note || row.inspection_date || '') })),
  ].slice(0, 6)

  const timeline = useMemo(() => {
    const events: Array<{ key: string; time: string; type: string; title: string }> = []
    history.maintenance.forEach((row, index) => events.push({ key:`m-${index}`, time:eventTime(row), type:'Bảo trì', title:`${String(row.work_order_id || 'Lệnh')} · ${String(row.reason || statusLabel[String(row.status || '')] || row.status || '')}` }))
    history.downtime.forEach((row, index) => events.push({ key:`d-${index}`, time:eventTime(row), type:'Dừng máy', title:`Sự kiện dừng máy${row.work_order_id ? ` · ${String(row.work_order_id)}` : ''}` }))
    history.inspections.forEach((row, index) => events.push({ key:`i-${index}`, time:eventTime(row), type:'Kiểm tra', title:`${String(row.overall_mark || '—')}${row.note ? ` · ${String(row.note)}` : ''}` }))
    history.calibration.forEach((row, index) => events.push({ key:`c-${index}`, time:eventTime(row), type:'Hiệu chuẩn', title: resultLabel[String(row.result || '')] || String(row.result || '—') }))
    history.movements.forEach((row, index) => events.push({ key:`mv-${index}`, time:eventTime(row), type:'Di chuyển', title:`${String(row.from_location || '—')} → ${String(row.to_location || '—')}` }))
    return events.toSorted((a,b) => (dateValue(b.time)?.getTime() || 0) - (dateValue(a.time)?.getTime() || 0)).slice(0, 8)
  }, [history])

  async function submitIssue(event: FormEvent) {
    event.preventDefault()
    if (!canCreateWo || !reason.trim()) return
    setBusy('issue'); setMessage(''); setError('')
    try {
      const result = await createManualWorkOrder({
        operationId: `qr-issue-${crypto.randomUUID()}`,
        input: { equipmentId: equipment.equipmentId, sourceType: 'QR_PROFILE', sourceId: equipment.equipmentId, reason: reason.trim(), priority, method: '', plannedStartAt: '', plannedEndAt: '' },
      })
      setMessage(`Đã tạo ${result.result.workOrderId}`)
      setReason('')
      onIssueOpenChange(false)
      await refreshContext()
      onHistoryRefresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo lệnh công việc') }
    finally { setBusy('') }
  }

  async function linkPart() {
    const part = parts.find((item) => item.partId === partToLink)
    if (!part || !canLinkSpare) return
    setBusy('part'); setMessage(''); setError('')
    try {
      await saveSparePart({
        partId: part.partId,
        partName: part.partName,
        partNumber: part.partNumber,
        maker: part.maker,
        stockQty: part.stockQty,
        minQty: part.minQty,
        location: part.location,
        leadTimeDays: part.leadTimeDays,
        stopsProduction: part.stopsProduction,
        qualitySafetyImpact: part.qualitySafetyImpact,
        leadTimeExceedsRecovery: part.leadTimeExceedsRecovery,
        rationaleNote: part.rationaleNote,
        equipmentIds: Array.from(new Set([...part.equipment.map((item) => item.equipmentId), equipment.equipmentId])),
      })
      setPartToLink('')
      setPartQuery('')
      setMessage(`Đã liên kết ${part.partId} với ${equipment.equipmentId}`)
      await refreshContext()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể liên kết phụ tùng') }
    finally { setBusy('') }
  }

  return <div className="equipment-profile-ops">
    {message ? <div className="equipment-profile-ops-state success">{message}</div> : null}
    {error ? <div className="equipment-profile-ops-state error">{error}</div> : null}

    <section className="equipment-profile-attention">
      <header><div><p className="eyebrow">Ưu tiên xử lý</p><h3>Việc cần chú ý</h3></div><button type="button" onClick={() => onNavigate('maintenance')}>Mở bảo trì</button></header>
      {alerts.length ? <div className="equipment-profile-alert-list">{alerts.map((item) => <article key={item.key} className={item.tone}><strong>{item.title}</strong><span>{item.detail}</span></article>)}</div> : <div className="equipment-profile-all-good">Không có cảnh báo đang mở từ dữ liệu hiện tại.</div>}
    </section>

    {issueOpen ? <section className="equipment-profile-quick-issue">
      <header><div><h3>Báo sự cố nhanh</h3><p>{equipment.equipmentId} · {equipment.equipmentName}</p></div><button type="button" onClick={() => onIssueOpenChange(false)}>×</button></header>
      {canCreateWo ? <form onSubmit={submitIssue}>
        <label><span>Hiện tượng / vấn đề *</span><textarea autoFocus rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: xi lanh không về, cảm biến không nhận, vít lỏng…" required /></label>
        <label><span>Ưu tiên</span><select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="CRITICAL">Khẩn cấp</option></select></label>
        <button className="equipment-profile-action-primary" disabled={busy === 'issue' || !reason.trim()}>{busy === 'issue' ? 'Đang tạo…' : 'Tạo lệnh công việc ngay'}</button>
      </form> : <p>Vai trò {roleLabel[role] || role} không có quyền tạo lệnh công việc.</p>}
    </section> : null}

    <section className="equipment-profile-spares">
      <header><div><p className="eyebrow">Phụ tùng của thiết bị</p><h3>Phụ tùng liên kết</h3><p>Nhìn máy nhớ cảm biến, xi lanh, vít… thì liên kết ngay vào đúng thiết bị.</p></div><button type="button" onClick={() => onNavigate('spare')}>Mở danh mục phụ tùng</button></header>
      {linkedParts.length ? <div className="equipment-profile-spare-grid">{linkedParts.map((part) => <article key={part.partId}>
        <div><strong>{part.partName}</strong><span>{part.partId}{part.partNumber ? ` · ${part.partNumber}` : ''}</span></div>
        <div className="equipment-profile-spare-meta"><span>{part.maker || '—'}</span><span>Tồn {part.stockQty} / Tối thiểu {part.minQty}</span><b className={part.classification.toLowerCase()}>{classificationLabel[part.classification] || part.classification}</b></div>
      </article>)}</div> : <div className="equipment-profile-all-good">Chưa liên kết phụ tùng nào với thiết bị này.</div>}
      {canLinkSpare ? <div className="equipment-profile-link-spare">
        <input type="search" value={partQuery} onChange={(event) => setPartQuery(event.target.value)} placeholder="Tìm mã phụ tùng, tên, mã linh kiện, hãng…" />
        <select value={partToLink} onChange={(event) => setPartToLink(event.target.value)}><option value="">Chọn phụ tùng có sẵn</option>{unlinkedParts.map((part) => <option key={part.partId} value={part.partId}>{part.partId} · {part.partName}{part.partNumber ? ` · ${part.partNumber}` : ''}</option>)}</select>
        <button type="button" onClick={() => void linkPart()} disabled={!partToLink || busy === 'part'}>{busy === 'part' ? 'Đang liên kết…' : 'Liên kết với máy này'}</button>
      </div> : null}
    </section>

    <section className="equipment-profile-timeline">
      <header><h3>Sự kiện gần nhất</h3><span>{timeline.length} sự kiện</span></header>
      {timeline.length ? <div>{timeline.map((item) => <article key={item.key}><time>{formatDate(item.time)}</time><b>{item.type}</b><span>{item.title}</span></article>)}</div> : <div className="equipment-profile-all-good">Chưa có sự kiện nghiệp vụ.</div>}
    </section>
  </div>
}
