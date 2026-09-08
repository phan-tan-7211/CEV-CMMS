import { createContext, useContext, type ReactNode } from 'react'

export type AppRole = 'MAINTENANCE' | 'SUPERVISOR' | 'QUALITY' | 'MANAGER' | 'ADMIN' | 'UNKNOWN'

const RoleContext = createContext<AppRole>('UNKNOWN')

export function AppRoleProvider({ role, children }: { role: AppRole; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useAppRole() {
  return useContext(RoleContext)
}

export function canViewAudit(role: AppRole) {
  return role === 'ADMIN'
}

export function canEditEquipment(role: AppRole) {
  return role === 'ADMIN'
}

export function canManageEquipmentPhoto(role: AppRole) {
  return ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(role)
}

export function canSubmitInspection(role: AppRole) {
  return ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(role)
}

export function canCreateMaintenance(role: AppRole) {
  return ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role)
}

export function canTransitionMaintenance(role: AppRole, action: string) {
  if (action === 'APPROVE' || action === 'RELEASE') return ['SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role)
  if (action === 'VERIFY') return ['SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(role)
  if (action === 'REQUEST_APPROVAL' || action === 'START' || action === 'COMPLETE') return ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role)
  return false
}

export function canCreateToolingMaster(role: AppRole) {
  return ['MANAGER', 'ADMIN'].includes(role)
}

export function canCreateToolingPlan(role: AppRole) {
  return ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role)
}

export function canCreateToolingModification(role: AppRole) {
  return ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(role)
}

export function canTransitionTooling(role: AppRole, action: string) {
  if (action === 'QA_CONFIRM') return ['QUALITY', 'MANAGER', 'ADMIN'].includes(role)
  if (action === 'APPROVE' || action === 'COMPLETE') return ['MANAGER', 'ADMIN'].includes(role)
  return false
}

export function canRecordCalibration(role: AppRole) {
  return ['QUALITY', 'MANAGER', 'ADMIN'].includes(role)
}
