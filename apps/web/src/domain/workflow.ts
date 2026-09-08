import type { DailyInspection } from './models'

export type InspectionEscalation = {
  createWorkOrder: boolean
  createDowntime: boolean
  stopEquipment: boolean
  priority?: 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export function getInspectionEscalation(mark: DailyInspection['overallMark']): InspectionEscalation {
  switch (mark) {
    case 'V':
      return { createWorkOrder: false, createDowntime: false, stopEquipment: false }
    case 'URGENT_REPAIR':
      return { createWorkOrder: true, createDowntime: false, stopEquipment: false, priority: 'HIGH' }
    case 'MAINTENANCE_REQUIRED':
      return { createWorkOrder: true, createDowntime: false, stopEquipment: false, priority: 'MEDIUM' }
    case 'STOP_REPAIR':
      return { createWorkOrder: true, createDowntime: true, stopEquipment: true, priority: 'CRITICAL' }
  }
}

export type MaintenanceWorkflowStatus =
  | 'OPEN'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'RELEASED'

export type MaintenanceWorkflowAction =
  | 'REQUEST_APPROVAL'
  | 'APPROVE'
  | 'START'
  | 'COMPLETE'
  | 'VERIFY'
  | 'RELEASE'

const TRANSITIONS: Record<MaintenanceWorkflowStatus, Partial<Record<MaintenanceWorkflowAction, MaintenanceWorkflowStatus>>> = {
  OPEN: { REQUEST_APPROVAL: 'WAITING_APPROVAL' },
  WAITING_APPROVAL: { APPROVE: 'APPROVED' },
  APPROVED: { START: 'IN_PROGRESS' },
  IN_PROGRESS: { COMPLETE: 'COMPLETED' },
  COMPLETED: { VERIFY: 'VERIFIED' },
  VERIFIED: { RELEASE: 'RELEASED' },
  RELEASED: {},
}

export function transitionMaintenanceStatus(
  status: MaintenanceWorkflowStatus,
  action: MaintenanceWorkflowAction,
): MaintenanceWorkflowStatus {
  const next = TRANSITIONS[status][action]
  if (!next) throw new Error(`Không thể thực hiện ${action} khi Work Order ở trạng thái ${status}`)
  return next
}
