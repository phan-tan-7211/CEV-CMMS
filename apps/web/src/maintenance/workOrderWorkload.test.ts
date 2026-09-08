import { describe, expect, it } from 'vitest'
import { buildMaintenanceWorkload, countUnassignedOpen } from './workOrderWorkload'

const NOW = Date.parse('2026-09-07T08:00:00Z')

const people = [
  { personCode: 'P_AN', displayName: 'Mr.AN', unitCode: 'MFG', jobTitle: 'Leader' },
  { personCode: 'P_MAI', displayName: 'Ms.MAI', unitCode: 'COIL', jobTitle: 'Technician' },
]

const workOrders = [
  { assignedPersonCode: 'P_AN', assignedPersonName: 'Mr.AN', status: 'IN_PROGRESS' as const, priority: 'CRITICAL', plannedEndAt: '2026-09-07T07:00:00Z' },
  { assignedPersonCode: 'P_AN', assignedPersonName: 'Mr.AN', status: 'APPROVED' as const, priority: 'MEDIUM', plannedEndAt: '2026-09-07T18:00:00Z' },
  { assignedPersonCode: 'P_MAI', assignedPersonName: 'Ms.MAI', status: 'OPEN' as const, priority: 'HIGH', plannedEndAt: '2026-09-10T08:00:00Z' },
  { assignedPersonCode: '', assignedPersonName: '', status: 'OPEN' as const, priority: 'MEDIUM', plannedEndAt: '' },
  { assignedPersonCode: 'P_AN', assignedPersonName: 'Mr.AN', status: 'RELEASED' as const, priority: 'CRITICAL', plannedEndAt: '2026-09-01T08:00:00Z' },
]

describe('maintenance workload', () => {
  it('counts only active work orders and sorts urgent workloads first', () => {
    const rows = buildMaintenanceWorkload(people, workOrders, NOW)
    expect(rows[0]).toMatchObject({ personCode: 'P_AN', openCount: 2, criticalHighCount: 1, overdueCount: 1, dueSoonCount: 1, inProgressCount: 1 })
    expect(rows[1]).toMatchObject({ personCode: 'P_MAI', openCount: 1, criticalHighCount: 1, overdueCount: 0 })
  })

  it('keeps people with no assigned work visible for balancing', () => {
    const rows = buildMaintenanceWorkload([...people, { personCode: 'P_FREE', displayName: 'Free', unitCode: '', jobTitle: '' }], workOrders, NOW)
    expect(rows.find((item) => item.personCode === 'P_FREE')?.openCount).toBe(0)
  })

  it('counts unassigned open work without including released work', () => {
    expect(countUnassignedOpen(workOrders)).toBe(1)
  })
})
