import { describe, expect, it } from 'vitest'
import { canApproveWorkOrder, canRolePerform, canVerifyMaintenance } from './governance'

describe('approval and RBAC policy', () => {
  it('prevents the requester from approving their own work order', () => {
    expect(canApproveWorkOrder({ requesterId: 'user-1', approverId: 'user-1', approverRole: 'MANAGER' })).toBe(false)
  })

  it('allows a separate supervisor to approve a work order', () => {
    expect(canApproveWorkOrder({ requesterId: 'user-1', approverId: 'user-2', approverRole: 'SUPERVISOR' })).toBe(true)
  })

  it('requires an independent qualified verifier for test run confirmation', () => {
    expect(canVerifyMaintenance({ performedBy: 'tech-1', verifierId: 'tech-1', verifierRole: 'QUALITY' })).toBe(false)
    expect(canVerifyMaintenance({ performedBy: 'tech-1', verifierId: 'qa-1', verifierRole: 'QUALITY' })).toBe(true)
  })

  it('limits tooling quality confirmation and disposal decisions', () => {
    expect(canRolePerform('MAINTENANCE', 'CONFIRM_TOOLING_CHANGE')).toBe(false)
    expect(canRolePerform('QUALITY', 'CONFIRM_TOOLING_CHANGE')).toBe(true)
    expect(canRolePerform('SUPERVISOR', 'DISPOSE_EQUIPMENT')).toBe(false)
    expect(canRolePerform('MANAGER', 'DISPOSE_EQUIPMENT')).toBe(true)
  })
})
