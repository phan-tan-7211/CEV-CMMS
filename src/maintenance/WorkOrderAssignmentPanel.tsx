import { useEffect, useMemo, useState } from 'react'
import { useAppRole } from '../auth/AppRoleContext'
import {
  assignMaintenanceWorkOrder,
  loadMaintenanceAssignees,
  loadMaintenanceAssignment,
  type MaintenanceAssigneeOption,
  type MaintenanceAssignmentState,
} from '../data/maintenanceAssignment'
import './WorkOrderAssignmentPanel.css'

const EMPTY: MaintenanceAssignmentState = {
  workOrderId: '',
  assignedPersonCode: '',
  assignedPersonName: '',
  assignedBy: '',
  assignedAt: '',
}

function operationId(workOrderId: string) {
  return `assign-${workOrderId}-${crypto.randomUUID()}`
}

function dateTime(value: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
}

export function WorkOrderAssignmentPanel({ workOrderId }: { workOrderId: string }) {
  const role = useAppRole()
  const canAssign = role === 'SUPERVISOR' || role === 'MANAGER' || role === 'ADMIN'
  const [people, setPeople] = useState<MaintenanceAssigneeOption[]>([])
  const [assignment, setAssignment] = useState<MaintenanceAssignmentState>(EMPTY)
  const [selectedPerson, setSelectedPerson] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadMaintenanceAssignees(), loadMaintenanceAssignment(workOrderId)])
      .then(([nextPeople, nextAssignment]) => {
        if (!active) return
        setPeople(nextPeople)
        setAssignment(nextAssignment)
        setSelectedPerson(nextAssignment.assignedPersonCode)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải người phụ trách')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workOrderId])

  const selected = useMemo(() => people.find((item) => item.personCode === selectedPerson) || null, [people, selectedPerson])
  const changed = selectedPerson !== assignment.assignedPersonCode

  async function save() {
    if (!canAssign || !changed) return
    setSaving(true); setError(''); setMessage('')
    try {
      const next = await assignMaintenanceWorkOrder({
        workOrderId,
        personCode: selectedPerson,
        operationId: operationId(workOrderId),
      })
      setAssignment(next)
      setSelectedPerson(next.assignedPersonCode)
      setMessage(next.assignedPersonCode ? `Đã giao ${workOrderId} cho ${next.assignedPersonName || next.assignedPersonCode}.` : `Đã bỏ người phụ trách của ${workOrderId}.`)
    } catch (cause: unknown) {
      const raw = cause instanceof Error ? cause.message : 'Không thể cập nhật người phụ trách'
      setError(raw.replace('WORK_ORDER_ASSIGN_ROLE_DENIED', 'Bạn không có quyền giao việc.').replace('ACTIVE_ORG_PERSON_NOT_FOUND', 'Nhân sự đã chọn không còn hoạt động.').replace('WORK_ORDER_ALREADY_RELEASED', 'Lệnh đã bàn giao, không thể đổi người phụ trách.'))
    } finally { setSaving(false) }
  }

  return <section className="wo-assignment" aria-labelledby={`wo-assignment-${workOrderId}`}>
    <header>
      <div><span>Trách nhiệm xử lý</span><h3 id={`wo-assignment-${workOrderId}`}>Người phụ trách Work Order</h3><p>Chọn từ master nhân sự để tên người xử lý luôn thống nhất trong toàn hệ thống.</p></div>
      <strong className={assignment.assignedPersonCode ? 'assigned' : 'unassigned'}>{assignment.assignedPersonCode ? 'Đã giao' : 'Chưa giao'}</strong>
    </header>

    {loading ? <p className="wo-assignment-state">Đang tải người phụ trách…</p> : <div className="wo-assignment-body">
      <div className="wo-assignment-current">
        <span>Hiện tại</span>
        <strong>{assignment.assignedPersonName || assignment.assignedPersonCode || 'Chưa có người phụ trách'}</strong>
        {assignment.assignedPersonCode ? <small>{assignment.assignedPersonCode}{assignment.assignedAt ? ` · giao lúc ${dateTime(assignment.assignedAt)}` : ''}{assignment.assignedBy ? ` · bởi ${assignment.assignedBy}` : ''}</small> : <small>Supervisor / Manager / Admin có thể giao người xử lý.</small>}
      </div>

      {canAssign ? <div className="wo-assignment-editor">
        <label><span>Giao cho</span><select value={selectedPerson} onChange={(event) => setSelectedPerson(event.target.value)} disabled={saving}><option value="">— Chưa giao / bỏ giao việc —</option>{people.map((person) => <option key={person.personCode} value={person.personCode}>{person.displayName} · {person.personCode}{person.jobTitle ? ` · ${person.jobTitle}` : ''}</option>)}</select></label>
        {selected ? <p>{selected.jobTitle || 'Nhân sự'}{selected.unitCode ? ` · ${selected.unitCode}` : ''}</p> : null}
        <button type="button" onClick={() => void save()} disabled={saving || !changed}>{saving ? 'Đang lưu…' : 'Lưu người phụ trách'}</button>
      </div> : <div className="wo-assignment-readonly">Vai trò hiện tại chỉ xem thông tin phân công.</div>}
    </div>}

    {message ? <div className="wo-assignment-message success" role="status">{message}</div> : null}
    {error ? <div className="wo-assignment-message error" role="alert">{error}</div> : null}
  </section>
}
