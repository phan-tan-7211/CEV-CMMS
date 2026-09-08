import type { EquipmentListItem } from '../api/equipmentService'

export const NO_ASSIGNEES_FILTER_VALUE = '__NO_ASSIGNEES__'

export type EquipmentFilter = {
  name: string
  model: string
  barcode: string
  area: string
  category: string
  archived: boolean
  unarchived: boolean
  createdByYou: boolean
  locations: string[]
  primaryUsers: string[]
  assignedUsers: string[]
  assignedTeams: string[]
  assignedVendors: string[]
  assignedCustomers: string[]
  createdStart: string
  createdEnd: string
}

export const EMPTY_EQUIPMENT_FILTER: EquipmentFilter = {
  name: '',
  model: '',
  barcode: '',
  area: '',
  category: '',
  archived: false,
  unarchived: false,
  createdByYou: false,
  locations: [],
  primaryUsers: [],
  assignedUsers: [],
  assignedTeams: [],
  assignedVendors: [],
  assignedCustomers: [],
  createdStart: '',
  createdEnd: '',
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi')
}

function includesText(value: string, needle: string) {
  const normalizedNeedle = normalize(needle)
  return !normalizedNeedle || normalize(value).includes(normalizedNeedle)
}

function intersects(selected: string[], values: string[]) {
  if (selected.length === 0) return true
  const normalized = new Set(values.map(normalize).filter(Boolean))
  return selected.some((value) => normalized.has(normalize(value)))
}

function equipmentLocation(item: EquipmentListItem) {
  return [item.area, item.line].filter(Boolean).join(' · ')
}

function dateOnly(value: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export function hasEquipmentFilter(filter: EquipmentFilter) {
  return Boolean(
    filter.name.trim() || filter.model.trim() || filter.barcode.trim() || filter.area.trim() || filter.category.trim()
      || filter.archived || filter.unarchived || filter.createdByYou || filter.locations.length || filter.primaryUsers.length
      || filter.assignedUsers.length || filter.assignedTeams.length || filter.assignedVendors.length || filter.assignedCustomers.length
      || filter.createdStart || filter.createdEnd,
  )
}

export function applyEquipmentFilter(items: EquipmentListItem[], filter: EquipmentFilter, currentUserKeys: string[] = []) {
  const currentUserSet = new Set(currentUserKeys.map(normalize).filter(Boolean))

  return items.filter((item) => {
    if (!includesText(item.equipmentName, filter.name)) return false
    if (!includesText(item.model, filter.model)) return false
    if (!includesText(item.equipmentId, filter.barcode)) return false
    if (!includesText(item.area, filter.area)) return false
    if (!includesText(item.category, filter.category)) return false

    if (!filter.archived && !filter.unarchived && item.archived) return false
    if (filter.archived && !filter.unarchived && !item.archived) return false
    if (filter.unarchived && !filter.archived && item.archived) return false

    if (filter.createdByYou) {
      const createdBy = normalize(item.createdBy || '')
      if (!createdBy || !currentUserSet.has(createdBy)) return false
    }

    if (!intersects(filter.locations, [equipmentLocation(item)])) return false
    if (!intersects(filter.primaryUsers, [item.responsiblePrimary || ''])) return false

    if (filter.assignedUsers.length) {
      const wantsNoAssignees = filter.assignedUsers.includes(NO_ASSIGNEES_FILTER_VALUE)
      const namedUsers = filter.assignedUsers.filter((value) => value !== NO_ASSIGNEES_FILTER_VALUE)
      const currentUsers = item.assignedUsers || []
      const matchesNamed = namedUsers.length > 0 && intersects(namedUsers, currentUsers)
      const matchesEmpty = wantsNoAssignees && currentUsers.length === 0
      if (!matchesNamed && !matchesEmpty) return false
    }

    if (!intersects(filter.assignedTeams, item.assignedTeams || [])) return false
    if (!intersects(filter.assignedVendors, item.assignedVendors || [])) return false
    if (!intersects(filter.assignedCustomers, item.assignedCustomers || [])) return false

    const createdAt = dateOnly(item.createdAt || '')
    if (filter.createdStart && (!createdAt || createdAt < filter.createdStart)) return false
    if (filter.createdEnd && (!createdAt || createdAt > filter.createdEnd)) return false

    return true
  })
}

export function uniqueEquipmentFilterValues(items: EquipmentListItem[]) {
  const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }))

  return {
    locations: unique(items.map(equipmentLocation)),
    primaryUsers: unique(items.map((item) => item.responsiblePrimary || '')),
    assignedUsers: unique(items.flatMap((item) => item.assignedUsers || [])),
    assignedTeams: unique(items.flatMap((item) => item.assignedTeams || [])),
    assignedVendors: unique(items.flatMap((item) => item.assignedVendors || [])),
    assignedCustomers: unique(items.flatMap((item) => item.assignedCustomers || [])),
  }
}
