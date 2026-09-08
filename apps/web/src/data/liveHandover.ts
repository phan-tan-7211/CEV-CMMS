import { dataGateway } from './dataGateway'
import { patchMaintenanceHandoverCache } from './liveMaintenance'

export type EquipmentHandoverInput = {
  workOrderId: string
  equipmentId: string
  handoverAt: string
  location: string
  chairDepartment: string
  meetingContent: string
  participants: string
  handoverPerson: string
  handoverTitle: string
  handoverDepartment: string
  receiverPerson: string
  receiverTitle: string
  receiverDepartment: string
  handoverReason: string
  equipmentCondition: 'NORMAL' | 'MINOR_ISSUE' | 'NOT_OPERATIONAL'
  attachedItems: string
  handoverComment: string
  receiverComment: string
  otherAgreement: string
  accepted: boolean
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export async function recordEquipmentHandover(input: EquipmentHandoverInput) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_record_equipment_handover', { p_input: input })
  if (error) throw error
  const result = data || {}
  const normalized = {
    handoverId: text(result.handoverId),
    equipmentId: text(result.equipmentId),
    workOrderId: text(result.workOrderId),
    accepted: result.accepted === true,
  }
  patchMaintenanceHandoverCache({
    handoverId: normalized.handoverId,
    workOrderId: normalized.workOrderId,
    equipmentId: normalized.equipmentId,
    accepted: normalized.accepted,
    condition: input.equipmentCondition,
    handoverAt: input.handoverAt || new Date().toISOString(),
  })
  return normalized
}
