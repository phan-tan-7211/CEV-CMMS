import { describe, expect, it } from 'vitest'
import { classifyWorkOrder } from './workOrderClassification'

describe('classifyWorkOrder', () => {
  it('classifies PM as preventive', () => {
    expect(classifyWorkOrder({ sourceType: 'PM' })).toEqual({ sourceFamily: 'PREVENTIVE_PLAN', kind: 'PREVENTIVE' })
  })

  it('classifies inspection-generated work distinctly', () => {
    expect(classifyWorkOrder({ sourceType: 'DAILY_INSPECTION' })).toEqual({ sourceFamily: 'INSPECTION', kind: 'INSPECTION_GENERATED' })
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
