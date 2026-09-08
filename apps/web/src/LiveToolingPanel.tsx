import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './Tooling.css'
import { canCreateToolingMaster, canCreateToolingModification, canCreateToolingPlan, canTransitionTooling, useAppRole } from './auth/AppRoleContext'
import { createTooling, createToolingModification, createToolingPlan, loadLiveTooling, transitionToolingModification, type LiveTooling, type LiveToolingModification, type LiveToolingPlan } from './data/liveTooling'

type Tab = 'MASTER' | 'PLAN' | 'MOD'
type Drawer = '' | 'TOOLING' | 'PLAN' | 'MOD'

const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}
const toolingTypeLabel:Record<string,string>={JIG:'Jig / gá',FIXTURE:'Đồ gá',MOLD:'Khuôn',DIE:'Khuôn dập',CUTTING_TOOL:'Dụng cụ cắt',PERISHABLE_TOOL:'Dụng cụ nhanh hỏng',OTHER:'Khác'}
const ownershipLabel:Record<string,string>={COMPANY:'Công ty',CUSTOMER:'Khách hàng'}
const statusLabel:Record<string,string>={IN_PRODUCTION:'Đang sử dụng',COMPLETED:'Đã hoàn tất',OPEN:'Mở',APPROVED:'Đã phê duyệt',QA_CONFIRMED:'Đã xác nhận chất lượng'}
const frequencyLabel:Record<string,string>={DAY:'ngày',WEEK:'tuần',MONTH:'tháng',USE_COUNT:'lần sử dụng',OUTPUT_COUNT:'sản lượng'}
const modTypeLabel:Record<string,string>={PHYSICAL_MODIFICATION:'Sửa đổi vật lý'}
const actionLabel:Record<string,string>={APPROVE:'Phê duyệt',QA_CONFIRM:'Xác nhận chất lượng',COMPLETE:'Hoàn tất'}

