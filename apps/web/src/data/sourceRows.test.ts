import { describe, expect, it, vi } from 'vitest'
const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabaseClient', () => ({ supabase: { from } }))
import { fetchSourceRows } from './sourceRows'

describe('source keyset pagination', () => {
  it('continues after a short server-capped page until empty', async () => {
    const cursors: unknown[] = []
    const pages = [[{equipment_id:'CEV-PR-001'}], [{equipment_id:'CEV-PR-002'}], []]
    from.mockImplementation(() => {
      const q = Object.assign(Promise.resolve({data: pages.shift(), error:null}), { select: () => q, order: () => q, limit: () => q,
        gt: (_: string, id: string) => { cursors.push(id); return q } })
      return q
    })
    expect(await fetchSourceRows('equipment_master')).toHaveLength(2)
    expect(cursors).toEqual(['CEV-PR-001','CEV-PR-002'])
  })
  it('fails closed on inaccessible rows', async () => {
    const q = { select: () => q, order: () => q, limit: () => Promise.resolve({data:null,error:{message:'permission denied'}}) }
    from.mockReturnValue(q)
    await expect(fetchSourceRows('equipment_master')).rejects.toThrow('permission denied')
  })
})
