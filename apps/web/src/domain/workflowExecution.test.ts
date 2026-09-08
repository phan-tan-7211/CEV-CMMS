import { describe, expect, it } from 'vitest'
import type { MaintenanceWorkOrder } from './models'
import { executeMaintenanceTransition } from './workflowExecution'

const baseWorkOrder: MaintenanceWorkOrder = {
  workOrderId: 'WO-TEST-01',
  equipmentId: 'EQ-01',
  sourceType: 'DAILY_INSPECTION',
  sourceId: 'DI-01',
  requestedAt: '2026-08-28T01:00:00.000Z',
  requestedBy: 'operator-01',
  reason: 'X / STOP_REPAIR',
  priority: 'CRITICAL',
  status: 'OPEN',
}

describe('executeMaintenanceTransition', () => {
  it('returns a new work order and audit event without mutating the input', () => {
    const result = executeMaintenanceTransition({
      workOrder: baseWorkOrder,
      action: 'REQUEST_APPROVAL',
      actorUserId: 'supervisor-01',
      actorRole: 'SUPERVISOR',
      now: '2026-08-28T02:00:00.000Z',
    })

    expect(baseWorkOrder.status).toBe('OPEN')
    expect(result.allowed).toBe(true)
    expect(result.workOrder.status).toBe('WAITING_APPROVAL')
    expect(result.auditEvents).toHaveLength(1)
    expect(result.auditEvents[0]).toMatchObject({
      userId: 'supervisor-01',
      action: 'REQUEST_APPROVAL',
      entityType: 'MAINTENANCE',
      entityId: 'WO-TEST-01',
      timestamp: '2026-08-28T02:00:00.000Z',
    })
  })

  it('creates BM-05 handover and two audit events on release', () => {
    const verifiedWorkOrder: MaintenanceWorkOrder = { ...baseWorkOrder, status: 'VERIFIED' }
    const result = executeMaintenanceTransition({
      workOrder: verifiedWorkOrder,
      action: 'RELEASE',
      actorUserId: 'supervisor-01',
      actorRole: 'SUPERVISOR',
      now: '2026-08-28T03:00:00.000Z',
    })

    expect(result.allowed).toBe(true)
    expect(result.workOrder.status).toBe('RELEASED')
    expect(result.handover).toMatchObject({
      handoverId: 'HO-WO-TEST-01',
      equipmentId: 'EQ-01',
      handoverAt: '2026-08-28T03:00:00.000Z',
      accepted: true,
      condition: 'NORMAL',
    })
    expect(result.auditEvents.map((event) => event.action)).toEqual(['ACCEPT_HANDOVER', 'RELEASE'])
  })

  it('blocks an operator from approving a work order', () => {
    const waitingWorkOrder: MaintenanceWorkOrder = { ...baseWorkOrder, status: 'WAITING_APPROVAL' }
    const result = executeMaintenanceTransition({
      workOrder: waitingWorkOrder,
      action: 'APPROVE',
      actorUserId: 'operator-02',
      actorRole: 'OPERATOR',
      now: '2026-08-28T03:30:00.000Z',
    })

    expect(result.allowed).toBe(false)
    expect(result.workOrder.status).toBe('WAITING_APPROVAL')
    expect(result.auditEvents).toHaveLength(0)
  })

  it('blocks requester self-approval even for an authorized role', () => {
    const waitingWorkOrder: MaintenanceWorkOrder = { ...baseWorkOrder, requestedBy: 'manager-01', status: 'WAITING_APPROVAL' }
    const result = executeMaintenanceTransition({
      workOrder: waitingWorkOrder,
      action: 'APPROVE',
      actorUserId: 'manager-01',
      actorRole: 'MANAGER',
      now: '2026-08-28T03:45:00.000Z',
    })

    expect(result.allowed).toBe(false)
    expect(result.workOrder.status).toBe('WAITING_APPROVAL')
    expect(result.message).toMatch(/không được tự phê duyệt/i)
  })
})
