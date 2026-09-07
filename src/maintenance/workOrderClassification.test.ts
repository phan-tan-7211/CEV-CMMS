import { describe, expect, it } from 'vitest'
import { classifyWorkOrder, normalizeWorkOrderSourceFamily, WORK_ORDER_SOURCE_TYPE } from './workOrderClassification'

describe('work order source mapping', () => {
  it('exposes canonical source values for new Web writes', () => {
    expect(WORK_ORDER_SOURCE_TYPE).toEqual({
      MANUAL: 'MANUAL',
      INSPECTION: 'DAILY_INSPECTION',
      PREVENTIVE_PLAN: 'PREVENTIVE_PLAN',
      REQUEST: 'REQUEST',
      EQUIPMENT_PROFILE: 'EQUIPMENT_PROFILE',
      LEGACY_IMPORT: 'LEGACY_IMPORT',
    })
  })

  it('normalizes canonical and legacy aliases without rewriting stored source values', () => {
    expect(normalizeWorkOrderSourceFamily('DAILY_INSPECTION')).toBe('INSPECTION')
    expect(normalizeWorkOrderSourceFamily('INSPECTION')).toBe('INSPECTION')
    expect(normalizeWorkOrderSourceFamily('PREVENTIVE_PLAN')).toBe('PREVENTIVE_PLAN')
    expect(normalizeWorkOrderSourceFamily('PM')).toBe('PREVENTIVE_PLAN')
    expect(normalizeWorkOrderSourceFamily('EQUIPMENT_PROFILE')).toBe('EQUIPMENT_PROFILE')
    expect(normalizeWorkOrderSourceFamily('QR_PROFILE')).toBe('EQUIPMENT_PROFILE')
    expect(normalizeWorkOrderSourceFamily('OTHER')).toBe('UNKNOWN')
  })
})

describe('classifyWorkOrder', () => {
  it('classifies preventive source aliases as preventive', () => {
    expect(classifyWorkOrder({ sourceType: 'PREVENTIVE_PLAN' })).toEqual({ sourceFamily: 'PREVENTIVE_PLAN', kind: 'PREVENTIVE' })
    expect(classifyWorkOrder({ sourceType: 'PM' })).toEqual({ sourceFamily: 'PREVENTIVE_PLAN', kind: 'PREVENTIVE' })
  })

  it('classifies inspection-generated work distinctly', () => {
    expect(classifyWorkOrder({ sourceType: 'DAILY_INSPECTION' })).toEqual({ sourceFamily: 'INSPECTION', kind: 'INSPECTION_GENERATED' })
  })

  it('keeps equipment-profile aliases as manual work', () => {
    expect(classifyWorkOrder({ sourceType: 'EQUIPMENT_PROFILE' })).toEqual({ sourceFamily: 'EQUIPMENT_PROFILE', kind: 'MANUAL' })
    expect(classifyWorkOrder({ sourceType: 'QR_PROFILE' })).toEqual({ sourceFamily: 'EQUIPMENT_PROFILE', kind: 'MANUAL' })
  })

  it('uses legacy plan classification without rewriting source', () => {
    expect(classifyWorkOrder({ sourceType: 'LEGACY_IMPORT', planClassification: 'UNPLANNED' })).toEqual({ sourceFamily: 'LEGACY_IMPORT', kind: 'CORRECTIVE' })
    expect(classifyWorkOrder({ sourceType: 'LEGACY_IMPORT', planClassification: 'PLANNED' })).toEqual({ sourceFamily: 'LEGACY_IMPORT', kind: 'PREVENTIVE' })
  })

  it('only calls a work order breakdown when stop/downtime evidence exists', () => {
    expect(classifyWorkOrder({ sourceType: 'LEGACY_IMPORT', planClassification: 'UNPLANNED', hasDowntime: true })).toEqual({ sourceFamily: 'LEGACY_IMPORT', kind: 'BREAKDOWN' })
    expect(classifyWorkOrder({ sourceType: 'MANUAL', equipmentStopped: true })).toEqual({ sourceFamily: 'MANUAL', kind: 'BREAKDOWN' })
  })

  it('keeps unknown data unknown instead of guessing', () => {
    expect(classifyWorkOrder({ sourceType: 'LEGACY_IMPORT' })).toEqual({ sourceFamily: 'LEGACY_IMPORT', kind: 'UNKNOWN' })
    expect(classifyWorkOrder({ sourceType: 'OTHER' })).toEqual({ sourceFamily: 'UNKNOWN', kind: 'UNKNOWN' })
  })
})
