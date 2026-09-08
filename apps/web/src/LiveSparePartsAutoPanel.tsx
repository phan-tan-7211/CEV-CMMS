import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './SpareParts.css'
import { useAppRole } from './auth/AppRoleContext'
import { EquipmentMultiSelect } from './components/EquipmentMultiSelect'
import { type LiveEquipment } from './data/liveEquipment'
import { getEquipmentCacheSnapshot, loadSupabaseEquipment } from './data/supabaseEquipment'
import { getSparePartsCacheSnapshot, loadSpareParts, loadSpareUsage, recordSpareUsage, saveSparePart, type LiveSparePart, type SpareClassification, type SpareUsage } from './data/liveSpareParts'

type PartForm = {
  partId: string
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
  equipmentIds: string[]
}

const EMPTY: PartForm = { partId:'',partName:'',partNumber:'',maker:'',stockQty:'0',minQty:'0',location:'',leadTimeDays:'',stopsProduction:false,qualitySafetyImpact:false,leadTimeExceedsRecovery:false,rationaleNote:'',equipmentIds:[] }
const LABEL: Record<SpareClassification,string> = { NORMAL:'Thông thường', RECOMMENDED:'Khuyến nghị dự trữ', REQUIRED:'Bắt buộc dự trữ' }

function classify(form: PartForm, equipment: LiveEquipment[]) {
  const criticalCount = form.equipmentIds.filter((id) => ['A','B'].includes((equipment.find((row) => row.equipmentId === id)?.criticality || '').toUpperCase())).length
  const sharedCritical = criticalCount >= 2
  const score = Number(form.stopsProduction) + Number(form.qualitySafetyImpact) + Number(form.leadTimeExceedsRecovery) + Number(sharedCritical)
  const classification: SpareClassification = form.qualitySafetyImpact || (form.stopsProduction && form.leadTimeExceedsRecovery) || score >= 3 ? 'REQUIRED' : score === 2 ? 'RECOMMENDED' : 'NORMAL'
  return { criticalCount, sharedCritical, score, classification }
}

function editForm(part: LiveSparePart): PartForm {
  return { partId:part.partId,partName:part.partName,partNumber:part.partNumber,maker:part.maker,stockQty:String(part.stockQty),minQty:String(part.minQty),location:part.location,leadTimeDays:part.leadTimeDays===null?'':String(part.leadTimeDays),stopsProduction:part.stopsProduction,qualitySafetyImpact:part.qualitySafetyImpact,leadTimeExceedsRecovery:part.leadTimeExceedsRecovery,rationaleNote:part.rationaleNote,equipmentIds:part.equipment.map((item)=>item.equipmentId) }
}

