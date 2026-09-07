import { canTransitionMaintenance, type AppRole } from '../auth/AppRoleContext'
import type { MaintenanceWorkflowAction, MaintenanceWorkflowStatus } from '../domain/workflow'

export type MaintenanceQueueFilter = 'ACTION' | 'WORKING' | 'VERIFY' | 'DONE' | 'ALL'

export const MAINTENANCE_QUEUE_FILTERS: Array<{ id: MaintenanceQueueFilter; label: string }> = [
  { id: 'ACTION', label: 'Cần tôi xử lý' },
  { id: 'WORKING', label: 'Đang sửa' },
  { id: 'VERIFY', label: 'Chờ xác nhận' },
  { id: 'DONE', label: 'Đã bàn giao' },
  { id: 'ALL', label: 'Tất cả' },
]

export const NEXT_MAINTENANCE_ACTION: Partial<Record<MaintenanceWorkflowStatus, { action: MaintenanceWorkflowAction; label: string }>> = {
  OPEN: { action: 'REQUEST_APPROVAL', label: 'Gửi phê duyệt' },
  WAITING_APPROVAL: { action: 'APPROVE', label: 'Phê duyệt' },
  APPROVED: { action: 'START', label: 'Bắt đầu sửa chữa' },
  IN_PROGRESS: { action: 'COMPLETE', label: 'Hoàn tất sửa chữa' },
  COMPLETED: { action: 'VERIFY', label: 'Xác nhận chạy thử' },
  VERIFIED: { action: 'RELEASE', label: 'Bàn giao thiết bị' },
}

const GROUP_STATUSES: Record<Exclude<MaintenanceQueueFilter, 'ACTION' | 'ALL'>, MaintenanceWorkflowStatus[]> = {
  WORKING: ['IN_PROGRESS'],
  VERIFY: ['COMPLETED', 'VERIFIED'],
  DONE: ['RELEASED'],
}

export function workOrderQueueMatches(status: MaintenanceWorkflowStatus, queue: MaintenanceQueueFilter, role: AppRole) {
  if (queue === 'ALL') return true
  if (queue === 'ACTION') {
    const next = NEXT_MAINTENANCE_ACTION[status]
    return Boolean(next && canTransitionMaintenance(role, next.action))
  }
  return GROUP_STATUSES[queue].includes(status)
}

export function nextActionOwnerLabel(action: MaintenanceWorkflowAction) {
  if (action === 'REQUEST_APPROVAL' || action === 'START' || action === 'COMPLETE') return 'Bảo trì'
  if (action === 'VERIFY') return 'Chất lượng / Giám sát'
  return 'Giám sát / Quản lý'
}

export function getWorkOrderActionState(status: MaintenanceWorkflowStatus, role: AppRole) {
  const next = NEXT_MAINTENANCE_ACTION[status]
  if (!next) return { next: null, actionable: false, owner: 'Hoàn tất' }
  return {
    next,
    actionable: canTransitionMaintenance(role, next.action),
    owner: nextActionOwnerLabel(next.action),
  }
}
