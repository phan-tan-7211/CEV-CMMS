import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './Calibration.css'
import { canRecordCalibration, useAppRole } from './auth/AppRoleContext'
import { getCalibrationCacheSnapshot, loadCalibrationLogs, loadLiveCalibration, recordCalibration, type CalibrationLinkState, type LiveCalibration, type LiveCalibrationLog } from './data/liveCalibration'
import { getCalibrationDueStatus } from './domain/calibration'

const linkLabel: Record<CalibrationLinkState, string> = { LINKED: 'Đã liên kết', UNLINKED: 'Chưa liên kết', ORPHAN: 'Mã gốc không tồn tại', INVALID_TYPE: 'Sai loại thiết bị' }
type DueFilter = 'ALL' | 'OVERDUE' | 'DUE_SOON' | 'VALID' | 'NO_PLAN'
function dueLabel(value: string) { return ({ OVERDUE: 'Quá hạn', DUE_SOON: 'Sắp đến hạn', VALID: 'Còn hạn', NO_PLAN: 'Chưa có hạn' } as Record<string,string>)[value] || value }
function resultLabel(value:string){return ({PASS:'Đạt',LIMITED_USE:'Sử dụng hạn chế',FAIL:'Không đạt'} as Record<string,string>)[value]||value}
const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}

