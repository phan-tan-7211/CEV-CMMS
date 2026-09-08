export type EquipmentMasterTextFields = {
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  distributor?: string
  model: string
  serialNumber: string
  department: string
  managingDepartment: string
  managementResponsiblePrimary?: string
  managementResponsibleSecondary?: string
  currentArea: string
  currentLine: string
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
}

export type EquipmentMasterSuggestionKey =
  | 'equipmentName'
  | 'equipmentCategory'
  | 'manufacturer'
  | 'distributor'
  | 'model'
  | 'department'
  | 'managingDepartment'
  | 'managementResponsiblePrimary'
  | 'managementResponsibleSecondary'
  | 'currentArea'
  | 'currentLine'
  | 'technicalSpecification'
  | 'description'
  | 'accuracy'
  | 'origin'
  | 'warrantyContact'
  | 'note'
  | 'relatedDocuments'

export type EquipmentMasterSuggestionSource = Partial<EquipmentMasterTextFields>
export type EquipmentMasterSuggestions = Record<EquipmentMasterSuggestionKey, string[]>

export const EMPTY_MASTER_SUGGESTIONS: EquipmentMasterSuggestions = {
  equipmentName: [], equipmentCategory: [], manufacturer: [], distributor: [], model: [], department: [], managingDepartment: [],
  managementResponsiblePrimary: [], managementResponsibleSecondary: [], currentArea: [], currentLine: [],
  technicalSpecification: [], description: [], accuracy: [], origin: [], warrantyContact: [], note: [], relatedDocuments: [],
}

export function normalizeMasterText(value: string | undefined | null) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function comparable(value: string) {
  return normalizeMasterText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi-VN')
}

export function canonicalizeMasterValue(value: string | undefined, options: string[]) {
  const clean = normalizeMasterText(value)
  if (!clean) return ''
  const key = comparable(clean)
  return options.find((option) => comparable(option) === key) || clean
}

function unique(values: Array<string | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const clean = normalizeMasterText(raw)
    if (!clean) continue
    const key = comparable(clean)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(clean)
  }
  return result.toSorted((a, b) => a.localeCompare(b, 'vi'))
}

export function buildEquipmentMasterSuggestions(rows: EquipmentMasterSuggestionSource[]): EquipmentMasterSuggestions {
  const departments = unique(rows.flatMap((row) => [row.department, row.managingDepartment]))
  const responsibles = unique(rows.flatMap((row) => [row.managementResponsiblePrimary, row.managementResponsibleSecondary]))
  return {
    equipmentName: unique(rows.map((row) => row.equipmentName)),
    equipmentCategory: unique(rows.map((row) => row.equipmentCategory)),
    manufacturer: unique(rows.map((row) => row.manufacturer)),
    distributor: unique(rows.map((row) => row.distributor)),
    model: unique(rows.map((row) => row.model)),
    department: departments,
    managingDepartment: departments,
    managementResponsiblePrimary: responsibles,
    managementResponsibleSecondary: responsibles,
    currentArea: unique(rows.map((row) => row.currentArea)),
    currentLine: unique(rows.map((row) => row.currentLine)),
    technicalSpecification: unique(rows.map((row) => row.technicalSpecification)),
    description: unique(rows.map((row) => row.description)),
    accuracy: unique(rows.map((row) => row.accuracy)),
    origin: unique(rows.map((row) => row.origin)),
    warrantyContact: unique(rows.map((row) => row.warrantyContact)),
    note: unique(rows.map((row) => row.note)),
    relatedDocuments: unique(rows.map((row) => row.relatedDocuments)),
  }
}
