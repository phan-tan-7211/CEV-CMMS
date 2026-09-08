import { describe, expect, it } from 'vitest'
import { deriveEquipmentCriticality } from './autoRegistration'

describe('deriveEquipmentCriticality CEV-ABCD-V2', () => {
  const base = {
    controlsProductQuality: false,
    specialCharacteristicImpact: false,
    stopsProduction: false,
    hasBackup: true,
    capacityImpact: false,
  }

  it('returns empty until all five facts are answered', () => {
    expect(deriveEquipmentCriticality({ stopsProduction: true })).toBe('')
  })

  it('classifies special characteristic or product safety equipment as A', () => {
    expect(deriveEquipmentCriticality({ ...base, specialCharacteristicImpact: true })).toBe('A')
  })

  it('classifies direct quality equipment without backup as A', () => {
    expect(deriveEquipmentCriticality({ ...base, controlsProductQuality: true, hasBackup: false })).toBe('A')
  })

  it('classifies line-stopping equipment without backup as A', () => {
    expect(deriveEquipmentCriticality({ ...base, stopsProduction: true, hasBackup: false })).toBe('A')
  })

  it('classifies capacity-critical equipment without backup as A', () => {
    expect(deriveEquipmentCriticality({ ...base, capacityImpact: true, hasBackup: false })).toBe('A')
  })

  it('classifies direct quality equipment with backup as B', () => {
    expect(deriveEquipmentCriticality({ ...base, controlsProductQuality: true })).toBe('B')
  })

  it('classifies production-critical equipment with backup as B', () => {
    expect(deriveEquipmentCriticality({ ...base, stopsProduction: true })).toBe('B')
  })

  it('classifies low direct impact but no backup as C', () => {
    expect(deriveEquipmentCriticality({ ...base, hasBackup: false })).toBe('C')
  })

  it('classifies low-impact equipment with backup as D', () => {
    expect(deriveEquipmentCriticality(base)).toBe('D')
  })
})
