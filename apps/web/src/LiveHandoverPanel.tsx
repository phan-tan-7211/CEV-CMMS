import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './Maintenance.css'
import { canTransitionMaintenance, useAppRole } from './auth/AppRoleContext'
import { loadLiveMaintenance, type LiveHandover, type LiveMaintenanceWorkOrder, type MaintenanceEquipmentOption } from './data/liveMaintenance'
import { recordEquipmentHandover, type EquipmentHandoverInput } from './data/liveHandover'

function nowLocal() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function emptyDraft(): EquipmentHandoverInput {
  return {
    workOrderId: '', equipmentId: '', handoverAt: nowLocal(), location: '', chairDepartment: 'Sản xuất', meetingContent: 'Bàn giao thiết bị', participants: '',
    handoverPerson: '', handoverTitle: '', handoverDepartment: 'Bảo trì', receiverPerson: '', receiverTitle: '', receiverDepartment: 'Sản xuất',
    handoverReason: 'Hoàn thành sửa chữa', equipmentCondition: 'NORMAL', attachedItems: '', handoverComment: '', receiverComment: '', otherAgreement: '', accepted: true,
  }
}

export function LiveHandoverPanel() {
  const role = useAppRole()
  const canWrite = canTransitionMaintenance(role, 'RELEASE')
  const [workOrders, setWorkOrders] = useState<LiveMaintenanceWorkOrder[]>([])
  const [equipment, setEquipment] = useState<MaintenanceEquipmentOption[]>([])
  const [handovers, setHandovers] = useState<LiveHandover[]>([])
  const [draft, setDraft] = useState<EquipmentHandoverInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async () => {
    const result = await loadLiveMaintenance()
    setWorkOrders(result.workOrders.filter((row) => row.status === 'VERIFIED'))
    setEquipment(result.equipment)
    setHandovers(result.handovers)
  }

  useEffect(() => {
    let active = true
    void loadLiveMaintenance()
      .then((result) => {
        if (!active) return
        setWorkOrders(result.workOrders.filter((row) => row.status === 'VERIFIED'))
        setEquipment(result.equipment)
        setHandovers(result.handovers)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải BM05') })
    return () => { active = false }
  }, [])
  const equipmentName = useMemo(() => new Map(equipment.map((row) => [row.equipmentId, row.equipmentName])), [equipment])

  const chooseWorkOrder = (workOrderId: string) => {
    if (!draft) return
    const wo = workOrders.find((row) => row.workOrderId === workOrderId)
    setDraft({ ...draft, workOrderId, equipmentId: wo?.equipmentId || draft.equipmentId })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft || !canWrite) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await recordEquipmentHandover(draft)
      setMessage(`Đã lập ${result.handoverId}${result.accepted ? ' · bên nhận đã chấp nhận' : ' · chưa chấp nhận'}`)
      setDraft(null)
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu BM05') }
    finally { setBusy(false) }
  }

  return <section className="maintenance-surface" aria-labelledby="bm05-title">
    <header className="maintenance-header">
      <div><p className="eyebrow">BM-TBSX-05</p><h3 id="bm05-title">Biên bản bàn giao trang thiết bị</h3><p>Bàn giao trách nhiệm, tình trạng và hồ sơ/phụ kiện giữa hai bên.</p></div>
      {canWrite ? <button className="maintenance-primary" type="button" onClick={() => setDraft(emptyDraft())}>+ Lập BM05</button> : <span className="maintenance-readonly">Chỉ xem · {role}</span>}
    </header>
    {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}
    {error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}

    {handovers.length ? <div className="maintenance-table-scroll"><table className="maintenance-table"><thead><tr><th>Số biên bản</th><th>Lệnh công việc</th><th>Thiết bị</th><th>Tình trạng</th><th>Chấp nhận</th><th>Ngày lập</th></tr></thead><tbody>{handovers.map((row) => <tr key={row.handoverId}><td><b>{row.handoverId}</b></td><td>{row.workOrderId || '—'}</td><td>{row.equipmentId}<small>{equipmentName.get(row.equipmentId) || ''}</small></td><td>{row.condition || '—'}</td><td><span className={`maintenance-handover ${row.accepted ? 'yes' : ''}`}>{row.accepted ? 'Đã nhận' : 'Chưa nhận'}</span></td><td>{row.handoverAt ? new Date(row.handoverAt).toLocaleString('vi-VN') : '—'}</td></tr>)}</tbody></table></div> : <div className="maintenance-state">Chưa có biên bản BM05.</div>}

    {draft && canWrite ? <div className="maintenance-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}><aside className="maintenance-drawer maintenance-plan-drawer" role="dialog" aria-modal="true" aria-labelledby="bm05-form-title">
      <header><div><p className="eyebrow">CEV-BM-TBSX-05</p><h2 id="bm05-form-title">Biên bản bàn giao</h2></div><button type="button" aria-label="Đóng" onClick={() => setDraft(null)}>×</button></header>
      <form className="maintenance-create-form" onSubmit={submit}>
        <label className="wide"><span>Lệnh công việc sau sửa chữa (nếu có)</span><select value={draft.workOrderId} onChange={(event) => chooseWorkOrder(event.target.value)}><option value="">Không gắn lệnh công việc</option>{workOrders.map((row) => <option key={row.workOrderId} value={row.workOrderId}>{row.workOrderId} · {row.equipmentId}</option>)}</select></label>
        <label><span>Mã thiết bị</span><select value={draft.equipmentId} disabled={!!draft.workOrderId} onChange={(event) => setDraft({ ...draft, equipmentId: event.target.value })}><option value="">Chọn thiết bị</option>{equipment.map((row) => <option key={row.equipmentId} value={row.equipmentId}>{row.equipmentId} · {row.equipmentName}</option>)}</select></label>
        <label><span>Ngày/Giờ bàn giao</span><input type="datetime-local" value={draft.handoverAt} onChange={(event) => setDraft({ ...draft, handoverAt: event.target.value })} /></label>
        <label><span>Địa điểm</span><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
        <label><span>Bộ phận chủ trì</span><input value={draft.chairDepartment} onChange={(event) => setDraft({ ...draft, chairDepartment: event.target.value })} /></label>
        <label className="wide"><span>Nội dung họp</span><input value={draft.meetingContent} onChange={(event) => setDraft({ ...draft, meetingContent: event.target.value })} /></label>
        <label className="wide"><span>Thành phần tham gia</span><input value={draft.participants} onChange={(event) => setDraft({ ...draft, participants: event.target.value })} /></label>

        <label><span>Bên giao · Họ tên</span><input required value={draft.handoverPerson} onChange={(event) => setDraft({ ...draft, handoverPerson: event.target.value })} /></label>
        <label><span>Chức vụ</span><input value={draft.handoverTitle} onChange={(event) => setDraft({ ...draft, handoverTitle: event.target.value })} /></label>
        <label><span>Bộ phận bên giao</span><input value={draft.handoverDepartment} onChange={(event) => setDraft({ ...draft, handoverDepartment: event.target.value })} /></label>
        <label><span>Bên nhận · Họ tên</span><input required value={draft.receiverPerson} onChange={(event) => setDraft({ ...draft, receiverPerson: event.target.value })} /></label>
        <label><span>Chức vụ</span><input value={draft.receiverTitle} onChange={(event) => setDraft({ ...draft, receiverTitle: event.target.value })} /></label>
        <label><span>Bộ phận bên nhận</span><input value={draft.receiverDepartment} onChange={(event) => setDraft({ ...draft, receiverDepartment: event.target.value })} /></label>

        <label className="wide"><span>Lý do bàn giao</span><input required value={draft.handoverReason} onChange={(event) => setDraft({ ...draft, handoverReason: event.target.value })} /></label>
        <label className="wide"><span>Tình trạng thiết bị</span><select value={draft.equipmentCondition} onChange={(event) => setDraft({ ...draft, equipmentCondition: event.target.value as EquipmentHandoverInput['equipmentCondition'] })}><option value="NORMAL">Hoạt động bình thường</option><option value="MINOR_ISSUE">Có lỗi nhỏ cần theo dõi</option><option value="NOT_OPERATIONAL">Chưa hoạt động được</option></select></label>
        <label className="wide"><span>Tài liệu / phụ kiện kèm theo</span><textarea rows={2} value={draft.attachedItems} onChange={(event) => setDraft({ ...draft, attachedItems: event.target.value })} /></label>
        <label className="wide"><span>Ý kiến bên giao</span><textarea rows={2} value={draft.handoverComment} onChange={(event) => setDraft({ ...draft, handoverComment: event.target.value })} /></label>
        <label className="wide"><span>Ý kiến bên nhận</span><textarea rows={2} value={draft.receiverComment} onChange={(event) => setDraft({ ...draft, receiverComment: event.target.value })} /></label>
        <label className="wide"><span>Thỏa thuận khác</span><textarea rows={2} value={draft.otherAgreement} onChange={(event) => setDraft({ ...draft, otherAgreement: event.target.value })} /></label>
        <label className="wide"><span><input type="checkbox" checked={draft.accepted} onChange={(event) => setDraft({ ...draft, accepted: event.target.checked })} /> Bên nhận xác nhận đúng/đủ và chấp nhận tình trạng mô tả</span></label>
        <footer><button type="button" onClick={() => setDraft(null)}>Hủy</button><button className="maintenance-primary" type="submit" disabled={busy || !draft.equipmentId}>{busy ? 'Đang lưu…' : 'Lưu BM05'}</button></footer>
      </form>
    </aside></div> : null}
  </section>
}
