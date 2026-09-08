import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './Maintenance.css'
import './Downtime.css'
import { canCreateMaintenance, useAppRole } from './auth/AppRoleContext'
import { loadLiveMaintenance, type MaintenanceEquipmentOption } from './data/liveMaintenance'
import { loadDowntimeMonthlyReport, upsertDowntimeEvent, type DowntimeCauseCategory, type DowntimeInput, type DowntimeMonthlyReport } from './data/liveDowntime'

const CAUSES: Array<{ value: DowntimeCauseCategory; label: string }> = [
  { value: 'MECHANICAL', label: 'Hỏng cơ khí' }, { value: 'ELECTRICAL', label: 'Hỏng điện' }, { value: 'WAITING_MATERIAL', label: 'Chờ vật tư' },
  { value: 'UNPLANNED_MAINTENANCE', label: 'Bảo dưỡng đột xuất' }, { value: 'SETUP_CHANGEOVER', label: 'Chuẩn bị / thay khuôn' }, { value: 'NO_OPERATOR', label: 'Không có nhân viên vận hành' },
  { value: 'MATERIAL_SHORTAGE', label: 'Thiếu nguyên liệu' }, { value: 'PROCESS_ERROR', label: 'Lỗi quy trình' }, { value: 'OTHER', label: 'Khác' },
]
const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}

function currentMonth() { return new Date().toISOString().slice(0, 7) }
function localNow() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
function formatMinutes(value: number) { return Math.round(value).toLocaleString('vi-VN') }
function emptyInput(equipmentId = ''): DowntimeInput { return { equipmentId, startedAt: localNow(), endedAt: '', causeCategory: 'MECHANICAL', detail: '', actionTaken: '', affectedDepartment: '', recordedBy: '', handledBy: '', reportedBy: '' } }

