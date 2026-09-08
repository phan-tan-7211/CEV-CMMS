import { dataGateway } from './dataGateway'

export type LiveSession = { email: string; role: string; contractVersion: string }
export type LiveAudit = { auditId: string; timestamp: string; userId: string; action: string; entityType: string; entityId: string; oldValueJson: string; newValueJson: string }

const SESSION_FRESH_MS = 30_000
const AUDIT_FRESH_MS = 30_000
let sessionCache: { savedAt: number; data: LiveSession } | null = null
let auditCache: { savedAt: number; data: LiveAudit[] } | null = null
let sessionPromise: Promise<LiveSession> | null = null
let auditPromise: Promise<LiveAudit[]> | null = null

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export async function loadLiveSession(options: { force?: boolean } = {}): Promise<LiveSession> {
  if (!options.force && sessionCache && Date.now() - sessionCache.savedAt <= SESSION_FRESH_MS) return sessionCache.data
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    const { data: user, error: sessionError } = await dataGateway.getSessionUser()
    if (sessionError) throw sessionError
    if (!user) throw new Error('Chưa đăng nhập Supabase')
    const { data: roleData, error: roleError } = await dataGateway.readOne('app_user_role', {
      columns: 'role,email',
      eq: [{ column: 'user_id', value: user.id }],
      required: true,
    })
    if (roleError) throw roleError
    const result = { email: text(roleData?.email) || user.email, role: text(roleData?.role), contractVersion: 'G1-frozen-2026-08-28' }
    sessionCache = { savedAt: Date.now(), data: result }
    return result
  })().finally(() => { sessionPromise = null })

  return sessionPromise
}

export async function loadLiveAudit(options: { force?: boolean } = {}): Promise<LiveAudit[]> {
  if (!options.force && auditCache && Date.now() - auditCache.savedAt <= AUDIT_FRESH_MS) return auditCache.data
  if (auditPromise) return auditPromise

  auditPromise = (async () => {
    const { data, error } = await dataGateway.readRows('audit_log', {
      order: { column: 'created_at', ascending: false },
      limit: 200,
    })
    if (error) {
      if (auditCache) return auditCache.data
      throw error
    }
    const rows = data.map((row) => {
      const detail = (row.detail as Record<string, unknown> | null) || {}
      return {
        auditId: text(row.audit_id), timestamp: text(row.created_at), userId: text(row.actor_email), action: text(row.action), entityType: text(row.entity_type), entityId: text(row.entity_id), oldValueJson: JSON.stringify(detail.before ?? ''), newValueJson: JSON.stringify(detail.after ?? detail),
      }
    }).filter((row) => row.auditId)
    auditCache = { savedAt: Date.now(), data: rows }
    return rows
  })().finally(() => { auditPromise = null })

  return auditPromise
}
