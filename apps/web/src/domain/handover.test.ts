import { describe, expect, it } from 'vitest'
import { canReleaseEquipment } from './handover'

const baseHandover = {
  handoverId: 'HO-001',
  equipmentId: 'CEV-PRS-0003',
  handoverAt: '2026-08-28T03:00:00.000Z',
  fromPerson: 'maintenance-01',
  fromDepartment: 'Bảo trì',
  toPerson: 'production-01',
  toDepartment: 'Sản xuất',
  reason: 'Hoàn thành sửa chữa',
  condition: 'NORMAL' as const,
  accepted: true,
}

describe('BM-TBSX-05 handover release guard', () => {
  it('requires a handover before release', () => {
    expect(canReleaseEquipment(undefined).allowed).toBe(false)
  })

  it('blocks release when receiver has not accepted', () => {
    expect(canReleaseEquipment({ ...baseHandover, accepted: false }).allowed).toBe(false)
  })

  it('blocks release when equipment is not operable', () => {
    expect(canReleaseEquipment({ ...baseHandover, condition: 'NOT_OPERABLE' }).allowed).toBe(false)
  })

  it('allows release after accepted operable handover', () => {
    expect(canReleaseEquipment(baseHandover).allowed).toBe(true)
  })
})
