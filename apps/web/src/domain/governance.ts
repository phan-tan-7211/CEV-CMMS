import type { MaintenanceWorkflowAction } from './workflow'

export type SystemRole = 'OPERATOR' | 'MAINTENANCE' | 'SUPERVISOR' | 'QUALITY' | 'MANAGER' | 'ADMIN'

export type GovernedAction =
  | 'REQUEST_WORK_ORDER_APPROVAL'
  | 'APPROVE_WORK_ORDER'
  | 'EXECUTE_MAINTENANCE'
  | 'VERIFY_TEST_RUN'
  | 'RELEASE_EQUIPMENT'
  | 'CONFIRM_TOOLING_CHANGE'
  | 'DISPOSE_EQUIPMENT'

const ACTION_ROLES: Record<GovernedAction, readonly SystemRole[]> = {
  REQUEST_WORK_ORDER_APPROVAL: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  APPROVE_WORK_ORDER: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
  EXECUTE_MAINTENANCE: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  VERIFY_TEST_RUN: ['QUALITY', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  RELEASE_EQUIPMENT: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
  CONFIRM_TOOLING_CHANGE: ['QUALITY', 'MANAGER', 'ADMIN'],
  DISPOSE_EQUIPMENT: ['MANAGER', 'ADMIN'],
}

const WORKFLOW_ACTION_POLICY: Record<MaintenanceWorkflowAction, GovernedAction> = {
  REQUEST_APPROVAL: 'REQUEST_WORK_ORDER_APPROVAL',
  APPROVE: 'APPROVE_WORK_ORDER',
  START: 'EXECUTE_MAINTENANCE',
  COMPLETE: 'EXECUTE_MAINTENANCE',
  VERIFY: 'VERIFY_TEST_RUN',
  RELEASE: 'RELEASE_EQUIPMENT',
}

export function governedActionForWorkflowAction(action: MaintenanceWorkflowAction): GovernedAction {
  return WORKFLOW_ACTION_POLICY[action]
}

export function canRolePerform(role: SystemRole, action: GovernedAction): boolean {
  return ACTION_ROLES[action].includes(role)
}

export function canApproveWorkOrder(input: {
  requesterId: string
  approverId: string
  approverRole: SystemRole
}): boolean {
  if (input.requesterId === input.approverId) return false
  return canRolePerform(input.approverRole, 'APPROVE_WORK_ORDER')
}

export function canVerifyMaintenance(input: {
  performedBy: string
  verifierId: string
  verifierRole: SystemRole
}): boolean {
  if (input.performedBy === input.verifierId) return false
  return canRolePerform(input.verifierRole, 'VERIFY_TEST_RUN')
}
