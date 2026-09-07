import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './MaintenanceSpareFlow.css'
import { WorkOrderAssignmentPanel } from './maintenance/WorkOrderAssignmentPanel'
import { WorkOrderExecutionPanel } from './maintenance/WorkOrderExecutionPanel'
import { loadSpareParts, loadWorkOrderSpareUsage, recordSpareUsage, saveSparePart, type LiveSparePart, type SpareUsage } from './data/liveSpareParts'

type Props = {
  equipmentId: string
  workOrderId: string
}

type NewPartForm = {
  partName: string
  partNumber: string
  maker: string
  stockQty: string
  minQty: string
  location: string
  leadTimeDays: string
  stopsProduction: boolean
  qualitySafetyImpact: boolean
  leadTimeExceedsRecovery: boolean
  rationaleNote: string
}

const EMPTY_NEW: NewPartForm = {
  partName: '', partNumber: '', maker: '', stockQty: '0', minQty: '0', location: '', leadTimeDays: '',
  stopsProduction: false, qualitySafetyImpact: false, leadTimeExceedsRecovery: false, rationaleNote: '',
}

function dateTime(value: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
}

export function MaintenanceSpareFlow({ equipmentId, workOrderId }: Props) {
  const [parts, setParts] = useState<LiveSparePart[]>([])
  const [usage, setUsage] = useState<SpareUsage[]>([])
  const [mode, setMode] = useState<'EXISTING' | 'NEW'>('EXISTING')
  const [partId, setPartId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [newPart, setNewPart] = useState<NewPartForm>(EMPTY_NEW)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    const [nextParts, nextUsage] = await Promise.all([loadSpareParts(), loadWorkOrderSpareUsage(workOrderId)])
    setParts(nextParts); setUsage(nextUsage); setPartId((current) => current || nextParts[0]?.partId || '')
  }

  useEffect(() => {
    let active = true
    Promise.all([loadSpareParts(), loadWorkOrderSpareUsage(workOrderId)])
      .then(([nextParts, nextUsage]) => {
        if (!active) return
        setParts(nextParts); setUsage(nextUsage); setPartId(nextParts[0]?.partId || '')
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải phụ tùng') })
    return () => { active = false }
  }, [workOrderId])

  const selectedPart = useMemo(() => parts.find((part) => part.partId === partId) || null, [parts, partId])
  const selectedAlreadyMapped = Boolean(selectedPart?.equipment.some((item) => item.equipmentId === equipmentId))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const qty = Math.max(1, Number(quantity) || 1)
    setBusy(true); setError(''); setMessage('')
    try {
      let targetPartId = partId
      if (mode === 'NEW') {
        if (!newPart.partName.trim()) throw new Error('Nhập tên linh kiện mới.')
        const saved = await saveSparePart({
          partId: '', partName: newPart.partName.trim(), partNumber: newPart.partNumber.trim(), maker: newPart.maker.trim(),
          stockQty: Math.max(0, Number(newPart.stockQty) || 0), minQty: Math.max(0, Number(newPart.minQty) || 0), location: newPart.location.trim(),
          leadTimeDays: newPart.leadTimeDays === '' ? null : Math.max(0, Number(newPart.leadTimeDays) || 0), stopsProduction: newPart.stopsProduction,
          qualitySafetyImpact: newPart.qualitySafetyImpact, leadTimeExceedsRecovery: newPart.leadTimeExceedsRecovery,
          rationaleNote: newPart.rationaleNote.trim(), equipmentIds: [equipmentId],
        })
        targetPartId = saved.partId
      }
      if (!targetPartId) throw new Error('Chọn linh kiện đã có hoặc tạo linh kiện mới.')

      await recordSpareUsage({ partId: targetPartId, equipmentId, quantity: qty, reason: reason.trim() || `Thay trong ${workOrderId}`, workOrderId })
      await reload()
      setMode('EXISTING'); setPartId(targetPartId); setQuantity('1'); setReason(''); setNewPart(EMPTY_NEW)
      setMessage(`Đã ghi ${targetPartId} × ${qty}. Hệ thống đã liên kết với ${equipmentId}, cập nhật lịch sử và trừ tồn.`)
    } catch (cause: unknown) {
      const text = cause instanceof Error ? cause.message : 'Không thể ghi linh kiện thay thế'
      setError(text.replace('SPARE_PART_POSSIBLE_DUPLICATE:', 'Mã linh kiện + hãng có thể đã tồn tại: '))
    } finally { setBusy(false) }
  }

  return <>
    <WorkOrderAssignmentPanel workOrderId={workOrderId} />
    <WorkOrderExecutionPanel workOrderId={workOrderId} />
    <section className="maintenance-spare-flow" aria-labelledby={`maintenance-spare-${workOrderId}`}>
      <header><div><span>Linh kiện đã thay</span><h3 id={`maintenance-spare-${workOrderId}`}>Ghi ngay trong sửa chữa</h3><p>Chọn phụ tùng đã có; nếu chưa có thì tạo mới tại đây. Một lần lưu tự ghi lịch sử sử dụng, liên kết máy và trừ tồn.</p></div><strong>{usage.length}</strong></header>

      {usage.length ? <div className="maintenance-spare-history">{usage.map((item) => {
        const part = parts.find((entry) => entry.partId === item.partId)
        return <div key={item.usageId}><span><b>{item.partId}</b> · {part?.partName || 'Linh kiện'} × {item.quantity}</span><small>{dateTime(item.usedAt)}{item.reason ? ` · ${item.reason}` : ''}</small></div>
      })}</div> : <p className="maintenance-spare-empty">Lệnh công việc này chưa ghi linh kiện thay thế.</p>}

      <form onSubmit={submit}>
        <div className="maintenance-spare-mode" role="group" aria-label="Cách chọn linh kiện">
          <button type="button" className={mode === 'EXISTING' ? 'active' : ''} onClick={() => setMode('EXISTING')}>Chọn linh kiện có sẵn</button>
          <button type="button" className={mode === 'NEW' ? 'active' : ''} onClick={() => setMode('NEW')}>+ Chưa có · thêm mới</button>
        </div>

        {mode === 'EXISTING' ? <div className="maintenance-spare-fields">
          <label className="wide"><span>Linh kiện</span><select value={partId} onChange={(event) => setPartId(event.target.value)}>{!parts.length ? <option value="">Chưa có linh kiện trong danh mục</option> : null}{parts.map((part) => <option key={part.partId} value={part.partId}>{part.partId} · {part.partName}{part.partNumber ? ` · ${part.partNumber}` : ''} · Tồn {part.stockQty}</option>)}</select></label>
          {selectedPart ? <div className="maintenance-spare-hint wide"><span>{selectedAlreadyMapped ? `✓ Đã liên kết ${equipmentId}` : `Tự liên kết với ${equipmentId} khi lưu`}</span><span>Tồn {selectedPart.stockQty} / Tối thiểu {selectedPart.minQty}</span></div> : null}
        </div> : <>
          <div className="maintenance-spare-fields">
            <label className="wide"><span>Tên linh kiện *</span><input value={newPart.partName} onChange={(event) => setNewPart({ ...newPart, partName: event.target.value })} autoFocus /></label>
            <label><span>Mã linh kiện</span><input value={newPart.partNumber} onChange={(event) => setNewPart({ ...newPart, partNumber: event.target.value })} /></label>
            <label><span>Hãng / nhà sản xuất</span><input value={newPart.maker} onChange={(event) => setNewPart({ ...newPart, maker: event.target.value })} /></label>
            <label><span>Tồn trước khi dùng</span><input type="number" min="0" value={newPart.stockQty} onChange={(event) => setNewPart({ ...newPart, stockQty: event.target.value })} /></label>
            <label><span>Tồn tối thiểu</span><input type="number" min="0" value={newPart.minQty} onChange={(event) => setNewPart({ ...newPart, minQty: event.target.value })} /></label>
            <label><span>Vị trí lưu kho</span><input value={newPart.location} onChange={(event) => setNewPart({ ...newPart, location: event.target.value })} /></label>
            <label><span>Thời gian cung ứng (ngày)</span><input type="number" min="0" value={newPart.leadTimeDays} onChange={(event) => setNewPart({ ...newPart, leadTimeDays: event.target.value })} /></label>
          </div>
          <div className="maintenance-spare-risk">
            <label><input type="checkbox" checked={newPart.stopsProduction} onChange={(event) => setNewPart({ ...newPart, stopsProduction: event.target.checked })} /> Hỏng linh kiện làm máy/dây chuyền dừng</label>
            <label><input type="checkbox" checked={newPart.qualitySafetyImpact} onChange={(event) => setNewPart({ ...newPart, qualitySafetyImpact: event.target.checked })} /> Ảnh hưởng chất lượng/an toàn</label>
            <label><input type="checkbox" checked={newPart.leadTimeExceedsRecovery} onChange={(event) => setNewPart({ ...newPart, leadTimeExceedsRecovery: event.target.checked })} /> Thời gian cung ứng vượt thời gian phục hồi chấp nhận</label>
          </div>
          <label className="maintenance-spare-note"><span>Căn cứ / ghi chú</span><input value={newPart.rationaleNote} onChange={(event) => setNewPart({ ...newPart, rationaleNote: event.target.value })} placeholder="Ví dụ: máy dừng nếu hỏng, thời gian cung ứng 30 ngày" /></label>
          <p className="maintenance-spare-auto-id">Mã <b>SP-xxxxx</b> tự sinh và tự gắn với <b>{equipmentId}</b>.</p>
        </>}

        <div className="maintenance-spare-fields usage"><label><span>Số lượng đã dùng</span><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className="wide"><span>Ghi chú thay</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Có thể để trống" /></label></div>
        {message ? <div className="maintenance-spare-message success">{message}</div> : null}{error ? <div className="maintenance-spare-message error">{error}</div> : null}
        <button className="maintenance-spare-submit" disabled={busy || (mode === 'EXISTING' && !partId)}>{busy ? 'Đang lưu…' : mode === 'NEW' ? 'Tạo phụ tùng + ghi đã thay' : 'Ghi đã thay & tự trừ tồn'}</button>
      </form>
    </section>
  </>
}
