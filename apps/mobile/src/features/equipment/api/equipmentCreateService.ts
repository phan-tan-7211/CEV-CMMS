import { supabase } from '../../../lib/supabase/client'

export type EquipmentCreateInput = {
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  distributor: string
  model: string
  serialNumber: string
  department: string
  currentArea: string
  currentLine: string
  managingDepartment: string
  managementResponsiblePrimary: string
  managementResponsibleSecondary: string
  technicalSpecification: string
  description: string
  origin: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  status: string
  controlsProductQuality: boolean
  specialCharacteristicImpact: boolean
  stopsProduction: boolean
  hasBackup: boolean
  capacityImpact: boolean
}

export type EquipmentCreateResult = {
  equipmentId: string
  qrCode: string
  criticality: string
}

export async function createEquipment(input: EquipmentCreateInput): Promise<EquipmentCreateResult> {
  const { data, error } = await supabase.rpc('rpc_create_equipment_auto', { p_input: input })
  if (error) throw new Error(error.message || 'Không thể tạo thiết bị.')

  const row = (data || {}) as Record<string, unknown>
  const equipmentId = String(row.equipmentId || row.equipment_id || '')
  if (!equipmentId) throw new Error('RPC không trả về mã thiết bị.')

  if (input.distributor.trim()) {
    const { error: distributorError } = await supabase.rpc('rpc_set_equipment_distributor', {
      p_equipment_id: equipmentId,
      p_distributor: input.distributor.trim(),
    })
    if (distributorError) {
      throw new Error(`Thiết bị ${equipmentId} đã tạo nhưng chưa lưu được nhà phân phối: ${distributorError.message}`)
    }
  }

  return {
    equipmentId,
    qrCode: String(row.qrCode || row.qr_code || equipmentId),
    criticality: String(row.criticality || ''),
  }
}
