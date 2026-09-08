import { describe, expect, it } from 'vitest'
import { getWorkOrderActionState, workOrderQueueMatches } from './workOrderQueue'

describe('maintenance work-order queue', () => {
  it('shows maintenance technicians only statuses they can advance in the action queue', () => {
    expect(workOrderQueueMatches('OPEN', 'ACTION', 'MAINTENANCE')).toBe(true)
    expect(workOrderQueueMatches('WAITING_APPROVAL', 'ACTION', 'MAINTENANCE')).toBe(false)
    expect(workOrderQueueMatches('APPROVED', 'ACTION', 'MAINTENANCE')).toBe(true)
    expect(workOrderQueueMatches('IN_PROGRESS', 'ACTION', 'MAINTENANCE')).toBe(true)
    expect(workOrderQueueMatches('COMPLETED', 'ACTION', 'MAINTENANCE')).toBe(false)
  })

  it('routes quality users to verification work instead of approval or repair', () => {
    expect(workOrderQueueMatches('WAITING_APPROVAL', 'ACTION', 'QUALITY')).toBe(false)
    expect(workOrderQueueMatches('IN_PROGRESS', 'ACTION', 'QUALITY')).toBe(false)
    expect(workOrderQueueMatches('COMPLETED', 'ACTION', 'QUALITY')).toBe(true)
    expect(workOrderQueueMatches('VERIFIED', 'ACTION', 'QUALITY')).toBe(false)
  })

  it('lets supervisors act throughout the workflow until release', () => {
    for (const status of ['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'] as const) {
      expect(workOrderQueueMatches(status, 'ACTION', 'SUPERVISOR')).toBe(true)
    }
    expect(workOrderQueueMatches('RELEASED', 'ACTION', 'SUPERVISOR')).toBe(false)
  })

  it('keeps operational grouping independent of the current role', () => {
    expect(workOrderQueueMatches('IN_PROGRESS', 'WORKING', 'QUALITY')).toBe(true)
    expect(workOrderQueueMatches('COMPLETED', 'VERIFY', 'MAINTENANCE')).toBe(true)
    expect(workOrderQueueMatches('VERIFIED', 'VERIFY', 'MAINTENANCE')).toBe(true)
    expect(workOrderQueueMatches('RELEASED', 'DONE', 'MAINTENANCE')).toBe(true)
  })

  it('describes who owns the next action when the current role cannot perform it', () => {
    expect(getWorkOrderActionState('WAITING_APPROVAL', 'MAINTENANCE')).toEqual({
      next: { action: 'APPROVE', label: 'Phê duyệt' },
      actionable: false,
      owner: 'Giám sát / Quản lý',
    })
    expect(getWorkOrderActionState('COMPLETED', 'QUALITY').actionable).toBe(true)
    expect(getWorkOrderActionState('RELEASED', 'QUALITY')).toEqual({ next: null, actionable: false, owner: 'Hoàn tất' })
  })
})
