import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './Maintenance.css'
import './MaintenanceResult.css'
import { canCreateMaintenance, useAppRole } from './auth/AppRoleContext'
import { loadLiveMaintenance, type LiveMaintenancePlan, type LiveMaintenanceWorkOrder } from './data/liveMaintenance'
import { loadMaintenanceExecutionResults, recordMaintenanceResult, type MaintenanceExecutionResult, type MaintenanceResultInput } from './data/liveMaintenanceResult'

type DraftItem = MaintenanceResultInput['items'][number]
const roleLabel:Record<string,string>={MAINTENANCE:'Bảo trì',SUPERVISOR:'Giám sát',QUALITY:'Chất lượng',MANAGER:'Quản lý',ADMIN:'Quản trị hệ thống',UNKNOWN:'Chưa xác định'}
function today() { return new Date().toISOString().slice(0, 10) }

export function LiveMaintenanceResultPanel() {
  const role = useAppRole(); const canWrite = canCreateMaintenance(role)
  const [workOrders, setWorkOrders] = useState<LiveMaintenanceWorkOrder[]>([]); const [plans, setPlans] = useState<LiveMaintenancePlan[]>([]); const [results, setResults] = useState<MaintenanceExecutionResult[]>([])
  const [selectedWo, setSelectedWo] = useState(''); const [executionDate, setExecutionDate] = useState(today()); const [periodicFrequency, setPeriodicFrequency] = useState(''); const [inspectionDepartment, setInspectionDepartment] = useState('Bảo trì'); const [items, setItems] = useState<DraftItem[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('')

  const refresh = async () => { const [maintenance, execution] = await Promise.all([loadLiveMaintenance(), loadMaintenanceExecutionResults()]); setWorkOrders(maintenance.workOrders.filter((row) => row.status === 'IN_PROGRESS' || row.status === 'COMPLETED')); setPlans(maintenance.plans); setResults(execution) }
  useEffect(() => {
    let active = true
    void Promise.all([loadLiveMaintenance(), loadMaintenanceExecutionResults()])
      .then(([maintenance, execution]) => {
        if (!active) return
        setWorkOrders(maintenance.workOrders.filter((row) => row.status === 'IN_PROGRESS' || row.status === 'COMPLETED'))
        setPlans(maintenance.plans)
        setResults(execution)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải BM08') })
    return () => { active = false }
  }, [])
  const workOrder = useMemo(() => workOrders.find((row) => row.workOrderId === selectedWo) || null, [workOrders, selectedWo])
  const chooseWorkOrder = (workOrderId: string) => { setSelectedWo(workOrderId); setMessage(''); setError(''); const wo = workOrders.find((row) => row.workOrderId === workOrderId); const plan = wo ? plans.find((row) => row.equipmentId === wo.equipmentId && row.active) : undefined; setPeriodicFrequency(plan?.frequency || ''); setItems((plan?.items || []).map((item) => ({ itemName: item.itemName, resultMark: '○', repairContent: '', maintenanceContent: '', inspector: '' }))) }
  const updateItem = (index: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item))

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!canWrite || !selectedWo || !items.length) return
    setBusy(true); setError(''); setMessage('')
    try { const result = await recordMaintenanceResult({ workOrderId: selectedWo, executionDate, periodicFrequency, inspectionDepartment, items }); setMessage(`Đã ghi ${result.executionId} · ${result.itemCount} hạng mục · ${result.abnormalCount} bất thường`); setSelectedWo(''); setItems([]); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể ghi BM08') }
    finally { setBusy(false) }
  }

  return <section className="maintenance-surface" aria-labelledby="bm08-title">
    <header className="maintenance-header"><div><p className="eyebrow">BM-TBSX-08</p><h3 id="bm08-title">Kết quả bảo dưỡng & sửa chữa</h3><p>○ Tốt · △ Cảnh báo · × Sửa chữa — ghi theo từng hạng mục.</p></div>{canWrite ? <span className="maintenance-status status-approved">{workOrders.length} lệnh sẵn sàng</span> : <span className="maintenance-readonly">Chỉ xem · {roleLabel[role]||role}</span>}</header>
    {message ? <div className="maintenance-feedback" role="status">{message}</div> : null}{error ? <div className="maintenance-feedback error" role="alert">{error}</div> : null}
    {canWrite ? <form className="maintenance-create-form maintenance-result-form" onSubmit={submit}>
      <label className="wide"><span>Lệnh công việc</span><select value={selectedWo} onChange={(event) => chooseWorkOrder(event.target.value)}><option value="">Chọn lệnh đang xử lý / đã hoàn tất</option>{workOrders.map((row) => <option key={row.workOrderId} value={row.workOrderId}>{row.workOrderId} · {row.equipmentId} · {row.reason}</option>)}</select></label>
      {workOrder ? <><label><span>Ngày thực hiện</span><input type="date" value={executionDate} onChange={(event) => setExecutionDate(event.target.value)} required /></label><label><span>Định kỳ kiểm tra</span><input value={periodicFrequency} onChange={(event) => setPeriodicFrequency(event.target.value)} placeholder="3 tháng" /></label><label className="wide"><span>Bộ phận kiểm tra</span><input value={inspectionDepartment} onChange={(event) => setInspectionDepartment(event.target.value)} required /></label>
        <div className="wide maintenance-result-items">{items.length ? items.map((item, index) => <article key={`${item.itemName}-${index}`} className="maintenance-result-item"><div><b>{index + 1}. {item.itemName}</b><span>{workOrder.equipmentId}</span></div><label><span>Kết quả</span><select value={item.resultMark} onChange={(event) => updateItem(index, { resultMark: event.target.value as DraftItem['resultMark'] })}><option value="○">○ Tốt</option><option value="△">△ Cảnh báo</option><option value="×">× Sửa chữa</option></select></label><label><span>Nội dung sửa chữa</span><input value={item.repairContent} onChange={(event) => updateItem(index, { repairContent: event.target.value })} /></label><label><span>Bảo dưỡng</span><input value={item.maintenanceContent} onChange={(event) => updateItem(index, { maintenanceContent: event.target.value })} /></label><label><span>Người kiểm tra</span><input value={item.inspector} onChange={(event) => updateItem(index, { inspector: event.target.value })} /></label></article>) : <div className="maintenance-state">Thiết bị này chưa có hạng mục BM03. Hãy lập BM03 trước để ghi BM08 đúng nguồn.</div>}</div>
        <footer><button className="maintenance-primary" type="submit" disabled={busy || !items.length}>{busy ? 'Đang ghi…' : 'Ghi kết quả BM08'}</button></footer></> : null}
    </form> : null}
    {results.length ? <div className="maintenance-table-scroll"><table className="maintenance-table maintenance-result-table"><thead><tr><th>Mã kết quả</th><th>Lệnh công việc</th><th>Thiết bị</th><th>Ngày</th><th>Bộ phận</th><th>Hạng mục</th><th>Bất thường</th></tr></thead><tbody>{results.map((row) => <tr key={row.executionId}><td><b>{row.executionId}</b></td><td>{row.workOrderId}</td><td>{row.equipmentId}</td><td>{row.executionDate || '—'}</td><td>{row.inspectionDepartment || '—'}</td><td>{row.items.length}</td><td>{row.items.filter((item) => item.resultMark !== '○').length}</td></tr>)}</tbody></table></div> : <div className="maintenance-state">Chưa có kết quả BM08.</div>}
  </section>
}
