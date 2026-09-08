import { useEffect, useMemo, useState } from 'react'
import './Audit.css'
import { AuditExportControl } from './AuditExportControl'
import { loadLiveAudit, loadLiveSession, type LiveAudit, type LiveSession } from './data/liveAudit'

const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}

export function LiveAuditPanel() {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [rows, setRows] = useState<LiveAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState('')

  const reload = async () => {
    const current = await loadLiveSession()
    setSession(current)
    if (current.role === 'ADMIN') setRows(await loadLiveAudit())
    setError('')
  }

  useEffect(() => {
    let active = true
    loadLiveSession().then(async (current) => {
      if (!active) return
      setSession(current)
      if (current.role === 'ADMIN') {
        const audit = await loadLiveAudit()
        if (active) setRows(audit)
      }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải phiên làm việc / nhật ký') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedId('') }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  const entities = useMemo(() => Array.from(new Set(rows.map((row) => row.entityType).filter(Boolean))).toSorted(), [rows])
  const actions = useMemo(() => Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).toSorted(), [rows])
  const normalized = query.trim().toLocaleLowerCase()
  const filtered = useMemo(() => rows.filter((row) => {
    if (entityFilter !== 'ALL' && row.entityType !== entityFilter) return false
    if (actionFilter !== 'ALL' && row.action !== actionFilter) return false
    if (!normalized) return true
    return [row.auditId,row.timestamp,row.userId,row.action,row.entityType,row.entityId,row.oldValueJson,row.newValueJson].join(' ').toLocaleLowerCase().includes(normalized)
  }), [rows, entityFilter, actionFilter, normalized])
  const selected = selectedId ? rows.find((row) => row.auditId === selectedId) || null : null

  return <div className="audit-page">
    <section className="audit-summary">
      <article><span>Người dùng</span><strong>{session?.email || '—'}</strong><small>Xác thực Supabase</small></article>
      <article><span>Vai trò</span><strong>{session?.role ? roleLabel[session.role] || session.role : '—'}</strong><small>Phân quyền hệ thống</small></article>
      <article><span>Bản ghi nhật ký</span><strong>{session?.role === 'ADMIN' ? rows.length : 0}</strong><small>200 bản ghi gần nhất</small></article>
      <article><span>Phiên bản cấu trúc</span><strong>{session?.contractVersion || '—'}</strong><small>G1</small></article>
    </section>

    <section className="audit-surface">
      <header className="audit-header"><div><p className="eyebrow">Bảo mật / truy vết</p><h2>Nhật ký hệ thống & cấu hình</h2><p>Xác thực Supabase + phân quyền dữ liệu · chỉ Quản trị hệ thống được xem nhật ký</p></div><div className="audit-header-actions"><button type="button" onClick={() => void reload()}>Làm mới</button>{session?.role === 'ADMIN' ? <AuditExportControl /> : null}</div></header>
      {loading ? <div className="audit-state">Đang xác thực phiên làm việc…</div> : null}
      {error ? <div className="audit-state error">{error}</div> : null}
      {!loading && session?.role !== 'ADMIN' ? <div className="audit-denied"><b>Nhật ký hệ thống bị giới hạn</b><p>Vai trò hiện tại là {session?.role ? roleLabel[session.role] || session.role : 'Chưa xác định'}. Chỉ Quản trị hệ thống được đọc nhật ký.</p></div> : null}

      {!loading && !error && session?.role === 'ADMIN' ? <>
        <div className="audit-toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm người dùng, hành động, đối tượng, mã, trước/sau…"/><select value={entityFilter} onChange={(e)=>setEntityFilter(e.target.value)}><option value="ALL">Tất cả đối tượng</option>{entities.map((item)=><option key={item}>{item}</option>)}</select><select value={actionFilter} onChange={(e)=>setActionFilter(e.target.value)}><option value="ALL">Tất cả hành động</option>{actions.map((item)=><option key={item}>{item}</option>)}</select></div>
        <div className="audit-table-scroll"><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Mã</th><th /></tr></thead><tbody>{filtered.map((item)=><tr key={item.auditId}><td>{item.timestamp}</td><td>{item.userId||'—'}</td><td><span className="audit-action">{item.action}</span></td><td>{item.entityType}</td><td><b>{item.entityId}</b></td><td><button onClick={()=>setSelectedId(item.auditId)}>Xem</button></td></tr>)}</tbody></table>{!filtered.length?<div className="audit-state">Không có nhật ký phù hợp.</div>:null}</div>
      </> : null}
    </section>

    {selected ? <div className="audit-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelectedId('')}}><aside className="audit-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">Bản ghi nhật ký</p><h2>{selected.action}</h2><p>{selected.entityType} · {selected.entityId}</p></div><button onClick={()=>setSelectedId('')}>×</button></header><div className="audit-detail-grid"><div><span>Mã nhật ký</span><strong>{selected.auditId}</strong></div><div><span>Thời gian</span><strong>{selected.timestamp}</strong></div><div><span>Người dùng</span><strong>{selected.userId||'—'}</strong></div><div><span>Đối tượng</span><strong>{selected.entityType}</strong></div></div><section><span>Trước thay đổi</span><pre>{selected.oldValueJson || '—'}</pre></section><section><span>Sau thay đổi / chi tiết</span><pre>{selected.newValueJson || '—'}</pre></section></aside></div> : null}
  </div>
}
