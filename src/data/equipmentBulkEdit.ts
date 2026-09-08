import type { LiveEquipment } from './liveEquipment'
import { patchEquipmentCacheAfterBulk, patchEquipmentCacheAfterWrite } from './supabaseEquipment'
import { dataGateway } from './dataGateway'

export type EquipmentBulkPatch = {
  department?: string
  managingDepartment?: string
  currentArea?: string
  currentLine?: string
  equipmentCategory?: string
  status?: string
}

export type EquipmentRowPatch = Partial<{
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  distributor: string
  model: string
  serialNumber: string
  department: string
  managingDepartment: string
  managementResponsiblePrimary: string
  managementResponsibleSecondary: string
  currentArea: string
  currentLine: string
  status: string
  defaultLabelSize: 'tiny' | 'standard' | 'large'
  technicalSpecification: string
  description: string
  accuracy: string
  controlsProductQuality: boolean
  specialCharacteristicImpact: boolean
  stopsProduction: boolean
  hasBackup: boolean
  capacityImpact: boolean
  origin: string
  manufactureDate: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  relatedDocuments: string
  active: boolean
}>

export type EquipmentRowChange = { equipmentId: string; patch: EquipmentRowPatch }

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

export async function bulkUpdateEquipment(equipmentIds: string[], patch: EquipmentBulkPatch) {
  const ids = [...new Set(equipmentIds.map((id) => id.trim().toUpperCase()).filter(Boolean))]
  if (!ids.length) throw new Error('Chưa chọn thiết bị.')
  if (!Object.keys(patch).length) throw new Error('Chưa chọn nội dung cần cập nhật.')

  const normalizedPatch = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_bulk_update_equipment_master', {
    p_equipment_ids: ids,
    p_patch: normalizedPatch,
  })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_BULK_UPDATE_FAILED: ${errorMessage(error)}`)
  const result = data || {}
  patchEquipmentCacheAfterBulk(ids, normalizedPatch)
  return { updatedCount: Number(result.updatedCount || result.updated_count || 0) }
}

function cachePatch(change: EquipmentRowChange): Partial<LiveEquipment> & { equipmentId: string; department?: string } {
  const source = change.patch
  const patch: Partial<LiveEquipment> & { equipmentId: string; department?: string } = { equipmentId: change.equipmentId }
  if ('equipmentName' in source) patch.equipmentName = source.equipmentName
  if ('equipmentCategory' in source) patch.equipmentCategory = source.equipmentCategory
  if ('manufacturer' in source) patch.manufacturer = source.manufacturer
  if ('distributor' in source) patch.distributor = source.distributor
  if ('model' in source) patch.model = source.model
  if ('serialNumber' in source) patch.serialNumber = source.serialNumber
  if ('department' in source) patch.department = source.department
  if ('managingDepartment' in source) patch.managingDepartment = source.managingDepartment
  if ('managementResponsiblePrimary' in source) patch.managementResponsiblePrimary = source.managementResponsiblePrimary
  if ('managementResponsibleSecondary' in source) patch.managementResponsibleSecondary = source.managementResponsibleSecondary
  if ('currentArea' in source) patch.currentArea = source.currentArea
  if ('currentLine' in source) patch.currentLine = source.currentLine
  if ('status' in source) patch.status = source.status
  if ('defaultLabelSize' in source) patch.defaultLabelSize = source.defaultLabelSize
  if ('technicalSpecification' in source) patch.technicalSpecification = source.technicalSpecification
  if ('description' in source) patch.description = source.description
  if ('accuracy' in source) patch.accuracy = source.accuracy
  if ('origin' in source) patch.origin = source.origin
  if ('manufactureDate' in source) patch.manufactureDate = source.manufactureDate
  if ('inServiceDate' in source) patch.inServiceDate = source.inServiceDate
  if ('warrantyUntil' in source) patch.warrantyUntil = source.warrantyUntil
  if ('warrantyContact' in source) patch.warrantyContact = source.warrantyContact
  if ('note' in source) patch.note = source.note
  if ('relatedDocuments' in source) patch.relatedDocuments = source.relatedDocuments
  if ('active' in source) patch.active = source.active
  return patch
}

export async function bulkUpdateEquipmentRows(changes: EquipmentRowChange[]) {
  const normalized = changes
    .map((change) => ({
      equipmentId: change.equipmentId.trim().toUpperCase(),
      ...Object.fromEntries(Object.entries(change.patch).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])),
    }))
    .filter((change) => change.equipmentId && Object.keys(change).length > 1)
  if (!normalized.length) throw new Error('Chưa có ô nào thay đổi.')

  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_bulk_update_equipment_rows', { p_changes: normalized })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_ROW_BATCH_UPDATE_FAILED: ${errorMessage(error)}`)
  for (const change of changes) patchEquipmentCacheAfterWrite(cachePatch(change))
  const result = data || {}
  return { updatedCount: Number(result.updatedCount || result.updated_count || normalized.length) }
}
