import type { EquipmentHandover } from './models'

export type HandoverReleaseDecision = {
  allowed: boolean
  reason?: string
}

export function canReleaseEquipment(handover: EquipmentHandover | undefined): HandoverReleaseDecision {
  if (!handover) return { allowed: false, reason: 'Chưa có biên bản bàn giao BM-TBSX-05.' }
  if (!handover.accepted) return { allowed: false, reason: 'Bên nhận chưa xác nhận chấp nhận thiết bị.' }
  if (handover.condition === 'NOT_OPERABLE') return { allowed: false, reason: 'Thiết bị chưa hoạt động được nên không thể release.' }
  return { allowed: true }
}