export function LiveToolingPanel() {
  const role = useAppRole()
  const canCreateMaster = canCreateToolingMaster(role)
  const canCreatePlan = canCreateToolingPlan(role)
  const canCreateMod = canCreateToolingModification(role)
  const [tooling, setTooling] = useState<LiveTooling[]>([])
  const [plans, setPlans] = useState<LiveToolingPlan[]>([])
  const [mods, setMods] = useState<LiveToolingModification[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<Tab>('MASTER')
  const [drawer, setDrawer] = useState<Drawer>('')
  const [query, setQuery] = useState('')
  const [selectedModId, setSelectedModId] = useState('')
  const [toolingId, setToolingId] = useState('')
  const [toolingName, setToolingName] = useState('')
  const [toolingType, setToolingType] = useState('JIG')
  const [ownership, setOwnership] = useState('COMPANY')
  const [customerName, setCustomerName] = useState('')
  const [planToolingId, setPlanToolingId] = useState('')
  const [inspectionItem, setInspectionItem] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [frequencyType, setFrequencyType] = useState('MONTH')
  const [frequencyValue, setFrequencyValue] = useState('1')
  const [modToolingId, setModToolingId] = useState('')
  const [modReason, setModReason] = useState('')
  const [beforeAfter, setBeforeAfter] = useState('')
  const [updatedDocs, setUpdatedDocs] = useState<Record<string, string>>({})

  const applyResult = useCallback((result: Awaited<ReturnType<typeof loadLiveTooling>>) => {
    setTooling(result.tooling); setPlans(result.plans); setMods(result.modifications)
    setPlanToolingId((current) => current || result.tooling[0]?.toolingId || '')
    setModToolingId((current) => current || result.tooling[0]?.toolingId || '')
    setError('')
  }, [])
  const refresh = useCallback(async () => applyResult(await loadLiveTooling()), [applyResult])

  useEffect(() => {
    let active = true
    loadLiveTooling().then((result) => { if (active) applyResult(result) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải danh mục jig, gá và dụng cụ') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applyResult])

  useEffect(() => {
    if (!drawer && !selectedModId) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawer(''); setSelectedModId('') } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawer, selectedModId])

  const normalized = query.trim().toLocaleLowerCase()
  const filteredTooling = useMemo(() => tooling.filter((item) => !normalized || [item.toolingId,item.toolingName,item.toolingType,item.ownership,item.status,item.managingDepartment,item.storageLocation].join(' ').toLocaleLowerCase().includes(normalized)), [tooling, normalized])
  const filteredPlans = useMemo(() => plans.filter((item) => !normalized || [item.toolingPlanId,item.toolingId,item.inspectionItem,item.acceptanceCriteria,item.frequencyType,item.responsiblePerson].join(' ').toLocaleLowerCase().includes(normalized)), [plans, normalized])
  const filteredMods = useMemo(() => mods.filter((item) => !normalized || [item.modificationId,item.toolingId,item.modificationType,item.reason,item.status,item.proposedBy,item.approvedBy,item.qaConfirmedBy].join(' ').toLocaleLowerCase().includes(normalized)), [mods, normalized])
  const selectedMod = selectedModId ? mods.find((item) => item.modificationId === selectedModId) || null : null

  const submitTooling = async (event: FormEvent) => {
    event.preventDefault(); if (!canCreateMaster) return setError(`Vai trò ${roleLabel[role]||role} không có quyền tạo danh mục jig, gá và dụng cụ.`)
    setBusy('create-tooling'); setError(''); setMessage('')
    try {
      await createTooling({ toolingId, toolingName, toolingType, ownership, customerName, status: 'IN_PRODUCTION', serialOrAssetNumber: '', usedFor: '', managingDepartment: '', storageLocation: '', commissionDate: '', inspectionCycleDays: '', note: '' })
      setMessage(`Đã tạo ${toolingId}`); setToolingId(''); setToolingName(''); setDrawer(''); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo dụng cụ') } finally { setBusy('') }
  }
  const submitPlan = async (event: FormEvent) => {
    event.preventDefault(); if (!canCreatePlan) return setError(`Vai trò ${roleLabel[role]||role} không có quyền tạo kế hoạch kiểm tra.`)
    setBusy('create-plan'); setError(''); setMessage('')
    try {
      await createToolingPlan({ toolingId: planToolingId, inspectionItem, acceptanceCriteria, frequencyType, frequencyValue, responsiblePerson: '', lastResultDate: '', note: '' })
      setMessage('Đã tạo kế hoạch kiểm tra'); setInspectionItem(''); setAcceptanceCriteria(''); setDrawer(''); setTab('PLAN'); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo kế hoạch kiểm tra') } finally { setBusy('') }
  }
  const submitModification = async (event: FormEvent) => {
    event.preventDefault(); if (!canCreateMod) return setError(`Vai trò ${roleLabel[role]||role} không có quyền tạo hồ sơ sửa đổi.`)
    setBusy('create-mod'); setError(''); setMessage('')
    try {
      await createToolingModification({ toolingId: modToolingId, modificationDate: new Date().toISOString().slice(0, 10), modificationType: 'PHYSICAL_MODIFICATION', reason: modReason, ecnNumber: '', beforeAfterDescription: beforeAfter })
      setMessage('Đã tạo BM-11 sửa đổi'); setModReason(''); setBeforeAfter(''); setDrawer(''); setTab('MOD'); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo hồ sơ sửa đổi') } finally { setBusy('') }
  }
  const transition = async (modificationId: string, action: 'APPROVE' | 'QA_CONFIRM' | 'COMPLETE') => {
    if (!canTransitionTooling(role, action)) return setError(`Vai trò ${roleLabel[role]||role} không có quyền ${actionLabel[action]||action}.`)
    setBusy(modificationId); setError(''); setMessage('')
    try { await transitionToolingModification(modificationId, action, updatedDocs[modificationId] || ''); setMessage(`${modificationId}: ${actionLabel[action]||action}`); await refresh() }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể chuyển trạng thái hồ sơ sửa đổi') } finally { setBusy('') }
  }

  const drawerAllowed = drawer === 'TOOLING' ? canCreateMaster : drawer === 'PLAN' ? canCreatePlan : drawer === 'MOD' ? canCreateMod : false

  return <div className="tooling-page">
    <section className="tooling-summary"><article><span>Danh mục jig, gá & dụng cụ</span><strong>{tooling.length}</strong><small>BM-09</small></article><article><span>Kế hoạch kiểm tra</span><strong>{plans.length}</strong><small>BM-10A</small></article><article><span>Sửa đổi đang mở</span><strong>{mods.filter((item) => item.status !== 'COMPLETED').length}</strong><small>BM-11</small></article><article><span>Hoàn tất</span><strong>{mods.filter((item) => item.status === 'COMPLETED').length}</strong><small>Hồ sơ sửa đổi</small></article></section>
    <section className="tooling-surface">
      <header className="tooling-header"><div><p className="eyebrow">Kiểm soát jig, gá & dụng cụ</p><h2>Quản lý jig, gá & dụng cụ</h2><p>Dữ liệu và quy trình được kiểm soát trực tiếp trên hệ thống</p></div><div className="tooling-actions"><button type="button" onClick={() => void refresh()}>Làm mới</button>{canCreateMaster?<button type="button" onClick={() => setDrawer('TOOLING')}>+ Dụng cụ</button>:null}{canCreatePlan?<button type="button" onClick={() => setDrawer('PLAN')}>+ Kế hoạch</button>:null}{canCreateMod?<button className="tooling-primary" type="button" onClick={() => setDrawer('MOD')}>+ Sửa đổi</button>:null}</div></header>
      <div className="tooling-tabs"><button className={tab==='MASTER'?'active':''} onClick={() => setTab('MASTER')}>Danh mục ({tooling.length})</button><button className={tab==='PLAN'?'active':''} onClick={() => setTab('PLAN')}>Kế hoạch ({plans.length})</button><button className={tab==='MOD'?'active':''} onClick={() => setTab('MOD')}>Sửa đổi ({mods.length})</button></div>
      <div className="tooling-toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã, tên, loại, trạng thái, người phụ trách…" /></div>
      {loading ? <div className="tooling-state">Đang tải dữ liệu jig, gá và dụng cụ…</div> : null}{error ? <div className="tooling-state error">{error}</div> : null}{message ? <div className="tooling-feedback">{message}</div> : null}
      {!loading && !error && tab==='MASTER' ? <div className="tooling-table-scroll"><table><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Sở hữu</th><th>Bộ phận</th><th>Vị trí</th><th>Trạng thái</th></tr></thead><tbody>{filteredTooling.map((item)=><tr key={item.toolingId}><td><b>{item.toolingId}</b></td><td>{item.toolingName||'—'}</td><td>{toolingTypeLabel[item.toolingType]||item.toolingType||'—'}</td><td>{ownershipLabel[item.ownership]||item.ownership||'—'}</td><td>{item.managingDepartment||'—'}</td><td>{item.storageLocation||'—'}</td><td><span className="tooling-badge">{statusLabel[item.status]||item.status||'—'}</span></td></tr>)}</tbody></table></div> : null}
      {!loading && !error && tab==='PLAN' ? <div className="tooling-table-scroll"><table><thead><tr><th>Mã kế hoạch</th><th>Dụng cụ</th><th>Hạng mục</th><th>Tiêu chuẩn</th><th>Tần suất</th><th>Phụ trách</th><th>Kết quả gần nhất</th></tr></thead><tbody>{filteredPlans.map((item)=><tr key={item.toolingPlanId}><td><b>{item.toolingPlanId}</b></td><td>{item.toolingId}</td><td>{item.inspectionItem||'—'}</td><td>{item.acceptanceCriteria||'—'}</td><td>{item.frequencyValue} {frequencyLabel[item.frequencyType]||item.frequencyType}</td><td>{item.responsiblePerson||'—'}</td><td>{item.lastResultDate||'—'}</td></tr>)}</tbody></table></div> : null}
      {!loading && !error && tab==='MOD' ? <div className="tooling-table-scroll"><table><thead><tr><th>Mã</th><th>Dụng cụ</th><th>Loại</th><th>Lý do</th><th>Người đề xuất</th><th>Người phê duyệt</th><th>Xác nhận chất lượng</th><th>Trạng thái</th><th /></tr></thead><tbody>{filteredMods.map((item)=><tr key={item.modificationId}><td><button className="tooling-link" onClick={() => setSelectedModId(item.modificationId)}>{item.modificationId}</button></td><td>{item.toolingId}</td><td>{modTypeLabel[item.modificationType]||item.modificationType}</td><td>{item.reason||'—'}</td><td>{item.proposedBy||'—'}</td><td>{item.approvedBy||'—'}</td><td>{item.qaConfirmedBy||'—'}</td><td><span className={`tooling-badge ${item.status==='COMPLETED'?'done':''}`}>{statusLabel[item.status]||item.status}</span></td><td><button onClick={() => setSelectedModId(item.modificationId)}>Xem</button></td></tr>)}</tbody></table></div> : null}
    </section>

    {drawer && drawerAllowed ? <div className="tooling-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget)setDrawer('')}}><aside className="tooling-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">{drawer==='TOOLING'?'BM-TBSX-09':drawer==='PLAN'?'BM-TBSX-10A':'BM-TBSX-11'}</p><h2>{drawer==='TOOLING'?'Thêm dụng cụ':drawer==='PLAN'?'Tạo kế hoạch kiểm tra':'Tạo hồ sơ sửa đổi'}</h2></div><button onClick={()=>setDrawer('')}>×</button></header>
      {drawer==='TOOLING'?<form onSubmit={submitTooling}><label><span>Mã dụng cụ</span><input value={toolingId} onChange={(e)=>setToolingId(e.target.value)} required/></label><label><span>Tên dụng cụ</span><input value={toolingName} onChange={(e)=>setToolingName(e.target.value)} required/></label><label><span>Loại</span><select value={toolingType} onChange={(e)=>setToolingType(e.target.value)}><option value="JIG">Jig / gá</option><option value="FIXTURE">Đồ gá</option><option value="MOLD">Khuôn</option><option value="DIE">Khuôn dập</option><option value="CUTTING_TOOL">Dụng cụ cắt</option><option value="PERISHABLE_TOOL">Dụng cụ nhanh hỏng</option><option value="OTHER">Khác</option></select></label><label><span>Sở hữu</span><select value={ownership} onChange={(e)=>setOwnership(e.target.value)}><option value="COMPANY">Công ty</option><option value="CUSTOMER">Khách hàng</option></select></label>{ownership==='CUSTOMER'?<label><span>Khách hàng</span><input value={customerName} onChange={(e)=>setCustomerName(e.target.value)} required/></label>:null}<footer><button type="button" onClick={()=>setDrawer('')}>Hủy</button><button className="tooling-primary" disabled={busy==='create-tooling'}>{busy==='create-tooling'?'Đang tạo…':'Tạo dụng cụ'}</button></footer></form>:null}
      {drawer==='PLAN'?<form onSubmit={submitPlan}><label><span>Dụng cụ</span><select value={planToolingId} onChange={(e)=>setPlanToolingId(e.target.value)}>{tooling.map((i)=><option key={i.toolingId}>{i.toolingId}</option>)}</select></label><label><span>Hạng mục kiểm tra</span><input value={inspectionItem} onChange={(e)=>setInspectionItem(e.target.value)} required/></label><label><span>Tiêu chuẩn chấp nhận</span><input value={acceptanceCriteria} onChange={(e)=>setAcceptanceCriteria(e.target.value)} required/></label><label><span>Tần suất</span><select value={frequencyType} onChange={(e)=>setFrequencyType(e.target.value)}><option value="DAY">Ngày</option><option value="WEEK">Tuần</option><option value="MONTH">Tháng</option><option value="USE_COUNT">Số lần sử dụng</option><option value="OUTPUT_COUNT">Sản lượng</option></select></label><label><span>Giá trị</span><input type="number" min="1" value={frequencyValue} onChange={(e)=>setFrequencyValue(e.target.value)} required/></label><footer><button type="button" onClick={()=>setDrawer('')}>Hủy</button><button className="tooling-primary" disabled={busy==='create-plan'||!tooling.length}>Tạo kế hoạch</button></footer></form>:null}
      {drawer==='MOD'?<form onSubmit={submitModification}><label><span>Dụng cụ</span><select value={modToolingId} onChange={(e)=>setModToolingId(e.target.value)}>{tooling.map((i)=><option key={i.toolingId}>{i.toolingId}</option>)}</select></label><label><span>Lý do</span><textarea value={modReason} onChange={(e)=>setModReason(e.target.value)} required/></label><label><span>Trước / Sau</span><textarea value={beforeAfter} onChange={(e)=>setBeforeAfter(e.target.value)} required/></label><footer><button type="button" onClick={()=>setDrawer('')}>Hủy</button><button className="tooling-primary" disabled={busy==='create-mod'||!tooling.length}>Tạo hồ sơ sửa đổi</button></footer></form>:null}
    </aside></div>:null}

    {selectedMod?<div className="tooling-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelectedModId('')}}><aside className="tooling-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">BM-TBSX-11</p><h2>{selectedMod.modificationId}</h2><p>{selectedMod.toolingId}</p></div><button onClick={()=>setSelectedModId('')}>×</button></header><div className="tooling-detail"><span>Trạng thái</span><strong>{statusLabel[selectedMod.status]||selectedMod.status}</strong><span>Lý do</span><p>{selectedMod.reason||'—'}</p><span>Người đề xuất</span><p>{selectedMod.proposedBy||'—'}</p><span>Người phê duyệt</span><p>{selectedMod.approvedBy||'—'}</p><span>Xác nhận chất lượng</span><p>{selectedMod.qaConfirmedBy||'—'}</p></div>{selectedMod.status!=='COMPLETED'?<div className="tooling-workflow">{!selectedMod.approvedBy&&canTransitionTooling(role,'APPROVE')?<button disabled={busy===selectedMod.modificationId} onClick={()=>void transition(selectedMod.modificationId,'APPROVE')}>Phê duyệt</button>:null}{!selectedMod.qaConfirmedBy&&canTransitionTooling(role,'QA_CONFIRM')?<button disabled={busy===selectedMod.modificationId} onClick={()=>void transition(selectedMod.modificationId,'QA_CONFIRM')}>Xác nhận chất lượng</button>:null}{selectedMod.approvedBy&&canTransitionTooling(role,'COMPLETE')?<><label><span>Tài liệu đã cập nhật</span><input value={updatedDocs[selectedMod.modificationId]||''} onChange={(e)=>setUpdatedDocs((c)=>({...c,[selectedMod.modificationId]:e.target.value}))}/></label><button className="tooling-primary" disabled={busy===selectedMod.modificationId} onClick={()=>void transition(selectedMod.modificationId,'COMPLETE')}>Hoàn tất</button></>:null}{!canTransitionTooling(role,'APPROVE')&&!canTransitionTooling(role,'QA_CONFIRM')&&!canTransitionTooling(role,'COMPLETE')?<span className="tooling-readonly">Chỉ xem · {roleLabel[role]||role}</span>:null}</div>:null}</aside></div>:null}
  </div>
}
