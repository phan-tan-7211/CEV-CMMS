import { useMemo, useState, type FormEvent } from 'react'
import { canCreateMaintenance, useAppRole } from './auth/AppRoleContext'
import { upsertMaintenancePlan, type LiveMaintenancePlan, type MaintenanceEquipmentOption, type MaintenancePlanInput } from './data/liveMaintenance'

type Props = { equipment: MaintenanceEquipmentOption[]; plans: LiveMaintenancePlan[]; onSaved: () => Promise<void> }
type DraftItem = { itemName: string; standard: string; method: string; note: string }
const EMPTY_ITEM: DraftItem = { itemName: '', standard: '', method: '', note: '' }
const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}
const statusLabel:Record<string,string>={OVERDUE:'Quá hạn',DUE:'Đến hạn',PLANNED:'Đã lập kế hoạch',COMPLETED:'Đã hoàn tất',ACTIVE:'Đang áp dụng'}
const maintenanceTypeLabel:Record<string,string>={PM:'Bảo dưỡng phòng ngừa',PdM:'Bảo dưỡng dự đoán',CM:'Bảo dưỡng khắc phục'}

function newDraft(equipmentId: string): MaintenancePlanInput { return { equipmentId, maintenanceType: 'PM', frequency: 'Hàng tháng', plannedDate: '', responsiblePerson: '', scheduledWindow: '', note: '', active: true, items: [{ ...EMPTY_ITEM }] } }
function fromPlan(plan: LiveMaintenancePlan): MaintenancePlanInput { return { planId: plan.planId, equipmentId: plan.equipmentId, maintenanceType: plan.maintenanceType || 'PM', frequency: plan.frequency || '', plannedDate: plan.plannedDate, responsiblePerson: plan.responsiblePerson, scheduledWindow: plan.scheduledWindow, note: plan.note, active: plan.active, items: plan.items.length ? plan.items.map((item) => ({ itemName: item.itemName, standard: item.standard, method: item.method, note: item.note })) : [{ ...EMPTY_ITEM }] } }

