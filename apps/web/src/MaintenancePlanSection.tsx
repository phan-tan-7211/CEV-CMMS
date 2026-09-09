import { useMemo, useState, type FormEvent } from 'react'
import { canCreateMaintenance, useAppRole } from './auth/AppRoleContext'
import { upsertMaintenancePlan, type LiveMaintenancePlan, type MaintenanceEquipmentOption, type MaintenancePlanInput } from './data/liveMaintenance'

type Props = { equipment: MaintenanceEquipmentOption[]; plans: LiveMaintenancePlan[]; onSaved: () => Promise<void> }
type DraftItem = { itemName: string; standard: string; method: string; note: string }
type PlanFilter = 'ALL' | 'OVERDUE' | 'DUE' | 'ACTIVE'
const EMPTY_ITEM: DraftItem = { itemName: '', standard: '', method: '', note: '' }
const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}
const statusLabel:Record<string,string>={OVERDUE:'Quá hạn',DUE:'Đến hạn',PLANNED:'Đã lập kế hoạch',COMPLETED:'Đã hoàn tất',ACTIVE:'Đang áp dụng',INACTIVE:'Ngưng áp dụng'}
const maintenanceTypeLabel:Record<string,string>={PM:'Bảo trì phòng ngừa',PdM:'Bảo trì dự đoán',CM:'Bảo trì khắc phục'}

function newDraft(equipmentId: string): MaintenancePlanInput { return { equipmentId, maintenanceType: 'PM', frequency: 'Hàng tháng', plannedDate: '', responsiblePerson: '', scheduledWindow: '', note: '', active: true, items: [{ ...EMPTY_ITEM }] } }
function fromPlan(plan: LiveMaintenancePlan): MaintenancePlanInput { return { planId: plan.planId, equipmentId: plan.equipmentId, maintenanceType: plan.maintenanceType || 'PM', frequency: plan.frequency || '', plannedDate: plan.plannedDate, responsiblePerson: plan.responsiblePerson, scheduledWindow: plan.scheduledWindow, note: plan.note, active: plan.active, items: plan.items.length ? plan.items.map((item) => ({ itemName: item.itemName, standard: item.standard, method: item.method, note: item.note })) : [{ ...EMPTY_ITEM }] } }
function normalize(value:string){return value.toLocaleLowerCase('vi-VN').trim()}

