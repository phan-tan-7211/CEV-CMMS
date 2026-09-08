import { describe, expect, it } from 'vitest'
import { parseEquipmentIdFromQr } from './qrIndex'

describe('parseEquipmentIdFromQr', () => {
  it('accepts canonical raw equipment ids', () => {
    expect(parseEquipmentIdFromQr('CEV-PR-001')).toBe('CEV-PR-001')
    expect(parseEquipmentIdFromQr('cev-me-063')).toBe('CEV-ME-063')
  })

  it('extracts equipment id from a URL query', () => {
    expect(parseEquipmentIdFromQr('https://example.com/?equipment=CEV-PR-068')).toBe('CEV-PR-068')
  })

  it('extracts canonical ids from surrounding text or paths', () => {
    expect(parseEquipmentIdFromQr('equipment/CEV-ME-001/profile')).toBe('CEV-ME-001')
  })

  it('rejects non-equipment QR content', () => {
    expect(parseEquipmentIdFromQr('HELLO-123')).toBe('')
  })
})
