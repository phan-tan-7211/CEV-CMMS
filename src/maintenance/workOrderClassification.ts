export type WorkOrderSourceFamily =
  | 'MANUAL'
  | 'INSPECTION'
  | 'PREVENTIVE_PLAN'
  | 'REQUEST'
  | 'EQUIPMENT_PROFILE'
  | 'LEGACY_IMPORT'
  | 'UNKNOWN'

export type WorkOrderKind =
  | 'BREAKDOWN'
  | 'CORRECTIVE'
  | 'PREVENTIVE'
  | 'INSPECTION_GENERATED'
  | 'MANUAL'
  | 'UNKNOWN'

export const WORK_ORDER_SOURCE_TYPE = {
  MANUAL: 'MANUAL',
  INSPECTION: 'DAILY_INSPECTION',
  PREVENTIVE_PLAN: 'PREVENTIVE_PLAN',
  REQUEST: 'REQUEST',
  EQUIPMENT_PROFILE: 'EQUIPMENT_PROFILE',
  LEGACY_IMPORT: 'LEGACY_IMPORT',
} as const

export type WorkOrderCreateSourceType = typeof WORK_ORDER_SOURCE_TYPE[keyof typeof WORK_ORDER_SOURCE_TYPE]

export type WorkOrderClassificationInput = {
  sourceType?: string | null
  planClassification?: string | null
  hasDowntime?: boolean
  equipmentStopped?: boolean
}

export type WorkOrderClassification = {
  sourceFamily: WorkOrderSourceFamily
  kind: WorkOrderKind
}

function normalized(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase()
}

const SOURCE_FAMILY_BY_TYPE: Record<string, WorkOrderSourceFamily> = {
  MANUAL: 'MANUAL',
  DAILY_INSPECTION: 'INSPECTION',
  INSPECTION: 'INSPECTION',
  PREVENTIVE_PLAN: 'PREVENTIVE_PLAN',
  PM: 'PREVENTIVE_PLAN',
  REQUEST: 'REQUEST',
  EQUIPMENT_PROFILE: 'EQUIPMENT_PROFILE',
  QR_PROFILE: 'EQUIPMENT_PROFILE',
  LEGACY_IMPORT: 'LEGACY_IMPORT',
}

export function normalizeWorkOrderSourceFamily(sourceType: string | null | undefined): WorkOrderSourceFamily {
  return SOURCE_FAMILY_BY_TYPE[normalized(sourceType)] || 'UNKNOWN'
}

export function classifyWorkOrder(input: WorkOrderClassificationInput): WorkOrderClassification {
  const sourceFamily = normalizeWorkOrderSourceFamily(input.sourceType)
  const planClassification = normalized(input.planClassification)

  if (input.hasDowntime || input.equipmentStopped) return { sourceFamily, kind: 'BREAKDOWN' }
  if (sourceFamily === 'INSPECTION') return { sourceFamily, kind: 'INSPECTION_GENERATED' }
  if (sourceFamily === 'PREVENTIVE_PLAN' || planClassification === 'PLANNED') return { sourceFamily, kind: 'PREVENTIVE' }
  if (planClassification === 'UNPLANNED') return { sourceFamily, kind: 'CORRECTIVE' }
  if (sourceFamily === 'MANUAL' || sourceFamily === 'REQUEST' || sourceFamily === 'EQUIPMENT_PROFILE') return { sourceFamily, kind: 'MANUAL' }

  return { sourceFamily, kind: 'UNKNOWN' }
}

export const WORK_ORDER_SOURCE_LABEL: Record<WorkOrderSourceFamily, string> = {
  MANUAL: 'Tạo thủ công',
  INSPECTION: 'Từ kiểm tra',
  PREVENTIVE_PLAN: 'Từ kế hoạch bảo dưỡng',
  REQUEST: 'Từ yêu cầu',
  EQUIPMENT_PROFILE: 'Từ hồ sơ thiết bị',
  LEGACY_IMPORT: 'Dữ liệu lịch sử',
  UNKNOWN: 'Nguồn chưa xác định',
}

export const WORK_ORDER_KIND_LABEL: Record<WorkOrderKind, string> = {
  BREAKDOWN: 'Sự cố / dừng máy',
  CORRECTIVE: 'Sửa chữa khắc phục',
  PREVENTIVE: 'Bảo dưỡng phòng ngừa',
  INSPECTION_GENERATED: 'Phát sinh từ kiểm tra',
  MANUAL: 'Công việc thủ công',
  UNKNOWN: 'Loại chưa xác định',
}