export function MaintenancePlanSection({ equipment, plans, onSaved }: Props) {
  const role = useAppRole(); const canWrite = canCreateMaintenance(role)
  const [draft, setDraft] = useState<MaintenancePlanInput | null>(null); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const [query,setQuery]=useState(''); const [filter,setFilter]=useState<PlanFilter>('ALL')
  const equipmentName = useMemo(() => new Map(equipment.map((item) => [item.equipmentId, item.equipmentName])), [equipment])
  const openNew = () => { setDraft(newDraft(equipment[0]?.equipmentId || '')); setMessage(''); setError('') }
  const updateItem = (index: number, patch: Partial<DraftItem>) => setDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current)
  const removeItem = (index: number) => setDraft((current) => current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current)
  const filteredPlans=useMemo(()=>{const needle=normalize(query);return plans.filter((plan)=>{const status=(plan.status||'ACTIVE').toUpperCase();if(filter==='OVERDUE'&&status!=='OVERDUE')return false;if(filter==='DUE'&&status!=='DUE')return false;if(filter==='ACTIVE'&&!plan.active)return false;if(!needle)return true;return [plan.planId,plan.equipmentId,equipmentName.get(plan.equipmentId)||'',plan.frequency,plan.responsiblePerson,plan.scheduledWindow,...plan.items.map((item)=>item.itemName)].some((value)=>normalize(String(value||'')).includes(needle))})},[equipmentName,filter,plans,query])
  const count=(target:PlanFilter)=>target==='ALL'?plans.length:target==='ACTIVE'?plans.filter((plan)=>plan.active).length:plans.filter((plan)=>(plan.status||'').toUpperCase()===target).length

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!draft || !canWrite) return
    if (!draft.equipmentId || !draft.maintenanceType.trim() || !draft.frequency.trim()) return
    if (!draft.items.some((item) => item.itemName.trim())) return setError('Kế hoạch PM cần ít nhất 1 hạng mục bảo trì.')
    setSaving(true); setError(''); setMessage('')
    try { const result = await upsertMaintenancePlan({ ...draft, items: draft.items.filter((item) => item.itemName.trim()) }); setMessage(`Đã lưu ${result.planId} · ${result.itemCount} hạng mục`); setDraft(null); await onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu kế hoạch PM') }
    finally { setSaving(false) }
  }

  const openScheduler=()=>window.dispatchEvent(new CustomEvent('cev:navigate',{detail:{view:'scheduler'}}))

  return <section className="maintenance-surface maintenance-pm upkeep-pm" aria-labelledby="pm-title">
    <header className="maintenance-header"><div><p className="eyebrow">Preventive Maintenance</p><h3 id="pm-title">Kế hoạch bảo trì phòng ngừa</h3><p>Quản lý kế hoạch theo thiết bị, chu kỳ, người chịu trách nhiệm và nội dung công việc. Work Order thực hiện và bằng chứng hoàn thành được quản lý trong cùng luồng CMMS.</p></div><div className="maintenance-header-actions"><button className="maintenance-row-action" type="button" onClick={openScheduler}>Mở Lịch trình</button>{canWrite ? <button className="maintenance-primary" type="button" onClick={openNew}>+ Tạo kế hoạch PM</button> : <span className="maintenance-readonly">Chỉ xem · {roleLabel[role]||role}</span>}</div></header>
    <div className="maintenance-list-toolbar"><label className="maintenance-search"><span className="sr-only">Tìm kế hoạch bảo trì</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Tìm mã kế hoạch, thiết bị, người phụ trách…" /></label><div className="maintenance-filter-chips" role="group" aria-label="Lọc kế hoạch">{(['ALL','OVERDUE','DUE','ACTIVE'] as PlanFilter[]).map((item)=><button key={item} type="button" className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item==='ALL'?'Tất cả':item==='OVERDUE'?'Quá hạn':item==='DUE'?'Đến hạn':'Đang áp dụng'} <span>{count(item)}</span></button>)}</div></div>
    {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}{error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}
    {filteredPlans.length ? <div className="maintenance-table-scroll"><table className="maintenance-table maintenance-plan-table"><thead><tr><th>Kế hoạch</th><th>Thiết bị</th><th>Loại / tần suất</th><th>Kỳ dự kiến</th><th>Người phụ trách</th><th>Checklist PM</th><th /></tr></thead><tbody>{filteredPlans.map((plan) => <tr key={plan.planId}><td><b>{plan.planId}</b><small className={`maintenance-status status-${(plan.status||'active').toLowerCase()}`}>{statusLabel[plan.status]||plan.status||'Đang áp dụng'}</small></td><td><b>{plan.equipmentId}</b><small>{equipmentName.get(plan.equipmentId) || '—'}</small></td><td>{maintenanceTypeLabel[plan.maintenanceType]||plan.maintenanceType||'Bảo trì phòng ngừa'}<small>{plan.frequency || '—'}</small></td><td>{plan.plannedDate || plan.scheduledWindow || '—'}<small>{plan.scheduledWindow || ''}</small></td><td>{plan.responsiblePerson || '—'}</td><td><b>{plan.items.length} hạng mục</b><small>{plan.items.slice(0, 2).map((item) => item.itemName).join(' · ') || 'Chưa có hạng mục'}</small></td><td>{canWrite ? <button className="maintenance-row-action" type="button" onClick={() => setDraft(fromPlan(plan))}>Sửa</button> : null}</td></tr>)}</tbody></table></div> : <div className="maintenance-state">{plans.length?'Không có kế hoạch phù hợp bộ lọc.':'Chưa có kế hoạch PM. Hãy tạo kế hoạch bảo trì phù hợp cho thiết bị.'}</div>}
    {draft && canWrite ? <div className="maintenance-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}><aside className="maintenance-drawer maintenance-plan-drawer" role="dialog" aria-modal="true" aria-labelledby="pm-editor-title"><header><div><p className="eyebrow">Preventive Maintenance</p><h2 id="pm-editor-title">{draft.planId ? `Sửa ${draft.planId}` : 'Lập kế hoạch bảo trì phòng ngừa'}</h2></div><button type="button" aria-label="Đóng" onClick={() => setDraft(null)}>×</button></header><form className="maintenance-create-form" onSubmit={submit}>
      <label><span>Thiết bị</span><select value={draft.equipmentId} onChange={(event) => setDraft({ ...draft, equipmentId: event.target.value })}>{equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentId} · {item.equipmentName}</option>)}</select></label>
      <label><span>Loại bảo trì</span><select value={draft.maintenanceType} onChange={(event) => setDraft({ ...draft, maintenanceType: event.target.value })}><option value="PM">Bảo trì phòng ngừa</option><option value="PdM">Bảo trì dự đoán</option><option value="CM">Bảo trì khắc phục</option></select></label>
      <label><span>Tần suất</span><input value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value })} placeholder="Hàng tháng / 3 tháng một lần" required /></label>
      <label><span>Ngày/kỳ dự kiến</span><input value={draft.plannedDate} onChange={(event) => setDraft({ ...draft, plannedDate: event.target.value })} placeholder="2026-09-12 hoặc Tháng 3, 6, 9, 12" /></label>
      <label><span>Người thực hiện</span><input value={draft.responsiblePerson} onChange={(event) => setDraft({ ...draft, responsiblePerson: event.target.value })} placeholder="Nhân viên bảo trì" /></label>
      <label><span>Khung thời gian</span><input value={draft.scheduledWindow} onChange={(event) => setDraft({ ...draft, scheduledWindow: event.target.value })} placeholder="Thứ 7 tuần 2" /></label>
      <label className="wide"><span>Ghi chú kế hoạch</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} rows={2} /></label>
      <div className="wide maintenance-plan-items"><div className="maintenance-plan-items-head"><div><b>Hạng mục / tiêu chuẩn bảo trì</b><small>Hạng mục · Tiêu chuẩn · Phương pháp; bằng chứng thực hiện được lưu ở Work Order.</small></div><button type="button" onClick={() => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] })}>+ Hạng mục</button></div>{draft.items.map((item, index) => <div className="maintenance-plan-item" key={index}><label><span>Hạng mục</span><input value={item.itemName} onChange={(event) => updateItem(index, { itemName: event.target.value })} placeholder="Kiểm tra hệ thống điện" /></label><label><span>Tiêu chuẩn</span><input value={item.standard} onChange={(event) => updateItem(index, { standard: event.target.value })} placeholder="Hoạt động bình thường" /></label><label><span>Phương pháp</span><input value={item.method} onChange={(event) => updateItem(index, { method: event.target.value })} placeholder="Vệ sinh và kiểm tra" /></label><button type="button" disabled={draft.items.length === 1} onClick={() => removeItem(index)}>Xóa</button></div>)}</div>
      <footer><button type="button" onClick={() => setDraft(null)}>Hủy</button><button className="maintenance-primary" type="submit" disabled={saving || !equipment.length}>{saving ? 'Đang lưu…' : 'Lưu kế hoạch PM'}</button></footer>
    </form></aside></div> : null}
  </section>
}
