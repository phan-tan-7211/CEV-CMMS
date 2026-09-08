import type { MaintenanceWorkflowStatus } from '../domain/workflow'
import type { MaintenanceAssigneeOption } from '../data/maintenanceAssignment'

export type WorkloadWorkOrder = {
  assignedPersonCode: string
  assignedPersonName: string
  status: MaintenanceWorkflowStatus
  priority: string
  plannedEndAt: string
}

export type MaintenanceWorkloadRow = {
  personCode: string
  displayName: string
  unitCode: string
  jobTitle: string
  openCount: number
  criticalHighCount: number
  overdueCount: number
  dueSoonCount: number
  inProgressCount: number
  nearestDueAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function dueTime(value: string) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export function buildMaintenanceWorkload(
  people: MaintenanceAssigneeOption[],
  workOrders: WorkloadWorkOrder[],
  now = Date.now(),
): MaintenanceWorkloadRow[] {
  const activeOrders = workOrders.filter((item) => item.status !== 'RELEASED' && item.assignedPersonCode)
  const knownPeople = new Map(people.map((person) => [person.personCode, person]))

  for (const item of activeOrders) {
    if (!knownPeople.has(item.assignedPersonCode)) {
      knownPeople.set(item.assignedPersonCode, {
        personCode: item.assignedPersonCode,
        displayName: item.assignedPersonName || item.assignedPersonCode,
        unitCode: '',
        jobTitle: '',
      })
    }
  }

  return [...knownPeople.values()].map((person) => {
    const assigned = activeOrders.filter((item) => item.assignedPersonCode === person.personCode)
    const dueTimes = assigned.map((item) => dueTime(item.plannedEndAt)).filter(Number.isFinite)
    return {
      personCode: person.personCode,
      displayName: person.displayName,
      unitCode: person.unitCode,
      jobTitle: person.jobTitle,
      openCount: assigned.length,
      criticalHighCount: assigned.filter((item) => item.priority === 'CRITICAL' || item.priority === 'HIGH').length,
      overdueCount: assigned.filter((item) => dueTime(item.plannedEndAt) < now).length,
      dueSoonCount: assigned.filter((item) => {
        const due = dueTime(item.plannedEndAt)
        return due >= now && due - now <= DAY_MS
      }).length,
      inProgressCount: assigned.filter((item) => item.status === 'IN_PROGRESS').length,
      nearestDueAt: dueTimes.length ? new Date(Math.min(...dueTimes)).toISOString() : '',
    }
  }).toSorted((left, right) => right.overdueCount - left.overdueCount
    || right.criticalHighCount - left.criticalHighCount
    || right.openCount - left.openCount
    || left.displayName.localeCompare(right.displayName, 'vi'))
}

export function countUnassignedOpen(workOrders: WorkloadWorkOrder[]) {
  return workOrders.filter((item) => item.status !== 'RELEASED' && !item.assignedPersonCode).length
}