export function LiveDowntimePanel() {
  const role = useAppRole(); const canWrite = canCreateMaintenance(role)
  const [month, setMonth] = useState(currentMonth()); const [report, setReport] = useState<DowntimeMonthlyReport | null>(null); const [equipment, setEquipment] = useState<MaintenanceEquipmentOption[]>([]); const [draft, setDraft] = useState<DowntimeInput | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('')

  const refresh = async (targetMonth = month) => { const [nextReport, maintenance] = await Promise.all([loadDowntimeMonthlyReport(targetMonth), loadLiveMaintenance()]); setReport(nextReport); setEquipment(maintenance.equipment); setError('') }
  useEffect(() => {
    let active = true
    void Promise.all([loadDowntimeMonthlyReport(month), loadLiveMaintenance()])
      .then(([nextReport, maintenance]) => {
        if (!active) return
        setReport(nextReport)
        setEquipment(maintenance.equipment)
        setError('')
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải BM06') })
    return () => { active = false }
  }, [month])
  const causeLabel = useMemo(() => new Map(CAUSES.map((item) => [item.value, item.label])), [])
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!draft || !canWrite) return; setBusy(true); setError(''); setMessage(''); try { const result = await upsertDowntimeEvent(draft); setMessage(`Đã lưu sự kiện dừng máy ${result.downtimeId}`); setDraft(null); await refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu BM06') } finally { setBusy(false) } }

  return <section className="maintenance-surface downtime-panel" aria-labelledby="bm06-title">
    <header className="maintenance-header"><div><p className="eyebrow">BM-TBSX-06 · Chỉ số SOP3</p><h3 id="bm06-title">Chỉ số dừng máy · MTBF / MTTR</h3><p>Đơn vị phút · tỷ lệ dừng máy mục tiêu ≤8%.</p></div><div className="downtime-actions"><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />{canWrite ? <button className="maintenance-primary" type="button" onClick={() => setDraft(emptyInput(equipment[0]?.equipmentId || ''))}>+ Ghi dừng máy</button> : <span className="maintenance-readonly">Chỉ xem · {roleLabel[role]||role}</span>}</div></header>
    {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}{error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}
    {report ? <><div className="downtime-kpis">
      <article><span>Tổng thời gian dừng</span><strong>{formatMinutes(report.downtimeMinutes)}</strong><small>phút</small></article>
      <article><span>Số lần hỏng</span><strong>{report.failureCount}</strong><small>sự kiện</small></article>
      <article className={report.downtimeRate <= 8 ? 'good' : 'bad'}><span>Tỷ lệ dừng máy</span><strong>{report.downtimeRate.toFixed(2)}%</strong><small>Mục tiêu ≤8%</small></article>
      <article><span>MTBF</span><strong>{formatMinutes(report.mtbfMinutes)}</strong><small>phút / lần hỏng</small></article>
      <article><span>MTTR</span><strong>{formatMinutes(report.mttrMinutes)}</strong><small>phút / lần hỏng</small></article>
    </div><p className="downtime-formula">Nền tính tháng: {report.trackedDays} ngày × 24 × 60 phút cho mỗi thiết bị sản xuất. MTBF = (thời gian nền − thời gian dừng) ÷ số lần hỏng; MTTR = thời gian dừng ÷ số lần hỏng.</p>
      <div className="downtime-grid"><div><h4>Thiết bị dừng máy</h4>{report.byEquipment.length ? <div className="maintenance-table-scroll"><table className="maintenance-table downtime-table"><thead><tr><th>Thiết bị</th><th>Ngày dừng</th><th>Thời gian dừng</th><th>Lần hỏng</th><th>Tỷ lệ</th><th>MTBF</th><th>MTTR</th></tr></thead><tbody>{report.byEquipment.map((row) => <tr key={row.equipmentId}><td><b>{row.equipmentId}</b><small>{row.equipmentName} · {row.area || '—'}</small></td><td>{row.days.join(', ')}</td><td>{formatMinutes(row.downtimeMinutes)}</td><td>{row.failureCount}</td><td>{row.downtimeRate.toFixed(2)}%</td><td>{formatMinutes(row.mtbfMinutes)}</td><td>{formatMinutes(row.mttrMinutes)}</td></tr>)}</tbody></table></div> : <div className="maintenance-state">Tháng này chưa có sự kiện dừng máy.</div>}</div>
      <div><h4>Nguyên nhân dừng máy</h4>{report.byCause.length ? <ol className="downtime-causes">{report.byCause.map((row) => <li key={row.cause}><div><b>{causeLabel.get(row.cause as DowntimeCauseCategory) || row.cause}</b><span>{row.count} lần</span></div><strong>{formatMinutes(row.minutes)} phút</strong></li>)}</ol> : <div className="maintenance-state">Chưa có nguyên nhân.</div>}</div></div>
    </> : <div className="maintenance-state">Đang tính BM06…</div>}

    {draft && canWrite ? <div className="maintenance-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}><aside className="maintenance-drawer" role="dialog" aria-modal="true" aria-labelledby="bm06-form-title"><header><div><p className="eyebrow">CEV-BM-TBSX-06</p><h2 id="bm06-form-title">Ghi nhận dừng máy</h2></div><button type="button" onClick={() => setDraft(null)}>×</button></header><form className="maintenance-create-form" onSubmit={submit}>
      <label className="wide"><span>Thiết bị</span><select required value={draft.equipmentId} onChange={(event) => setDraft({ ...draft, equipmentId: event.target.value })}>{equipment.map((row) => <option key={row.equipmentId} value={row.equipmentId}>{row.equipmentId} · {row.equipmentName}</option>)}</select></label>
      <label><span>Thời điểm dừng</span><input type="datetime-local" required value={draft.startedAt} onChange={(event) => setDraft({ ...draft, startedAt: event.target.value })} /></label>
      <label><span>Thời điểm chạy lại</span><input type="datetime-local" value={draft.endedAt} onChange={(event) => setDraft({ ...draft, endedAt: event.target.value })} /></label>
      <label className="wide"><span>Nguyên nhân chuẩn hóa</span><select value={draft.causeCategory} onChange={(event) => setDraft({ ...draft, causeCategory: event.target.value as DowntimeCauseCategory })}>{CAUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="wide"><span>Mô tả chi tiết sự cố</span><textarea required rows={3} value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} /></label>
      <label className="wide"><span>Hành động để máy chạy lại</span><textarea rows={3} value={draft.actionTaken} onChange={(event) => setDraft({ ...draft, actionTaken: event.target.value })} /></label>
      <label><span>Bộ phận bị ảnh hưởng</span><input value={draft.affectedDepartment} onChange={(event) => setDraft({ ...draft, affectedDepartment: event.target.value })} /></label>
      <label><span>Người ghi nhận</span><input value={draft.recordedBy} onChange={(event) => setDraft({ ...draft, recordedBy: event.target.value })} /></label>
      <label><span>Người xử lý</span><input value={draft.handledBy} onChange={(event) => setDraft({ ...draft, handledBy: event.target.value })} /></label>
      <label><span>Người báo cáo</span><input value={draft.reportedBy} onChange={(event) => setDraft({ ...draft, reportedBy: event.target.value })} /></label>
      <footer><button type="button" onClick={() => setDraft(null)}>Hủy</button><button className="maintenance-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu BM06'}</button></footer>
    </form></aside></div> : null}
  </section>
}
