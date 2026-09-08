import { describe, expect, it } from 'vitest'
import { equipmentQrMatrix } from './EquipmentQr'

describe('equipmentQrMatrix', () => {
  it('creates a version-1 QR matrix for canonical equipment ids', () => {
    const matrix = equipmentQrMatrix('CEV-PR-061')
    expect(matrix).toHaveLength(21)
    expect(matrix.every((row) => row.length === 21)).toBe(true)
    expect(matrix[0].slice(0, 7)).toEqual([true, true, true, true, true, true, true])
    expect(matrix[1].slice(0, 7)).toEqual([true, false, false, false, false, false, true])
    expect(matrix[3].slice(0, 7)).toEqual([true, false, true, true, true, false, true])
  })

  it('is deterministic and changes when the encoded equipment id changes', () => {
    const first = equipmentQrMatrix('CEV-ME-001')
    expect(equipmentQrMatrix('CEV-ME-001')).toEqual(first)
    expect(equipmentQrMatrix('CEV-ME-002')).not.toEqual(first)
  })

  it('rejects values that do not fit the fixed printable equipment QR version', () => {
    expect(() => equipmentQrMatrix('THIS-EQUIPMENT-ID-IS-TOO-LONG')).toThrow('QR_VALUE_TOO_LONG')
  })
})