export function MaintenancePlanSection({ equipment, plans, onSaved }: Props) {
  const role = useAppRole(); const canWrite = canCreateMaintenance(role)
  const [draft, setDraft] = useState<MaintenancePlanInput | null>(null); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const equipmentName = useMemo(() => new Map(equipment.map((item) => [item.equipmentId, item.equipmentName])), [equipment])
  const openNew = () => { setDraft(newDraft(equipment[0]?.equipmentId || '')); setMessage(''); setError('') }
  const updateItem = (index: number, patch: Partial<DraftItem>) => setDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current)
  const removeItem = (index: number) => setDraft((current) => current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!draft || !canWrite) return
    if (!draft.equipmentId || !draft.maintenanceType.trim() || !draft.frequency.trim()) return
    if (!draft.items.some((item) => item.itemName.trim())) return setError('BM03 cần ít nhất 1 hạng mục bảo dưỡng.')
    setSaving(true); setError(''); setMessage('')
    try { const result = await upsertMaintenancePlan({ ...draft, items: draft.items.filter((item) => item.itemName.trim()) }); setMessage(`Đã lưu ${result.planId} · ${result.itemCount} hạng mục`); setDraft(null); await onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu BM03') }
    finally { setSaving(false) }
  }

  return <section className="maintenance-surface maintenance-pm" aria-labelledby="pm-title">
    <header className="maintenance-header"><div><p className="eyebrow">BM-TBSX-03</p><h3 id="pm-title">Kế hoạch bảo dưỡng máy</h3><p>Thiết bị · loại bảo dưỡng · tần suất · lịch dự kiến · người thực hiện · hạng mục / tiêu chuẩn / phương pháp.</p></div>{canWrite ? <button className="maintenance-primary" type="button" onClick={openNew}>+ Tạo kế hoạch BM03</button> : <span className="maintenance-readonly">Chỉ xem · {roleLabel[role]||role}</span>}</header>
    {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}{error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}
    {plans.length ? <div className="maintenance-table-scroll"><table className="maintenance-table maintenance-plan-table"><thead><tr><th>Mã kế hoạch</th><th>Thiết bị</th><th>Loại / tần suất</th><th>Thời gian dự kiến</th><th>Người thực hiện</th><th>Hạng mục</th><th /></tr></thead><tbody>{plans.map((plan) => <tr key={plan.planId}><td><b>{plan.planId}</b><small>{statusLabel[plan.status]||plan.status}</small></td><td><b>{plan.equipmentId}</b><small>{equipmentName.get(plan.equipmentId) || '—'}</small></td><td>{maintenanceTypeLabel[plan.maintenanceType]||plan.maintenanceType||'Bảo dưỡng phòng ngừa'}<small>{plan.frequency || '—'}</small></td><td>{plan.plannedDate || plan.scheduledWindow || '—'}<small>{plan.scheduledWindow || ''}</small></td><td>{plan.responsiblePerson || '—'}</td><td><b>{plan.items.length}</b><small>{plan.items.slice(0, 2).map((item) => item.itemName).join(' · ') || '—'}</small></td><td>{canWrite ? <button className="maintenance-row-action" type="button" onClick={() => setDraft(fromPlan(plan))}>Sửa</button> : null}</td></tr>)}</tbody></table></div> : <div className="maintenance-state">Chưa có BM03. Mỗi thiết bị sản xuất cần được lập kế hoạch bảo dưỡng phù hợp.</div>}
    {draft && canWrite ? <div className="maintenance-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}><aside className="maintenance-drawer maintenance-plan-drawer" role="dialog" aria-modal="true" aria-labelledby="bm03-editor-title"><header><div><p className="eyebrow">CEV-BM-TBSX-03</p><h2 id="bm03-editor-title">{draft.planId ? `Sửa ${draft.planId}` : 'Lập kế hoạch bảo dưỡng'}</h2></div><button type="button" aria-label="Đóng" onClick={() => setDraft(null)}>×</button></header><form className="maintenance-create-form" onSubmit={submit}>
      <label><span>Thiết bị</span><select value={draft.equipmentId} onChange={(event) => setDraft({ ...draft, equipmentId: event.target.value })}>{equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentId} · {item.equipmentName}</option>)}</select></label>
      <label><span>Loại bảo dưỡng</span><select value={draft.maintenanceType} onChange={(event) => setDraft({ ...draft, maintenanceType: event.target.value })}><option value="PM">Bảo dưỡng phòng ngừa</option><option value="PdM">Bảo dưỡng dự đoán</option><option value="CM">Bảo dưỡng khắc phục</option></select></label>
      <label><span>Tần suất</span><input value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value })} placeholder="Hàng tháng / 3 tháng một lần" required /></label>
      <label><span>Ngày/kỳ dự kiến</span><input value={draft.plannedDate} onChange={(event) => setDraft({ ...draft, plannedDate: event.target.value })} placeholder="2026-09-12 hoặc Tháng 3, 6, 9, 12" /></label>
      <label><span>Người thực hiện</span><input value={draft.responsiblePerson} onChange={(event) => setDraft({ ...draft, responsiblePerson: event.target.value })} placeholder="Nhân viên bảo trì" /></label>
      <label><span>Khung thời gian</span><input value={draft.scheduledWindow} onChange={(event) => setDraft({ ...draft, scheduledWindow: event.target.value })} placeholder="Thứ 7 tuần 2" /></label>
      <label className="wide"><span>Ghi chú kế hoạch</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} rows={2} /></label>
      <div className="wide maintenance-plan-items"><div className="maintenance-plan-items-head"><div><b>Hạng mục chi tiết</b><small>BM03: Hạng mục / Tiêu chuẩn / Phương pháp</small></div><button type="button" onClick={() => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] })}>+ Hạng mục</button></div>{draft.items.map((item, index) => <div className="maintenance-plan-item" key={index}><label><span>Hạng mục</span><input value={item.itemName} onChange={(event) => updateItem(index, { itemName: event.target.value })} placeholder="Kiểm tra hệ thống điện" /></label><label><span>Tiêu chuẩn</span><input value={item.standard} onChange={(event) => updateItem(index, { standard: event.target.value })} placeholder="Hoạt động bình thường" /></label><label><span>Phương pháp</span><input value={item.method} onChange={(event) => updateItem(index, { method: event.target.value })} placeholder="Vệ sinh và kiểm tra" /></label><button type="button" disabled={draft.items.length === 1} onClick={() => removeItem(index)}>Xóa</button></div>)}</div>
      <footer><button type="button" onClick={() => setDraft(null)}>Hủy</button><button className="maintenance-primary" type="submit" disabled={saving || !equipment.length}>{saving ? 'Đang lưu…' : 'Lưu BM03'}</button></footer>
    </form></aside></div> : null}
  </section>
}
