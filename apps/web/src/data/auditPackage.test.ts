import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), fetchRows: vi.fn() }))
vi.mock('./supabaseClient', () => ({ supabase: { auth: {getSession:mocks.getSession}, from:mocks.from } }))
vi.mock('./sourceRows', () => ({fetchSourceRows:mocks.fetchRows}))
import { buildAuditPackage } from './auditPackage'
beforeEach(() => vi.clearAllMocks())
it('requires an authenticated session before collecting data', async () => {
 mocks.getSession.mockResolvedValue({data:{session:null},error:null})
 await expect(buildAuditPackage()).rejects.toThrow('AUTH_REQUIRED')
 expect(mocks.fetchRows).not.toHaveBeenCalled()
})
it('rejects a non-ADMIN even when called outside the UI', async () => {
 mocks.getSession.mockResolvedValue({data:{session:{user:{id:'user'}}},error:null})
 const query={select:()=>query,eq:()=>query,maybeSingle:()=>Promise.resolve({data:{role:'QUALITY'},error:null})}
 mocks.from.mockReturnValue(query)
 await expect(buildAuditPackage()).rejects.toThrow('AUDIT_EXPORT_ADMIN_ONLY')
 expect(mocks.fetchRows).not.toHaveBeenCalled()
})
