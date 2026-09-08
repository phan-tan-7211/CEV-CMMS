import { describe, expect, it } from 'vitest'
import { appendAuditEvent, createAuditEvent } from './audit'

describe('audit event builder', () => {
  it('serializes before/after values for traceability', () => {
    const event = createAuditEvent({
      auditId: 'AUD-001',
      timestamp: '2026-08-28T03:10:00.000Z',
      userId: 'supervisor-01',
      action: 'APPROVE_WORK_ORDER',
      entityType: 'APPROVAL',
      entityId: 'WO-001',
      oldValue: { status: 'WAITING_APPROVAL' },
      newValue: { status: 'APPROVED' },
    })
    expect(JSON.parse(event.oldValueJson ?? '{}')).toEqual({ status: 'WAITING_APPROVAL' })
    expect(JSON.parse(event.newValueJson ?? '{}')).toEqual({ status: 'APPROVED' })
  })

  it('appends without mutating the existing array', () => {
    const original = [] as const
    const event = createAuditEvent({ auditId: 'AUD-002', timestamp: '2026-08-28T03:11:00.000Z', userId: 'u1', action: 'TEST', entityType: 'MAINTENANCE', entityId: 'WO-001' })
    const next = appendAuditEvent(original, event)
    expect(original).toHaveLength(0)
    expect(next).toHaveLength(1)
  })
})
