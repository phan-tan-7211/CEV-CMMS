import { useEffect, useMemo, useState } from 'react'
import './EquipmentProfile.css'
import { EquipmentProfileOps } from './EquipmentProfileOps'
import { EquipmentQr } from './components/EquipmentQr'
import type { LiveEquipment } from './data/liveEquipment'
import { loadEquipmentHistory, type EquipmentHistory } from './data/supabaseEquipment'

type EquipmentProfileTarget = 'qr' | 'maintenance' | 'inspection' | 'spare'

type Props = {
  equipment: LiveEquipment
  photoUrl: string
  onClose: () => void
  onEdit: () => void
  onNavigate?: (view: EquipmentProfileTarget, equipmentId: string) => void
}

type Tab = 'overview' | 'calibration' | 'maintenance' | 'inspection' | 'downtime' | 'movement' | 'audit'
type HistoryState = { equipmentId: string; history: EquipmentHistory; error: string }

const EMPTY_HISTORY: EquipmentHistory = { calibration: [], maintenance: [], inspections: [], downtime: [], movements: [], audit: [] }

function text(value: unknown) { if (value === null || value === undefined || value === '') return '—'; return String(value) }
function dateText(value: unknown) { if (!value) return '—'; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('vi-VN') }
function dateTimeText(value: unknown) { if (!value) return '—'; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN') }
const statusText: Record<string,string> = { RUNNING:'Hoạt động', DOWN:'Sự cố', MAINTENANCE:'Bảo trì', STOPPED:'Dừng', DISPOSED:'Thanh lý', UNKNOWN:'Chưa rõ' }

export function EquipmentProfile({ equipment, photoUrl, onClose, onEdit, onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [historyState, setHistoryState] = useState<HistoryState>({ equipmentId: '', history: EMPTY_HISTORY, error: '' })
  const [issueOpen, setIssueOpen] = useState(false)
  const historyReady = historyState.equipmentId === equipment.equipmentId
  const history = historyReady ? historyState.history : EMPTY_HISTORY
  const loading = !historyReady
  const error = historyReady ? historyState.error : ''

  async function refreshHistory() {
    const equipmentId = equipment.equipmentId
    try {
      const nextHistory = await loadEquipmentHistory(equipmentId)
      setHistoryState({ equipmentId, history: nextHistory, error: '' })
    } catch (cause) {
      setHistoryState({ equipmentId, history: EMPTY_HISTORY, error: cause instanceof Error ? cause.message : 'Không tải được lịch sử thiết bị' })
    }
  }

  useEffect(() => {
    let active = true
    const equipmentId = equipment.equipmentId
    void loadEquipmentHistory(equipmentId)
      .then((result) => { if (active) setHistoryState({ equipmentId, history: result, error: '' }) })
      .catch((cause) => { if (active) setHistoryState({ equipmentId, history: EMPTY_HISTORY, error: cause instanceof Error ? cause.message : 'Không tải được lịch sử thiết bị' }) })
    return () => { active = false }
  }, [equipment.equipmentId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const counts = useMemo(() => ({ calibration: history.calibration.length, maintenance: history.maintenance.length, inspection: history.inspections.length, downtime: history.downtime.length, movement: history.movements.length, audit: history.audit.length }), [history])

  function navigate(view: EquipmentProfileTarget) {
    if (onNavigate) { onNavigate(view, equipment.equipmentId); return }
    window.dispatchEvent(new CustomEvent('cev:navigate', { detail: { view, equipmentId: equipment.equipmentId } }))
  }

  return <div className="equipment-profile-layer" role="dialog" aria-modal="true" aria-labelledby="equipment-profile-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <article className="equipment-profile">
      <header className="equipment-profile-header">
        <div><button className="equipment-profile-back" type="button" onClick={onClose}>← Danh sách thiết bị</button><p className="eyebrow">Hồ sơ thiết bị</p><h2 id="equipment-profile-title"><span>{equipment.equipmentId}</span><span className="equipment-profile-title-name">{equipment.equipmentName}</span></h2></div>
        <div className="equipment-profile-header-actions"><button type="button" onClick={onEdit}>Sửa thiết bị</button><button className="equipment-profile-close" type="button" onClick={onClose} aria-label="Đóng hồ sơ">×</button></div>
      </header>

      <section className="equipment-profile-hero">
        <div className="equipment-profile-image-wrap">{photoUrl ? <img src={photoUrl} alt={`Ảnh lớn ${equipment.equipmentName}`} /> : <div className="equipment-profile-no-image">Chưa có ảnh thiết bị</div>}</div>
        <div className="equipment-profile-identity">
          <div className="equipment-profile-badges"><span className={`equipment-profile-status status-${equipment.status.toLowerCase()}`}>{statusText[equipment.status] || equipment.status}</span><span className={`equipment-profile-criticality level-${(equipment.criticality || 'unknown').toLowerCase()}`}>Cấp {text(equipment.criticality)}</span></div>
          <dl>
            <div><dt>Số sê-ri</dt><dd>{text(equipment.serialNumber)}</dd></div><div><dt>Mẫu máy</dt><dd>{text(equipment.model)}</dd></div><div><dt>Hãng</dt><dd>{text(equipment.manufacturer)}</dd></div><div><dt>Bộ phận</dt><dd>{text(equipment.usingDepartment || equipment.managingDepartment || equipment.currentArea)}</dd></div><div><dt>Loại</dt><dd>{equipment.equipmentType === 'MEASUREMENT' ? 'Thiết bị đo kiểm' : 'Thiết bị sản xuất'}</dd></div>{equipment.currentLine ? <div><dt>Dây chuyền</dt><dd>{equipment.currentLine}</dd></div> : null}{equipment.currentArea && equipment.currentArea !== equipment.usingDepartment ? <div><dt>Khu vực</dt><dd>{equipment.currentArea}</dd></div> : null}
          </dl>
          <div className="equipment-profile-qr-preview"><span>Mã QR thiết bị</span><EquipmentQr value={equipment.qrCode || equipment.equipmentId} size={112} /></div>
        </div>
      </section>

      <section className="equipment-profile-mobile-actions" aria-label="Thao tác nhanh thiết bị">
        <button type="button" onClick={() => { setTab('overview'); setIssueOpen(true) }}><span aria-hidden="true">!</span><strong>Báo sự cố</strong><small>Tạo lệnh nhanh</small></button>
        <button type="button" onClick={() => navigate('maintenance')}><span aria-hidden="true">⚒</span><strong>Bảo trì</strong><small>Lệnh & kế hoạch</small></button>
        <button type="button" onClick={() => navigate('inspection')}><span aria-hidden="true">✓</span><strong>Kiểm tra</strong><small>Kiểm tra ngày</small></button>
        <button type="button" onClick={() => navigate('spare')}><span aria-hidden="true">◇</span><strong>Phụ tùng</strong><small>Phụ tùng & tồn kho</small></button>
      </section>

      <nav className="equipment-profile-tabs" aria-label="Nội dung hồ sơ thiết bị">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Tổng quan</button><button className={tab === 'calibration' ? 'active' : ''} onClick={() => setTab('calibration')}>Hiệu chuẩn <span>{counts.calibration}</span></button><button className={tab === 'maintenance' ? 'active' : ''} onClick={() => setTab('maintenance')}>Bảo trì <span>{counts.maintenance}</span></button><button className={tab === 'inspection' ? 'active' : ''} onClick={() => setTab('inspection')}>Kiểm tra <span>{counts.inspection}</span></button><button className={tab === 'downtime' ? 'active' : ''} onClick={() => setTab('downtime')}>Dừng máy <span>{counts.downtime}</span></button><button className={tab === 'movement' ? 'active' : ''} onClick={() => setTab('movement')}>Di chuyển <span>{counts.movement}</span></button><button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Nhật ký <span>{counts.audit}</span></button>
      </nav>

      <section className="equipment-profile-content">
        {loading ? <div className="equipment-profile-state">Đang tải lịch sử…</div> : null}{error ? <div className="equipment-profile-state error">{error}</div> : null}
        {!loading && !error && tab === 'overview' ? <>
          <div className="equipment-profile-overview-grid"><article><span>Hiệu chuẩn</span><strong>{counts.calibration}</strong><small>bản ghi</small></article><article><span>Bảo trì</span><strong>{counts.maintenance}</strong><small>lệnh công việc</small></article><article><span>Kiểm tra</span><strong>{counts.inspection}</strong><small>bản ghi</small></article><article><span>Dừng máy</span><strong>{counts.downtime}</strong><small>sự kiện</small></article><article><span>Di chuyển</span><strong>{counts.movement}</strong><small>lần</small></article><article><span>Cập nhật gần nhất</span><strong className="small-value">{dateTimeText(equipment.updatedAt)}</strong></article></div>
          <EquipmentProfileOps equipment={equipment} history={history} issueOpen={issueOpen} onIssueOpenChange={setIssueOpen} onNavigate={navigate} onHistoryRefresh={() => void refreshHistory()} />
        </> : null}

        {!loading && !error && tab === 'calibration' ? <HistoryTable empty="Chưa có lịch sử hiệu chuẩn." rows={history.calibration} columns={[[ 'Ngày hiệu chuẩn', (row) => dateText(row.calibration_date) ],[ 'Hạn tiếp theo', (row) => dateText(row.next_due_date) ],[ 'Kết quả', (row) => text(row.result) ],[ 'Người thực hiện', (row) => text(row.actor_email) ]]} /> : null}
        {!loading && !error && tab === 'maintenance' ? <HistoryTable empty="Chưa có lệnh công việc bảo trì." rows={history.maintenance} columns={[[ 'Lệnh công việc', (row) => text(row.work_order_id) ],[ 'Trạng thái', (row) => text(row.status) ],[ 'Ưu tiên', (row) => text(row.priority) ],[ 'Lý do', (row) => text(row.reason) ],[ 'Ngày tạo', (row) => dateTimeText(row.created_at) ]]} /> : null}
        {!loading && !error && tab === 'inspection' ? <HistoryTable empty="Chưa có lịch sử kiểm tra." rows={history.inspections} columns={[[ 'Ngày', (row) => dateText(row.inspection_date) ],[ 'Ca', (row) => text(row.shift) ],[ 'Khu vực', (row) => text(row.area) ],[ 'Kết quả', (row) => text(row.overall_mark) ],[ 'Ghi chú', (row) => text(row.note) ]]} /> : null}
        {!loading && !error && tab === 'downtime' ? <HistoryTable empty="Chưa có sự kiện dừng máy." rows={history.downtime} columns={[[ 'Bắt đầu', (row) => dateTimeText(row.started_at) ],[ 'Kết thúc', (row) => dateTimeText(row.ended_at) ],[ 'Lệnh công việc', (row) => text(row.work_order_id) ]]} /> : null}
        {!loading && !error && tab === 'movement' ? <HistoryTable empty="Chưa có lịch sử di chuyển." rows={history.movements} columns={[[ 'Thời gian', (row) => dateTimeText(row.created_at) ],[ 'Từ', (row) => text(row.from_location) ],[ 'Đến', (row) => text(row.to_location) ],[ 'Người thực hiện', (row) => text(row.actor_email) ]]} /> : null}
        {!loading && !error && tab === 'audit' ? <HistoryTable empty="Chưa có nhật ký hệ thống." rows={history.audit} columns={[[ 'Thời gian', (row) => dateTimeText(row.created_at) ],[ 'Hành động', (row) => text(row.action) ],[ 'Đối tượng', (row) => `${text(row.entity_type)} / ${text(row.entity_id)}` ],[ 'Người thực hiện', (row) => text(row.actor_email) ]]} /> : null}
      </section>
    </article>
  </div>
}

function HistoryTable({ rows, columns, empty }: { rows: Array<Record<string, unknown>>; columns: Array<[string, (row: Record<string, unknown>) => string]>; empty: string }) {
  if (rows.length === 0) return <div className="equipment-profile-empty">{empty}</div>
  return <div className="equipment-profile-table-wrap"><table className="equipment-profile-table"><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || row.created_at || index)}>{columns.map(([label, render]) => <td key={label} data-label={label}>{render(row)}</td>)}</tr>)}</tbody></table></div>
}
