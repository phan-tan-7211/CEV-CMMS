import { describe, expect, it } from 'vitest'
import { CalibrationEvaluationSchema, CalibrationMasterSchema, getCalibrationDueStatus } from './calibration'

describe('calibration domain', () => {
  it('accepts a source-aligned calibration master record without a control number', () => {
    const parsed = CalibrationMasterSchema.parse({
      calibrationEquipmentId: 'CAL-HP50-001',
      department: 'QC',
      category: 'Digital Torque Meter',
      instrumentName: 'Digital Torque Meter HP-50',
      localName: 'Máy kiểm tra lực siết',
      operationalStatus: 'OK',
      model: 'HP-50',
      manufacturer: 'HIOS',
      purpose: 'Kiểm tra lực siết',
      lastCalibrationDate: '2024-06-28',
      nextDueDate: '2025-06-28',
      active: true,
    })

    expect(parsed.controlNumber).toBeUndefined()
    expect(parsed.instrumentName).toBe('Digital Torque Meter HP-50')
  })

  it('derives overdue, due-soon, valid and no-plan states', () => {
    expect(getCalibrationDueStatus('2025-06-28', '2026-08-28')).toBe('OVERDUE')
    expect(getCalibrationDueStatus('2026-09-10', '2026-08-28')).toBe('DUE_SOON')
    expect(getCalibrationDueStatus('2027-06-28', '2026-08-28')).toBe('VALID')
    expect(getCalibrationDueStatus(undefined, '2026-08-28')).toBe('NO_PLAN')
  })

  it('accepts a passed post-calibration evaluation without a mandatory note', () => {
    const parsed = CalibrationEvaluationSchema.parse({
      calibrationId: 'CAL-LOG-001',
      equipmentId: 'CEV-TB-113',
      calibrationResult: 'PASS',
      evaluationResult: 'PASS',
      evaluatedBy: 'quality@example.com',
      evaluatedAt: '2026-08-29T05:00:00.000Z',
    })

    expect(parsed.evaluationResult).toBe('PASS')
  })

  it('requires an evaluation note for limited-use and failed evaluations', () => {
    const base = {
      calibrationId: 'CAL-LOG-002',
      equipmentId: 'CEV-TB-114',
      calibrationResult: 'FAIL' as const,
      evaluatedBy: 'quality@example.com',
      evaluatedAt: '2026-08-29T05:00:00.000Z',
    }

    expect(CalibrationEvaluationSchema.safeParse({ ...base, evaluationResult: 'LIMITED_USE' }).success).toBe(false)
    expect(CalibrationEvaluationSchema.safeParse({ ...base, evaluationResult: 'FAIL' }).success).toBe(false)
    expect(
      CalibrationEvaluationSchema.safeParse({
        ...base,
        evaluationResult: 'LIMITED_USE',
        evaluationNote: 'Chỉ sử dụng trong phạm vi đã được xác nhận.',
      }).success,
    ).toBe(true)
  })
})
