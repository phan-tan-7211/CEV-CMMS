import { readClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'
import type { EquipmentCriticalityFacts } from './autoRegistration'
import { loadOrgMaster, type OrgResolvedAssignment } from './orgMaster'

export type LiveEquipment = {
  equipmentId: string
  equipmentName: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentCategory: string
  manufacturer: string
  distributor?: string
  model: string
  serialNumber: string
  currentArea: string
  currentLine: string
  managingDepartment: string
  managementResponsiblePrimary?: string
  managementResponsibleSecondary?: string
  defaultLabelSize?: 'tiny' | 'standard' | 'large'
  usingDepartment: string
  technicalSpecification: string
  description: string
  accuracy: string
  origin: string
  manufactureDate: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  relatedDocuments: string
  status: string
  criticality: string
  criticalityFacts?: EquipmentCriticalityFacts
  qrCode: string
  active: boolean
  updatedAt: string
}

const EQUIPMENT_CACHE_KEY = 'cev:data:equipment-master'
const EQUIPMENT_CACHE_VERSION = 1

function text(value: unknown) { return value === null || value === undefined ? '' : String(value).trim() }
function bool(value: unknown) { return typeof value === 'boolean' ? value : ['TRUE', '1', 'YES'].includes(text(value).toUpperCase()) }
function sourceText(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return ''
  return text((source as Record<string, unknown>)[key])
}
function sourceObject(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return {} as Record<string, unknown>
  const value = (source as Record<string, unknown>)[key]
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
function sourceBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'boolean' ? value : undefined
}
function labelSize(value: string): LiveEquipment['defaultLabelSize'] {
  return value === 'tiny' || value === 'large' ? value : value === 'standard' ? value : undefined
}

export function normalizeEquipmentRow(row: Record<string, unknown>): LiveEquipment | null {
  const equipmentId = text(row.equipment_id ?? row.equipmentId)
  const equipmentType = text(row.equipment_type ?? row.equipmentType).toUpperCase()
  if (!equipmentId || !['PRODUCTION', 'MEASUREMENT'].includes(equipmentType)) return null
  const source = row.source_data ?? row.sourceData
  const criticalityFacts = sourceObject(source, 'criticalityFacts')
  return {
    equipmentId,
    equipmentName: text(row.equipment_name ?? row.equipmentName) || equipmentId,
    equipmentType: equipmentType as LiveEquipment['equipmentType'],
    equipmentCategory: text(row.equipmentCategory) || sourceText(source, 'equipmentCategory'),
    manufacturer: text(row.manufacturer),
    distributor: text(row.distributor) || sourceText(source, 'distributor'),
    model: text(row.model),
    serialNumber: text(row.serial_number ?? row.serialNumber),
    currentArea: text(row.currentArea) || sourceText(source, 'currentArea'),
    currentLine: text(row.currentLine) || sourceText(source, 'currentLine'),
    managingDepartment: text(row.managingDepartment) || sourceText(source, 'managingDepartment'),
    managementResponsiblePrimary: text(row.managementResponsiblePrimary) || sourceText(source, 'managementResponsiblePrimary'),
    managementResponsibleSecondary: text(row.managementResponsibleSecondary) || sourceText(source, 'managementResponsibleSecondary'),
    defaultLabelSize: labelSize(text(row.defaultLabelSize) || sourceText(source, 'defaultLabelSize')),
    usingDepartment: text(row.department ?? row.usingDepartment) || sourceText(source, 'usingDepartment'),
    technicalSpecification: text(row.technicalSpecification) || sourceText(source, 'technicalSpecification'),
    description: sourceText(source, 'description'),
    accuracy: sourceText(source, 'accuracy'),
    origin: sourceText(source, 'origin') || sourceText(source, 'countryOfOrigin'),
    manufactureDate: sourceText(source, 'manufactureDate'),
    inServiceDate: sourceText(source, 'inServiceDate'),
    warrantyUntil: sourceText(source, 'warrantyUntil'),
    warrantyContact: sourceText(source, 'warrantyContact'),
    note: sourceText(source, 'note'),
    relatedDocuments: sourceText(source, 'relatedDocuments'),
    status: text(row.status) || 'RUNNING',
    criticality: text(row.criticality) || sourceText(source, 'criticality'),
    criticalityFacts: {
      controlsProductQuality: sourceBoolean(criticalityFacts, 'controlsProductQuality'),
      specialCharacteristicImpact: sourceBoolean(criticalityFacts, 'specialCharacteristicImpact'),
      stopsProduction: sourceBoolean(criticalityFacts, 'stopsProduction'),
      hasBackup: sourceBoolean(criticalityFacts, 'hasBackup'),
      capacityImpact: sourceBoolean(criticalityFacts, 'capacityImpact'),
    },
    qrCode: text(row.qr_code ?? row.qrCode) || equipmentId,
    active: row.active === undefined ? true : bool(row.active),
    updatedAt: text(row.updated_at ?? row.updatedAt),
  }
}

function overlayOrgAssignment(row: LiveEquipment, assignment?: OrgResolvedAssignment): LiveEquipment {
  if (!assignment) return row
  return {
    ...row,
    managementResponsiblePrimary: assignment.primaryPersonName || row.managementResponsiblePrimary,
    managementResponsibleSecondary: assignment.secondaryPersonName || row.managementResponsibleSecondary,
    managingDepartment: assignment.managingUnitName || row.managingDepartment,
    usingDepartment: assignment.usingUnitName || row.usingDepartment,
    currentArea: assignment.areaName || row.currentArea,
    currentLine: assignment.lineName || row.currentLine,
  }
}

export async function loadLiveEquipment(options: { force?: boolean } = {}) {
  const cached = !options.force ? readClientCache<LiveEquipment[]>(EQUIPMENT_CACHE_KEY, EQUIPMENT_CACHE_VERSION) : null

  const [org, equipmentResult] = await Promise.all([
    loadOrgMaster({ force: Boolean(options.force) }).catch(() => null),
    cached?.data?.length
      ? Promise.resolve({ data: cached.data as unknown as Array<Record<string, unknown>>, error: null })
      : dataGateway.readRows('equipment_master', { order: { column: 'equipment_id' } }),
  ])

  if (equipmentResult.error) throw equipmentResult.error
  const rows = (equipmentResult.data || []).map((row) => {
    if ('equipmentId' in row) return row as unknown as LiveEquipment
    return normalizeEquipmentRow(row)
  }).filter((row): row is LiveEquipment => Boolean(row))

  if (!org) return rows
  const assignmentByEquipment = new Map(org.resolvedAssignments.map((assignment) => [assignment.equipmentId, assignment]))
  return rows.map((row) => overlayOrgAssignment(row, assignmentByEquipment.get(row.equipmentId)))
}
