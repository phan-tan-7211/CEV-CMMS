import { describe, expect, it } from 'vitest'
import { CORE_SHEET_NAMES, DailyInspectionSchema, EquipmentSchema, MaintenanceLogSchema } from './models'
import { PERSISTENCE_TABLES } from './persistenceContract'

describe('equipment domain schemas', () => {
  it('uses the G1 persistence contract as the source-derived table list', () => {
    expect(CORE_SHEET_NAMES).toBe(PERSISTENCE_TABLES)
    expect(CORE_SHEET_NAMES).toContain('Equipment_Master')
    expect(CORE_SHEET_NAMES).toContain('Daily_Inspection')
    expect(CORE_SHEET_NAMES).toContain('Maintenance_Plan')
    expect(CORE_SHEET_NAMES).toContain('Maintenance_Execution')
    expect(CORE_SHEET_NAMES).toContain('Equipment_Handover')
    expect(CORE_SHEET_NAMES).toContain('Downtime_Event')
    expect(CORE_SHEET_NAMES).toContain('Tooling_Master')
    expect(CORE_SHEET_NAMES).toContain('Tooling_Modification')
    expect(CORE_SHEET_NAMES).toContain('Calibration_Master')
    expect(CORE_SHEET_NAMES).toContain('Calibration_Vendor_Quote')
    expect(CORE_SHEET_NAMES).toContain('Calibration_Quote_Summary')
    expect(CORE_SHEET_NAMES).toContain('Audit_Log')
  })

  it('accepts a valid production equipment record aligned with BM-TBSX-01/02', () => {
    const parsed = EquipmentSchema.parse({
      equipmentId: 'CNC-01',
      equipmentName: 'CNC Milling Machine',
      equipmentType: 'PRODUCTION',
      manufacturer: 'Makino',
      model: 'V56',
      serialNumber: 'SN-001',
      currentArea: 'Machining',
      currentLine: 'Line 1',
      managingDepartment: 'Maintenance',
      usingDepartment: 'Production',
      maintenanceCycleMonths: 3,
      status: 'RUNNING',
      criticality: 'A',
      qrCode: 'CNC-01',
      active: true,
      updatedAt: '2026-08-28T01:00:00.000Z',
    })
    expect(parsed.equipmentId).toBe('CNC-01')
    expect(parsed.maintenanceCycleMonths).toBe(3)
  })

  it('accepts the BM-KTTBHN stop-and-repair mark', () => {
    const parsed = DailyInspectionSchema.parse({
      inspectionId: 'DI-001',
      equipmentId: 'CNC-01',
      inspectionDate: '2026-08-28',
      inspectorId: 'leader-01',
      overallMark: 'STOP_REPAIR',
      createdAt: '2026-08-28T01:00:00.000Z',
    })
    expect(parsed.overallMark).toBe('STOP_REPAIR')
  })

  it('does not allow negative downtime', () => {
    const result = MaintenanceLogSchema.safeParse({
      maintenanceId: 'M-001',
      equipmentId: 'CNC-01',
      maintenanceType: 'CM',
      reportedAt: '2026-08-28T01:00:00.000Z',
      issueDescription: 'Servo alarm',
      status: 'COMPLETED',
      downtimeMinutes: -1,
      createdBy: 'technician-01',
    })
    expect(result.success).toBe(false)
  })
})
