import { supabase } from '../../../supabase'

export type EquipmentSuggestionKey =
  | 'equipmentName'
  | 'equipmentCategory'
  | 'model'
  | 'manufacturer'
  | 'distributor'
  | 'managingDepartment'
  | 'currentArea'
  | 'currentLine'
  | 'managementResponsiblePrimary'
  | 'managementResponsibleSecondary'
  | 'origin'

export type EquipmentSuggestionMap = Record<EquipmentSuggestionKey, string[]>

export const EMPTY_EQUIPMENT_SUGGESTIONS: EquipmentSuggestionMap = {
  equipmentName: [],
  equipmentCategory: [],
  model: [],
  manufacturer: [],
  distributor: [],
  managingDepartment: [],
  currentArea: [],
  currentLine: [],
  managementResponsiblePrimary: [],
  managementResponsibleSecondary: [],
  origin: [],
}

type EquipmentSuggestionRow = {
  equipment_name: string | null
  model: string | null
  manufacturer: string | null
  source_data: Record<string, unknown> | null
}

type Candidate = {
  value: string
  count: number
  firstSeen: number
}

type CandidateGroup = Map<string, Map<string, Candidate>>

export function cleanEquipmentText(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function equipmentMatchKey(value: string) {
  return cleanEquipmentText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
}

export function canonicalizeEquipmentValue(value: string, suggestions: string[]) {
  const cleaned = cleanEquipmentText(value)
  if (!cleaned) return ''
  const key = equipmentMatchKey(cleaned)
  return suggestions.find((option) => equipmentMatchKey(option) === key) || cleaned
}

function readSourceText(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && cleanEquipmentText(value)) return value
  }
  return ''
}

function addCandidate(groups: CandidateGroup, rawValue: unknown, index: number) {
  if (typeof rawValue !== 'string') return
  const value = cleanEquipmentText(rawValue)
  if (!value) return

  const matchKey = equipmentMatchKey(value)
  const variants = groups.get(matchKey) || new Map<string, Candidate>()
  const existing = variants.get(value)
  if (existing) existing.count += 1
  else variants.set(value, { value, count: 1, firstSeen: index })
  groups.set(matchKey, variants)
}

function toCanonicalList(groups: CandidateGroup) {
  return Array.from(groups.values())
    .map((variants) => Array.from(variants.values()).sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count
      if (a.firstSeen !== b.firstSeen) return a.firstSeen - b.firstSeen
      return a.value.localeCompare(b.value, 'vi')
    })[0])
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count
      return a.value.localeCompare(b.value, 'vi')
    })
    .map((candidate) => candidate.value)
}

export async function loadEquipmentSuggestions(): Promise<EquipmentSuggestionMap> {
  const { data, error } = await supabase
    .from('equipment_master')
    .select('equipment_name,model,manufacturer,source_data')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(2000)

  if (error) throw new Error(error.message || 'Không tải được dữ liệu gợi ý.')

  const buckets: Record<EquipmentSuggestionKey, CandidateGroup> = {
    equipmentName: new Map(),
    equipmentCategory: new Map(),
    model: new Map(),
    manufacturer: new Map(),
    distributor: new Map(),
    managingDepartment: new Map(),
    currentArea: new Map(),
    currentLine: new Map(),
    managementResponsiblePrimary: new Map(),
    managementResponsibleSecondary: new Map(),
    origin: new Map(),
  }

  ;((data || []) as EquipmentSuggestionRow[]).forEach((row, index) => {
    const source = row.source_data || {}
    addCandidate(buckets.equipmentName, row.equipment_name, index)
    addCandidate(buckets.equipmentCategory, readSourceText(source, 'equipmentCategory', 'category'), index)
    addCandidate(buckets.model, row.model, index)
    addCandidate(buckets.manufacturer, row.manufacturer, index)
    addCandidate(buckets.distributor, readSourceText(source, 'distributor'), index)
    addCandidate(buckets.managingDepartment, readSourceText(source, 'managingDepartment'), index)
    addCandidate(buckets.currentArea, readSourceText(source, 'currentArea'), index)
    addCandidate(buckets.currentLine, readSourceText(source, 'currentLine'), index)
    addCandidate(buckets.managementResponsiblePrimary, readSourceText(source, 'managementResponsiblePrimary'), index)
    addCandidate(buckets.managementResponsibleSecondary, readSourceText(source, 'managementResponsibleSecondary'), index)
    addCandidate(buckets.origin, readSourceText(source, 'origin'), index)
  })

  return {
    equipmentName: toCanonicalList(buckets.equipmentName),
    equipmentCategory: toCanonicalList(buckets.equipmentCategory),
    model: toCanonicalList(buckets.model),
    manufacturer: toCanonicalList(buckets.manufacturer),
    distributor: toCanonicalList(buckets.distributor),
    managingDepartment: toCanonicalList(buckets.managingDepartment),
    currentArea: toCanonicalList(buckets.currentArea),
    currentLine: toCanonicalList(buckets.currentLine),
    managementResponsiblePrimary: toCanonicalList(buckets.managementResponsiblePrimary),
    managementResponsibleSecondary: toCanonicalList(buckets.managementResponsibleSecondary),
    origin: toCanonicalList(buckets.origin),
  }
}

export function rememberEquipmentSuggestion(current: EquipmentSuggestionMap, key: EquipmentSuggestionKey, rawValue: string) {
  const value = canonicalizeEquipmentValue(rawValue, current[key])
  if (!value) return current
  if (current[key].some((option) => equipmentMatchKey(option) === equipmentMatchKey(value))) return current
  return { ...current, [key]: [value, ...current[key]] }
}