export function LiveSparePartsAutoPanel() {
  const role = useAppRole()
  const canEdit = ['MAINTENANCE','MANAGER','ADMIN'].includes(role)
  const initialParts = getSparePartsCacheSnapshot()
  const initialEquipment = getEquipmentCacheSnapshot()
  const [initialPartsEmpty] = useState(()=>initialParts.length===0)
  const [parts,setParts] = useState<LiveSparePart[]>(initialParts)
  const [equipment,setEquipment] = useState<LiveEquipment[]>(initialEquipment)
  const [usage,setUsage] = useState<SpareUsage[]>([])
  const [loading,setLoading] = useState(initialParts.length===0)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [query,setQuery] = useState('')
  const [purchaseOnly,setPurchaseOnly] = useState(false)
  const [selectedId,setSelectedId] = useState('')
  const [formOpen,setFormOpen] = useState(false)
  const [form,setForm] = useState<PartForm>(EMPTY)
  const [usageEquipment,setUsageEquipment] = useState('')
  const [usageQty,setUsageQty] = useState('1')
  const [usageWorkOrder,setUsageWorkOrder] = useState('')
  const [usageReason,setUsageReason] = useState('')

  useEffect(()=>{
    let active=true
    Promise.all([loadSpareParts({force:true}),loadSupabaseEquipment({force:false})])
      .then(([p,e])=>{if(!active)return;setParts(p);setEquipment(e);setError('')})
      .catch((cause:unknown)=>{if(active&&initialPartsEmpty)setError(cause instanceof Error?cause.message:'Không thể tải phụ tùng')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[initialPartsEmpty])
  useEffect(()=>{
    if(!selectedId)return
    let active=true
    void loadSpareUsage(selectedId)
      .then((rows)=>{if(active)setUsage(rows)})
      .catch(()=>{if(active)setUsage([])})
    return()=>{active=false}
  },[selectedId])

  const selected = parts.find((part)=>part.partId===selectedId) || null
  const preview = classify(form,equipment)
  const normalized = query.trim().toLowerCase()
  const filtered = useMemo(()=>parts.filter((part)=>{
    if(purchaseOnly && !(part.stockQty<=part.minQty && part.classification!=='NORMAL')) return false
    if(!normalized) return true
    return [part.partId,part.partName,part.partNumber,part.maker,part.location,...part.equipment.flatMap((item)=>[item.equipmentId,item.equipmentName])].join(' ').toLowerCase().includes(normalized)
  }),[parts,purchaseOnly,normalized])
  const required = parts.filter((p)=>p.classification==='REQUIRED').length
  const needBuy = parts.filter((p)=>p.stockQty<=p.minQty&&p.classification!=='NORMAL').length
  const linkedEquipment = useMemo(()=>{
    if(!selected) return []
    const ids = new Set(selected.equipment.map((item)=>item.equipmentId))
    return equipment.filter((item)=>ids.has(item.equipmentId))
  },[selected,equipment])

  function startNew(){setSelectedId('');setForm(EMPTY);setFormOpen(true);setMessage('');setError('')}
  function startEdit(part:LiveSparePart){setSelectedId(part.partId);setForm(editForm(part));setFormOpen(true);setMessage('');setError('')}

  async function submit(event:FormEvent){
    event.preventDefault(); if(!canEdit||!form.partName.trim())return
    setSaving(true);setError('');setMessage('')
    try{
      const saved=await saveSparePart({partId:form.partId,partName:form.partName.trim(),partNumber:form.partNumber.trim(),maker:form.maker.trim(),stockQty:Math.max(0,Number(form.stockQty)||0),minQty:Math.max(0,Number(form.minQty)||0),location:form.location.trim(),leadTimeDays:form.leadTimeDays===''?null:Math.max(0,Number(form.leadTimeDays)||0),stopsProduction:form.stopsProduction,qualitySafetyImpact:form.qualitySafetyImpact,leadTimeExceedsRecovery:form.leadTimeExceedsRecovery,rationaleNote:form.rationaleNote.trim(),equipmentIds:form.equipmentIds})
      setParts(getSparePartsCacheSnapshot());setSelectedId(saved.partId);setFormOpen(false);setMessage(`Đã lưu ${saved.partId} · ${LABEL[saved.classification]} ${saved.riskScore}/4 · ${saved.equipmentCount} thiết bị`)
    }catch(cause:unknown){const text=cause instanceof Error?cause.message:'Không thể lưu phụ tùng';setError(text.replace('SPARE_PART_POSSIBLE_DUPLICATE:','Có thể đã tồn tại mã '))}finally{setSaving(false)}
  }

  async function submitUsage(event:FormEvent){
    event.preventDefault();if(!selected||!usageEquipment)return
    setSaving(true);setError('')
    try{
      await recordSpareUsage({partId:selected.partId,equipmentId:usageEquipment,quantity:Math.max(1,Number(usageQty)||1),reason:usageReason.trim(),workOrderId:usageWorkOrder.trim()||undefined})
      setParts(getSparePartsCacheSnapshot());setUsage(await loadSpareUsage(selected.partId));setUsageReason('');setUsageWorkOrder('');setUsageQty('1');setMessage(`Đã ghi thay ${selected.partId} cho ${usageEquipment}`)
    }catch(cause:unknown){setError(cause instanceof Error?cause.message:'Không thể ghi lịch sử thay')}finally{setSaving(false)}
  }

  return <div className="spare-page">
    <section className="spare-summary"><article><span>Danh mục</span><strong>{parts.length}</strong><small>linh kiện đã biết</small></article><article><span>Bắt buộc dự trữ</span><strong>{required}</strong><small>cần bảo đảm luôn sẵn có</small></article><article className={needBuy?'warn':''}><span>Cần xem xét mua</span><strong>{needBuy}</strong><small>tồn ≤ mức tối thiểu</small></article><article><span>Mã tự sinh</span><strong>SP</strong><small>SP-00001…</small></article></section>
    <section className="spare-surface">
      <header className="spare-header"><div><p className="eyebrow">Phụ tùng thay thế · IATF 8.5.1.5</p><h2>Linh kiện thay thế</h2><p>Chỉ nhập thông tin thực tế cần thiết. Mã quản lý và phân loại rủi ro do hệ thống tự sinh.</p></div>{canEdit?<button className="spare-primary" onClick={startNew}>+ Thêm linh kiện</button>:null}</header>
      <div className="spare-toolbar"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Tìm mã, mã linh kiện, tên, máy, hãng…"/><label><input type="checkbox" checked={purchaseOnly} onChange={(e)=>setPurchaseOnly(e.target.checked)}/> Chỉ hiện cần mua</label></div>
      {message?<div className="spare-state success">{message}</div>:null}{error?<div className="spare-state error">{error}</div>:null}{loading?<div className="spare-state">Đang tải…</div>:null}
      {!loading?<div className="spare-grid"><div className="spare-list">{filtered.map((part)=><button key={part.partId} className={`spare-card ${selectedId===part.partId?'active':''}`} onClick={()=>{setSelectedId(part.partId);setFormOpen(false);setUsageEquipment('');setUsageWorkOrder('')}}><div><strong>{part.partName}</strong><small>{part.partId}{part.partNumber?` · ${part.partNumber}`:''}</small></div><span className={`spare-badge ${part.classification.toLowerCase()}`}>{LABEL[part.classification]} {part.riskScore}/4</span><div className="spare-card-meta"><span>{part.equipmentCount} máy</span><span>Tồn {part.stockQty} / Tối thiểu {part.minQty}</span>{part.stockQty<=part.minQty&&part.classification!=='NORMAL'?<b>Cần mua</b>:null}</div></button>)}</div>
        <div className="spare-detail">{formOpen?<form onSubmit={submit} className="spare-form"><header><div><p className="eyebrow">Đăng ký phụ tùng</p><h3>{form.partId||'Linh kiện mới'}</h3><p>{form.partId?'Đang sửa mã hiện có':'Mã SP-xxxxx sẽ tự sinh khi lưu'}</p></div><span className={`spare-badge ${preview.classification.toLowerCase()}`}>{LABEL[preview.classification]} {preview.score}/4</span></header>
          <div className="spare-fields"><label><span>Tên linh kiện *</span><input autoFocus value={form.partName} onChange={(e)=>setForm({...form,partName:e.target.value})} required/></label><label><span>Mã linh kiện</span><input value={form.partNumber} onChange={(e)=>setForm({...form,partNumber:e.target.value})}/></label><label><span>Hãng / nhà sản xuất</span><input value={form.maker} onChange={(e)=>setForm({...form,maker:e.target.value})}/></label><label><span>Tồn hiện tại</span><input type="number" min="0" value={form.stockQty} onChange={(e)=>setForm({...form,stockQty:e.target.value})}/></label><label><span>Tồn tối thiểu</span><input type="number" min="0" value={form.minQty} onChange={(e)=>setForm({...form,minQty:e.target.value})}/></label><label><span>Vị trí lưu kho</span><input value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})} placeholder="Ví dụ: Tủ A · Kệ 2 · Ngăn 3"/></label><label><span>Thời gian cung ứng (ngày)</span><input type="number" min="0" value={form.leadTimeDays} onChange={(e)=>setForm({...form,leadTimeDays:e.target.value})}/></label></div>
          <section className="spare-risk"><h4>Hệ thống tự chấm từ 4 yếu tố</h4><label><input type="checkbox" checked={form.stopsProduction} onChange={(e)=>setForm({...form,stopsProduction:e.target.checked})}/><span><b>1. Hỏng phụ tùng làm máy/dây chuyền dừng?</b><small>Trả lời Có/Không.</small></span></label><label><input type="checkbox" checked={form.qualitySafetyImpact} onChange={(e)=>setForm({...form,qualitySafetyImpact:e.target.checked})}/><span><b>2. Ảnh hưởng chất lượng hoặc an toàn?</b><small>Có → tự xếp Bắt buộc dự trữ.</small></span></label><label><input type="checkbox" checked={form.leadTimeExceedsRecovery} onChange={(e)=>setForm({...form,leadTimeExceedsRecovery:e.target.checked})}/><span><b>3. Thời gian cung ứng vượt thời gian dừng chấp nhận?</b><small>Xác nhận theo thực tế cung ứng.</small></span></label><label className="auto"><input type="checkbox" checked={preview.sharedCritical} readOnly/><span><b>4. Dùng chung ≥2 máy A/B?</b><small>Tự tính từ liên kết · hiện {preview.criticalCount} máy A/B.</small></span></label></section>
          <EquipmentMultiSelect equipment={equipment} selectedIds={form.equipmentIds} onChange={(equipmentIds)=>setForm((current)=>({...current,equipmentIds}))} title="Máy sử dụng" helper="Tìm và chọn nhiều máy cùng lúc. Mỗi máy hiển thị ảnh, mã, tên và cấp độ." disabled={saving}/>
          <label className="spare-note"><span>Căn cứ / ghi chú</span><textarea value={form.rationaleNote} onChange={(e)=>setForm({...form,rationaleNote:e.target.value})}/></label><footer><button type="button" onClick={()=>setFormOpen(false)}>Hủy</button><button className="spare-primary" disabled={saving}>{saving?'Đang lưu…':form.partId?'Lưu thay đổi':'Tạo & tự sinh mã'}</button></footer></form>
        :selected?<><header className="spare-detail-head"><div><p className="eyebrow">{selected.partId}</p><h3>{selected.partName}</h3><p>{selected.partNumber||'Chưa có mã linh kiện'}{selected.maker?` · ${selected.maker}`:''}</p></div><span className={`spare-badge ${selected.classification.toLowerCase()}`}>{LABEL[selected.classification]} {selected.riskScore}/4</span></header><div className="spare-facts"><div><span>Tồn / Tối thiểu</span><strong>{selected.stockQty} / {selected.minQty}</strong></div><div><span>Vị trí lưu kho</span><strong>{selected.location||'—'}</strong></div><div><span>Thời gian cung ứng</span><strong>{selected.leadTimeDays===null?'—':`${selected.leadTimeDays} ngày`}</strong></div><div><span>Dùng cho</span><strong>{selected.equipmentCount} máy</strong></div></div><section className="spare-why"><h4>Lý do phân loại</h4><p className={selected.stopsProduction?'yes':''}>{selected.stopsProduction?'✓':'○'} Dừng máy/dây chuyền</p><p className={selected.qualitySafetyImpact?'yes':''}>{selected.qualitySafetyImpact?'✓':'○'} Chất lượng/an toàn</p><p className={selected.leadTimeExceedsRecovery?'yes':''}>{selected.leadTimeExceedsRecovery?'✓':'○'} Thời gian cung ứng vượt thời gian phục hồi cho phép</p><p className={selected.sharedCritical?'yes':''}>{selected.sharedCritical?'✓':'○'} Dùng chung ≥2 máy A/B ({selected.criticalEquipmentCount})</p></section><section><h4>Máy sử dụng</h4><div className="spare-chips">{selected.equipment.map((item)=><span key={item.equipmentId}>{item.equipmentId} <small>{item.equipmentName||'—'} · {item.criticality||'—'}</small></span>)}</div></section>{canEdit?<><button className="spare-primary" onClick={()=>startEdit(selected)}>Sửa thông tin</button><section><h4>Ghi đã thay linh kiện</h4><EquipmentMultiSelect equipment={linkedEquipment} selectedIds={usageEquipment?[usageEquipment]:[]} onChange={(ids)=>setUsageEquipment(ids[0]||'')} title="Chọn thiết bị đã thay" helper="Chỉ hiển thị các thiết bị đã liên kết với phụ tùng này. Chạm trực tiếp vào thiết bị để chọn nhanh." disabled={saving} selectionMode="single" compact/><form className="spare-usage-form" onSubmit={submitUsage}><input type="number" min="1" value={usageQty} onChange={(e)=>setUsageQty(e.target.value)} aria-label="Số lượng đã thay"/><input value={usageWorkOrder} onChange={(e)=>setUsageWorkOrder(e.target.value)} placeholder="Work Order (nếu có)" aria-label="Work Order liên quan"/><input value={usageReason} onChange={(e)=>setUsageReason(e.target.value)} placeholder="Lý do / sự cố"/><button disabled={saving||!usageEquipment}>Ghi thay & trừ tồn</button></form></section></>:null}<section><h4>Lịch sử thay</h4>{usage.length?<div className="spare-usage-list">{usage.map((item)=>{const row=equipment.find((eq)=>eq.equipmentId===item.equipmentId);const actor=item.performedBy||item.actorEmail;return <article key={item.usageId}><div><b>{row?.equipmentName||item.equipmentId}</b><small>{item.equipmentId}{row?.currentLine?` · ${row.currentLine}`:''}</small></div><strong>×{item.quantity}</strong><div className="spare-usage-meta"><span>{item.usedAt.slice(0,10)}</span>{item.workOrderId?<b>WO {item.workOrderId}</b>:null}{actor?<span>{actor}</span>:null}</div>{item.reason?<small className="spare-usage-reason">{item.reason}</small>:null}</article>})}</div>:<p>Chưa có lịch sử.</p>}</section></>:<div className="spare-empty"><b>Chọn linh kiện</b><p>Hoặc tạo mới. Mã sẽ được cấp tự động.</p></div>}</div></div>:null}
    </section>
  </div>
}