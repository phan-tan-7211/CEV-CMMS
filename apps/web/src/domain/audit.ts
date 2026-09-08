import type { AuditLog } from './models'

export type AuditEventInput = Omit<AuditLog, 'auditId' | 'timestamp' | 'oldValueJson' | 'newValueJson'> & {
  auditId?: string
  timestamp?: string
  oldValue?: unknown
  newValue?: unknown
}

export function createAuditEvent(input: AuditEventInput): AuditLog {
  const timestamp = input.timestamp ?? new Date().toISOString()
  const auditId = input.auditId ?? `AUD-${timestamp}-${input.entityType}-${input.entityId}`

  return {
    auditId,
    timestamp,
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    oldValueJson: input.oldValue === undefined ? undefined : JSON.stringify(input.oldValue),
    newValueJson: input.newValue === undefined ? undefined : JSON.stringify(input.newValue),
  }
}

export function appendAuditEvent(logs: readonly AuditLog[], event: AuditLog): AuditLog[] {
  return [...logs, event]
}
