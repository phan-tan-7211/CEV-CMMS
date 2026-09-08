import { dataGateway } from './dataGateway'

export type OrgUnit = {
  unitCode: string
  unitName: string
  unitType: string
  parentUnitCode: string
}

export type OrgPerson = {
  personCode: string
  displayName: string
  unitCode: string
  jobTitle: string
}

export type OrgLocation = {
  locationCode: string
  locationName: string
  locationType: 'AREA' | 'LINE'
  unitCode: string
}

export type OrgResolvedAssignment = {
  equipmentId: string
  primaryRoleCode: string
  primaryRoleName: string
  primaryPersonCode: string
  primaryPersonName: string
  secondaryPersonCode: string
  secondaryPersonName: string
  managingUnitCode: string
  managingUnitName: string
  usingUnitCode: string
  usingUnitName: string
  areaCode: string
  areaName: string
  lineCode: string
  lineName: string
}

export type OrgMasterSnapshot = {
  units: OrgUnit[]
  people: OrgPerson[]
  locations: OrgLocation[]
  resolvedAssignments: OrgResolvedAssignment[]
}

export type OrgAutocompleteContext = {
  managingDepartment?: string
}

let cache: OrgMasterSnapshot | null = null
let inFlight: Promise<OrgMasterSnapshot> | null = null

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).toSorted((a, b) => a.localeCompare(b, 'vi'))
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('vi')
}

function unitCodesForName(unitName: string) {
  if (!cache || !unitName.trim()) return new Set<string>()
  const target = normalized(unitName)
  const roots = cache.units.filter((unit) => normalized(unit.unitName) === target).map((unit) => unit.unitCode)
  const codes = new Set(roots)
  let changed = true
  while (changed) {
    changed = false
    for (const unit of cache.units) {
      if (unit.parentUnitCode && codes.has(unit.parentUnitCode) && !codes.has(unit.unitCode)) {
        codes.add(unit.unitCode)
        changed = true
      }
    }
  }
  return codes
}

export function getOrgMasterSnapshot() {
  return cache
}

export function getOrgAutocompleteOptions(columnKey: string, context: OrgAutocompleteContext = {}) {
  if (!cache) return []
  if (columnKey === 'managingDepartment') {
    return unique(cache.units.filter((unit) => !['COMPANY', 'TEAM'].includes(unit.unitType)).map((unit) => unit.unitName))
  }
  if (columnKey === 'managementResponsiblePrimary') {
    const allowedCodes = unitCodesForName(context.managingDepartment || '')
    const people = allowedCodes.size ? cache.people.filter((person) => allowedCodes.has(person.unitCode)) : cache.people
    return unique(people.map((person) => person.displayName))
  }
  if (columnKey === 'managementResponsibleSecondary') {
    return unique(cache.people.map((person) => person.displayName))
  }
  if (columnKey === 'currentArea' || columnKey === 'currentLine') {
    const type = columnKey === 'currentLine' ? 'LINE' : 'AREA'
    return unique(cache.locations.filter((location) => location.locationType === type).map((location) => location.locationName))
  }
  return []
}

export async function loadOrgMaster(options: { force?: boolean } = {}) {
  if (!options.force && cache) return cache
  if (!options.force && inFlight) return inFlight

  inFlight = (async () => {
    const [unitsResult, peopleResult, locationsResult, resolvedResult] = await Promise.all([
      dataGateway.readRows('org_units', { columns: 'unit_code,unit_name,unit_type,parent_unit_code', eq: [{ column: 'active', value: true }], order: { column: 'sort_order' } }),
      dataGateway.readRows('org_people', { columns: 'person_code,display_name,unit_code,job_title', eq: [{ column: 'active', value: true }], order: { column: 'display_name' } }),
      dataGateway.readRows('org_locations', { columns: 'location_code,location_name,location_type,unit_code', eq: [{ column: 'active', value: true }], order: { column: 'sort_order' } }),
      dataGateway.readRows('equipment_org_resolved'),
    ])

    const firstError = unitsResult.error || peopleResult.error || locationsResult.error || resolvedResult.error
    if (firstError) throw firstError

    cache = {
      units: unitsResult.data.map((row) => ({
        unitCode: text(row.unit_code),
        unitName: text(row.unit_name),
        unitType: text(row.unit_type),
        parentUnitCode: text(row.parent_unit_code),
      })),
      people: peopleResult.data.map((row) => ({
        personCode: text(row.person_code),
        displayName: text(row.display_name),
        unitCode: text(row.unit_code),
        jobTitle: text(row.job_title),
      })),
      locations: locationsResult.data.map((row) => ({
        locationCode: text(row.location_code),
        locationName: text(row.location_name),
        locationType: text(row.location_type) === 'LINE' ? 'LINE' : 'AREA',
        unitCode: text(row.unit_code),
      })),
      resolvedAssignments: resolvedResult.data.map((row) => ({
        equipmentId: text(row.equipment_id),
        primaryRoleCode: text(row.primary_role_code),
        primaryRoleName: text(row.primary_role_name),
        primaryPersonCode: text(row.primary_person_code),
        primaryPersonName: text(row.primary_person_name),
        secondaryPersonCode: text(row.secondary_person_code),
        secondaryPersonName: text(row.secondary_person_name),
        managingUnitCode: text(row.managing_unit_code),
        managingUnitName: text(row.managing_unit_name),
        usingUnitCode: text(row.using_unit_code),
        usingUnitName: text(row.using_unit_name),
        areaCode: text(row.area_code),
        areaName: text(row.area_name),
        lineCode: text(row.line_code),
        lineName: text(row.line_name),
      })),
    }
    return cache
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}