export function LiveCalibrationPanel() {
  const role = useAppRole()
  const canRecord = canRecordCalibration(role)
  const [initialRows] = useState(getCalibrationCacheSnapshot)
  const [rows, setRows] = useState<LiveCalibration[]>(initialRows)
  const [logs, setLogs] = useState<LiveCalibrationLog[]>([])
  const [logsFor, setLogsFor] = useState('')
  const [loading, setLoading] = useState(initialRows.length === 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [linkFilter, setLinkFilter] = useState<'ALL' | CalibrationLinkState>('ALL')
  const [dueFilter, setDueFilter] = useState<DueFilter>('ALL')
  const [selectedId, setSelectedId] = useState('')
  const [recordMode, setRecordMode] = useState(false)
  const [calibrationDate, setCalibrationDate] = useState(new Date().toISOString().slice(0,10))
  const [nextDueDate, setNextDueDate] = useState('')
  const [result, setResult] = useState<'PASS'|'FAIL'|'LIMITED_USE'>('PASS')
  const [provider, setProvider] = useState('')
  const [note, setNote] = useState('')
  const [certificate, setCertificate] = useState<File | undefined>()
  const today = new Date().toISOString().slice(0, 10)

  const reload = async (force=false) => { if(force && rows.length===0)setLoading(true); try{setRows(await loadLiveCalibration({force}));setError('')} finally{setLoading(false)} }
  useEffect(() => {
    let active=true
    loadLiveCalibration({force:true}).then((r)=>{if(active){setRows(r);setError('')}}).catch((c:unknown)=>{if(active&&initialRows.length===0)setError(c instanceof Error?c.message:'Không thể tải danh mục hiệu chuẩn')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  }, [initialRows.length])
  useEffect(() => {
    if (!selectedId) return
    const selected = rows.find((row)=>row.calibrationEquipmentId===selectedId)
    if (!selected?.equipmentId) return
    let active = true
    const equipmentId = selected.equipmentId
    void loadCalibrationLogs(equipmentId)
      .then((nextLogs) => { if (active) { setLogs(nextLogs); setLogsFor(equipmentId) } })
      .catch(() => { if (active) { setLogs([]); setLogsFor(equipmentId) } })
    return () => { active = false }
  }, [selectedId, rows])
  useEffect(() => { if(!selectedId)return; const h=(e:KeyboardEvent)=>{if(e.key==='Escape'){setRecordMode(false);setSelectedId('')}}; window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h) }, [selectedId])

  const linked=rows.filter((r)=>r.linkState==='LINKED').length, reconciliation=rows.length-linked
  const overdue=rows.filter((r)=>getCalibrationDueStatus(r.nextDueDate,today)==='OVERDUE').length
  const dueSoon=rows.filter((r)=>getCalibrationDueStatus(r.nextDueDate,today)==='DUE_SOON').length
  const normalizedQuery=query.trim().toLocaleLowerCase()
  const filteredRows=useMemo(()=>rows.filter((row)=>{ if(linkFilter!=='ALL'&&row.linkState!==linkFilter)return false; const due=getCalibrationDueStatus(row.nextDueDate,today); if(dueFilter!=='ALL'&&due!==dueFilter)return false; if(!normalizedQuery)return true; return [row.controlNumber,row.equipmentId,row.calibrationEquipmentId,row.instrumentName,row.localName,row.model,row.serialNumber,row.manufacturer,row.department].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery)}),[rows,linkFilter,dueFilter,normalizedQuery,today])
  const selected=selectedId?rows.find((r)=>r.calibrationEquipmentId===selectedId)||null:null
  const selectedDue=selected?getCalibrationDueStatus(selected.nextDueDate,today):'NO_PLAN'
  const visibleLogs = selected?.equipmentId && logsFor === selected.equipmentId ? logs : []

  const submitRecord=async(e:FormEvent)=>{
    e.preventDefault(); if(!selected?.equipmentId)return
    if(!canRecord){setError(`Vai trò ${roleLabel[role]||role} không có quyền ghi lịch sử hiệu chuẩn.`);return}
    setSaving(true); setError(''); setMessage('')
    try {
      await recordCalibration({equipmentId:selected.equipmentId,calibrationDate,nextDueDate,result,provider,note,certificate})
      setRows(getCalibrationCacheSnapshot())
      setMessage(`Đã ghi hiệu chuẩn ${selected.equipmentId}`)
      setRecordMode(false); setProvider('');setNote('');setCertificate(undefined)
      const nextLogs = await loadCalibrationLogs(selected.equipmentId,{force:true})
      setLogs(nextLogs)
      setLogsFor(selected.equipmentId)
      void loadLiveCalibration({force:true}).then(setRows).catch(()=>undefined)
    }
    catch(c:unknown){setError(c instanceof Error?c.message:'Không thể ghi hiệu chuẩn')} finally{setSaving(false)}
  }

  return <div className="calibration-page">
    <section className="calibration-summary" aria-label="Tổng quan hiệu chuẩn"><article><span>Tổng thiết bị đo</span><strong>{rows.length}</strong><small>Danh mục hiệu chuẩn</small></article><article><span>Quá hạn</span><strong>{overdue}</strong><small>Cần xử lý ngay</small></article><article><span>Sắp đến hạn</span><strong>{dueSoon}</strong><small>Cần lên kế hoạch</small></article><article><span>Cần đối chiếu dữ liệu</span><strong>{reconciliation}</strong><small>{linked} đã liên kết với mã thiết bị chuẩn</small></article></section>
    <section className="calibration-surface" aria-labelledby="calibration-title">
      <header className="calibration-header"><div><p className="eyebrow">CEV-BM-STCL-03</p><h2 id="calibration-title">Kiểm soát hiệu chuẩn</h2><p>{filteredRows.length} / {rows.length} thiết bị · dữ liệu trực tiếp</p></div><button type="button" onClick={()=>void reload(true)}>Làm mới</button></header>
      <div className="calibration-toolbar" role="search"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Tìm số kiểm soát, mã máy, mẫu máy, số sê-ri, tên thiết bị…"/><select value={dueFilter} onChange={(e)=>setDueFilter(e.target.value as DueFilter)}><option value="ALL">Tất cả hạn</option><option value="OVERDUE">Quá hạn</option><option value="DUE_SOON">Sắp đến hạn</option><option value="VALID">Còn hạn</option><option value="NO_PLAN">Chưa có hạn</option></select><select value={linkFilter} onChange={(e)=>setLinkFilter(e.target.value as typeof linkFilter)}><option value="ALL">Tất cả liên kết</option><option value="LINKED">Đã liên kết</option><option value="UNLINKED">Chưa liên kết</option><option value="ORPHAN">Mã gốc không tồn tại</option><option value="INVALID_TYPE">Sai loại</option></select></div>
      {message?<div className="calibration-state success">{message}</div>:null}{loading&&rows.length===0?<div className="calibration-state">Đang tải danh mục hiệu chuẩn…</div>:null}{error&&rows.length===0?<div className="calibration-state error">{error}</div>:null}
      {rows.length>0?<div className="calibration-table-scroll"><table className="calibration-table"><thead><tr><th>Số kiểm soát</th><th>Thiết bị</th><th>Bộ phận</th><th>Mẫu máy / Số sê-ri</th><th>Lần gần nhất</th><th>Hạn tiếp theo</th><th>Tình trạng</th><th>Liên kết</th><th /></tr></thead><tbody>{filteredRows.map((item)=>{const due=getCalibrationDueStatus(item.nextDueDate,today);return <tr key={item.calibrationEquipmentId}><td><button className="calibration-link" onClick={()=>setSelectedId(item.calibrationEquipmentId)}>{item.controlNumber||item.equipmentId||'Chưa cấp'}</button><small>{item.equipmentId||item.calibrationEquipmentId}</small></td><td><b>{item.instrumentName||item.localName||'—'}</b><small>{item.category||item.localName||'—'}</small></td><td>{item.department||'—'}</td><td>{item.model||'—'}<small>{item.serialNumber||'—'}</small></td><td>{item.lastCalibrationDate||'—'}</td><td>{item.nextDueDate||'—'}</td><td><span className={`calibration-due due-${due.toLowerCase()}`}>{dueLabel(due)}</span></td><td><span className={`calibration-link-state link-${item.linkState.toLowerCase()}`}>{linkLabel[item.linkState]}</span></td><td><button className="calibration-row-action" onClick={()=>setSelectedId(item.calibrationEquipmentId)}>Xem</button></td></tr>})}</tbody></table></div>:null}
    </section>

    {selected?<div className="calibration-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget){setRecordMode(false);setSelectedId('')}}}><aside className="calibration-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">Hồ sơ hiệu chuẩn</p><h2>{selected.controlNumber||selected.equipmentId||selected.calibrationEquipmentId}</h2><p>{selected.instrumentName||selected.localName||'Thiết bị đo'}</p></div><button onClick={()=>{setRecordMode(false);setSelectedId('')}}>×</button></header>
      <div className="calibration-alert-row"><span className={`calibration-due due-${selectedDue.toLowerCase()}`}>{dueLabel(selectedDue)}</span><span className={`calibration-link-state link-${selected.linkState.toLowerCase()}`}>{linkLabel[selected.linkState]}</span>{selected.linkState==='LINKED'&&canRecord?<button className="calibration-record-button" onClick={()=>setRecordMode((v)=>!v)}>{recordMode?'Đóng biểu mẫu':'+ Ghi hiệu chuẩn'}</button>:selected.linkState==='LINKED'?<span className="calibration-readonly">Chỉ xem · {roleLabel[role]||role}</span>:null}</div>
      {recordMode&&canRecord?<form className="calibration-record-form" onSubmit={submitRecord}><label><span>Ngày hiệu chuẩn</span><input type="date" value={calibrationDate} onChange={(e)=>setCalibrationDate(e.target.value)} required/></label><label><span>Hạn tiếp theo</span><input type="date" value={nextDueDate} onChange={(e)=>setNextDueDate(e.target.value)} required/></label><label><span>Kết quả</span><select value={result} onChange={(e)=>setResult(e.target.value as typeof result)}><option value="PASS">Đạt</option><option value="LIMITED_USE">Sử dụng hạn chế</option><option value="FAIL">Không đạt</option></select></label><label><span>Đơn vị hiệu chuẩn</span><input value={provider} onChange={(e)=>setProvider(e.target.value)}/></label><label><span>Chứng chỉ</span><input type="file" accept="application/pdf,image/*" onChange={(e)=>setCertificate(e.target.files?.[0])}/></label><label><span>Ghi chú</span><textarea value={note} onChange={(e)=>setNote(e.target.value)}/></label><button className="calibration-record-button primary" disabled={saving}>{saving?'Đang lưu…':'Lưu lịch sử hiệu chuẩn'}</button></form>:null}
      <div className="calibration-detail-grid"><div><span>Mã thiết bị</span><strong>{selected.equipmentId||'—'}</strong></div><div><span>Mã hiệu chuẩn</span><strong>{selected.calibrationEquipmentId}</strong></div><div><span>Mẫu máy</span><strong>{selected.model||'—'}</strong></div><div><span>Số sê-ri</span><strong>{selected.serialNumber||'—'}</strong></div><div><span>Hiệu chuẩn gần nhất</span><strong>{selected.lastCalibrationDate||'—'}</strong></div><div><span>Hạn tiếp theo</span><strong>{selected.nextDueDate||'—'}</strong></div></div>
      <section className="calibration-detail-section"><span>Lịch sử hiệu chuẩn</span>{visibleLogs.length?<div className="calibration-log-list">{visibleLogs.map((log)=><article key={log.calibrationLogId}><div><b>{log.calibrationDate}</b><span>{resultLabel(log.result)}</span></div><small>Hạn tiếp theo: {log.nextDueDate} · {log.provider||'—'} · {log.actorEmail||'—'}</small>{log.note?<p>{log.note}</p>:null}{log.certificateUrl?<a href={log.certificateUrl} target="_blank" rel="noreferrer">Mở chứng chỉ</a>:null}</article>)}</div>:<p>Chưa có lịch sử hiệu chuẩn.</p>}</section>
      </aside></div>:null}
  </div>
}
