import { describe, expect, it } from 'vitest'
import { EVIDENCE_FOLDERS, PERSISTENCE_TABLES } from './persistenceContract'

describe('Gate G1 persistence contract', () => {
  it('includes source-driven calibration cost and handover records', () => {
    expect(PERSISTENCE_TABLES).toContain('Equipment_Handover')
    expect(PERSISTENCE_TABLES).toContain('Calibration_Master')
    expect(PERSISTENCE_TABLES).toContain('Calibration_Vendor_Quote')
    expect(PERSISTENCE_TABLES).toContain('Calibration_Quote_Summary')
    expect(PERSISTENCE_TABLES).toContain('Audit_Log')
  })

  it('keeps file evidence outside structured tables', () => {
    expect(EVIDENCE_FOLDERS).toContain('calibration-certificates')
    expect(EVIDENCE_FOLDERS).toContain('maintenance-before-after')
    expect(EVIDENCE_FOLDERS).toContain('handover-records')
  })
})
