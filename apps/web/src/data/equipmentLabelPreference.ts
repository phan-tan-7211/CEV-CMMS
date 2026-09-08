import { dataGateway } from './dataGateway'

export type EquipmentLabelSizePreference = 'tiny' | 'standard' | 'large'

export function normalizeEquipmentLabelSize(value: unknown): EquipmentLabelSizePreference {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'tiny') return 'tiny'
  if (normalized === 'large') return 'large'
  return 'standard'
}

export async function setEquipmentDefaultLabelSize(equipmentId: string, labelSize: EquipmentLabelSizePreference) {
  const id = equipmentId.trim().toUpperCase()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')
  const { error } = await dataGateway.rpc('rpc_set_equipment_label_size', {
    p_equipment_id: id,
    p_label_size: labelSize,
  })
  if (error) throw new Error(`SUPABASE_LABEL_SIZE_SAVE_FAILED: ${error instanceof Error ? error.message : String(error)}`)
}
