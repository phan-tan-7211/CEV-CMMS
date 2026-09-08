import { describe, expect, it } from 'vitest'
import {
  canCreateMaintenance,
  canCreateToolingMaster,
  canCreateToolingModification,
  canCreateToolingPlan,
  canEditEquipment,
  canRecordCalibration,
  canSubmitInspection,
  canTransitionMaintenance,
  canTransitionTooling,
  canViewAudit,
} from './AppRoleContext'

describe('app role permission matrix', () => {
  it('keeps audit and equipment master edit admin-only', () => {
    expect(canViewAudit('ADMIN')).toBe(true)
    expect(canViewAudit('MANAGER')).toBe(false)
    expect(canEditEquipment('ADMIN')).toBe(true)
    expect(canEditEquipment('MANAGER')).toBe(false)
  })

  it('mirrors inspection and calibration RPC roles', () => {
    for (const role of ['MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN'] as const) expect(canSubmitInspection(role)).toBe(true)
    expect(canSubmitInspection('UNKNOWN')).toBe(false)
    expect(canRecordCalibration('QUALITY')).toBe(true)
    expect(canRecordCalibration('MANAGER')).toBe(true)
    expect(canRecordCalibration('ADMIN')).toBe(true)
    expect(canRecordCalibration('MAINTENANCE')).toBe(false)
  })

  it('mirrors maintenance transition separation of duties', () => {
    expect(canCreateMaintenance('MAINTENANCE')).toBe(true)
    expect(canCreateMaintenance('QUALITY')).toBe(false)
    expect(canTransitionMaintenance('MAINTENANCE','APPROVE')).toBe(false)
    expect(canTransitionMaintenance('SUPERVISOR','APPROVE')).toBe(true)
    expect(canTransitionMaintenance('QUALITY','VERIFY')).toBe(true)
    expect(canTransitionMaintenance('QUALITY','RELEASE')).toBe(false)
  })

  it('mirrors tooling create and approval roles', () => {
    expect(canCreateToolingMaster('MANAGER')).toBe(true)
    expect(canCreateToolingMaster('SUPERVISOR')).toBe(false)
    expect(canCreateToolingPlan('MAINTENANCE')).toBe(true)
    expect(canCreateToolingModification('QUALITY')).toBe(true)
    expect(canTransitionTooling('QUALITY','QA_CONFIRM')).toBe(true)
    expect(canTransitionTooling('QUALITY','APPROVE')).toBe(false)
    expect(canTransitionTooling('MANAGER','COMPLETE')).toBe(true)
  })
})
