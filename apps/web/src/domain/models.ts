import { z } from 'zod'
import { PERSISTENCE_TABLES } from './persistenceContract'

const NonEmpty = z.string().trim().min(1)
const OptionalText = z.string().trim().optional()
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo YYYY-MM-DD')
const IsoDateTime = z.string().datetime({ offset: true })

export const EquipmentTypeSchema = z.enum(['PRODUCTION', 'MEASUREMENT'])
export const EquipmentStatusSchema = z.enum(['RUNNING', 'DOWN', 'MAINTENANCE', 'STOPPED', 'DISPOSED'])
export const EquipmentCriticalitySchema = z.enum(['A', 'B', 'C', 'D'])

export const EquipmentSchema = z.object({
  equipmentId: NonEmpty,
  equipmentName: NonEmpty,
  equipmentType: EquipmentTypeSchema,
  equipmentCategory: OptionalText,
  manufacturer: OptionalText,
  supplier: OptionalText,
  model: OptionalText,
  serialNumber: OptionalText,
  productionYear: z.number().int().min(1900).max(2200).optional(),
  purchaseDate: IsoDate.optional(),
  commissionDate: IsoDate.optional(),
  currentArea: OptionalText,
  currentLine: OptionalText,
  managingDepartment: OptionalText,
  usingDepartment: OptionalText,
  technicalSpecification: OptionalText,
  maintenanceCycleMonths: z.number().int().positive().optional(),
  status: EquipmentStatusSchema,
  criticality: EquipmentCriticalitySchema.optional(),
  imageUrl: z.string().url().optional(),
  manualUrl: z.string().url().optional(),
  setupDocumentUrl: z.string().url().optional(),
  qrCode: NonEmpty,
  active: z.boolean(),
  updatedAt: IsoDateTime,
})

export const DailyInspectionMarkSchema = z.enum(['V', 'URGENT_REPAIR', 'MAINTENANCE_REQUIRED', 'STOP_REPAIR'])
export const DailyInspectionSchema = z.object({
  inspectionId: NonEmpty,
  equipmentId: NonEmpty,
  inspectionDate: IsoDate,
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
  area: OptionalText,
  inspectorId: NonEmpty,
  overallMark: DailyInspectionMarkSchema,
  note: OptionalText,
  damagedParts: OptionalText,
  createdAt: IsoDateTime,
})

export const DailyInspectionItemSchema = z.object({
  inspectionItemId: NonEmpty,
  inspectionId: NonEmpty,
  category: z.enum(['SAFETY', 'FUNCTION', 'PREVENTIVE', 'OTHER']),
  itemName: NonEmpty,
  mark: DailyInspectionMarkSchema,
  note: OptionalText,
})

export const MaintenanceStatusSchema = z.enum(['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'RELEASED', 'CANCELLED'])
export const MaintenanceTypeSchema = z.enum(['PM', 'CM', 'PDM', 'INSPECTION', 'IMPROVEMENT'])

export const MaintenancePlanSchema = z.object({
  planId: NonEmpty,
  equipmentId: NonEmpty,
  maintenanceType: MaintenanceTypeSchema,
  frequencyType: z.enum(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'OPERATING_HOUR']),
  frequencyValue: z.number().int().positive(),
  plannedDate: IsoDate.optional(),
  responsiblePerson: OptionalText,
  status: z.enum(['PLANNED', 'DUE_SOON', 'OVERDUE', 'COMPLETED', 'SUSPENDED']),
  approvedBy: OptionalText,
  instructionUrl: z.string().url().optional(),
})

export const MaintenancePlanItemSchema = z.object({
  planItemId: NonEmpty,
  planId: NonEmpty,
  maintenanceItem: NonEmpty,
  acceptanceStandard: OptionalText,
  method: OptionalText,
  note: OptionalText,
})

export const MaintenanceWorkOrderSchema = z.object({
  workOrderId: NonEmpty,
  equipmentId: NonEmpty,
  sourceType: z.enum(['PLAN', 'DAILY_INSPECTION', 'DOWNTIME', 'PREDICTIVE', 'MANUAL']),
  sourceId: OptionalText,
  requestedAt: IsoDateTime,
  requestedBy: NonEmpty,
  reason: NonEmpty,
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  method: OptionalText,
  plannedStartAt: IsoDateTime.optional(),
  plannedEndAt: IsoDateTime.optional(),
  approvedBy: OptionalText,
  approvedAt: IsoDateTime.optional(),
  status: MaintenanceStatusSchema,
})

export const MaintenanceResultMarkSchema = z.enum(['GOOD', 'WARNING', 'REPAIR_REQUIRED'])
export const MaintenanceExecutionSchema = z.object({
  executionId: NonEmpty,
  workOrderId: NonEmpty,
  equipmentId: NonEmpty,
  startedAt: IsoDateTime,
  completedAt: IsoDateTime.optional(),
  performedBy: NonEmpty,
  verifiedBy: OptionalText,
  verifiedAt: IsoDateTime.optional(),
  resultSummary: OptionalText,
  rootCause: OptionalText,
  correctiveAction: OptionalText,
  replacedPart: OptionalText,
  photoBeforeUrl: z.string().url().optional(),
  photoAfterUrl: z.string().url().optional(),
  status: MaintenanceStatusSchema,
})

export const MaintenanceResultItemSchema = z.object({
  resultItemId: NonEmpty,
  executionId: NonEmpty,
  maintenanceItem: NonEmpty,
  result: MaintenanceResultMarkSchema,
  repairContent: OptionalText,
  maintenanceContent: OptionalText,
  inspectorId: OptionalText,
  note: OptionalText,
})

export const MaintenanceLogSchema = z.object({
  maintenanceId: NonEmpty,
  equipmentId: NonEmpty,
  workOrderId: OptionalText,
  executionId: OptionalText,
  maintenanceType: MaintenanceTypeSchema,
  reportedAt: IsoDateTime,
  repairStartedAt: IsoDateTime.optional(),
  completedAt: IsoDateTime.optional(),
  issueDescription: NonEmpty,
  failureCategory: OptionalText,
  rootCause: OptionalText,
  correctiveAction: OptionalText,
  replacedPart: OptionalText,
  performedBy: OptionalText,
  status: MaintenanceStatusSchema,
  downtimeMinutes: z.number().int().nonnegative().optional(),
  createdBy: NonEmpty,
})

export const EquipmentHandoverSchema = z.object({
  handoverId: NonEmpty,
  equipmentId: NonEmpty,
  handoverAt: IsoDateTime,
  fromPerson: NonEmpty,
  fromDepartment: OptionalText,
  toPerson: NonEmpty,
  toDepartment: OptionalText,
  reason: NonEmpty,
  condition: z.enum(['NORMAL', 'MINOR_ISSUE_MONITOR', 'NOT_OPERABLE']),
  attachmentNote: OptionalText,
  senderComment: OptionalText,
  receiverComment: OptionalText,
  accepted: z.boolean(),
})

export const DowntimeEventSchema = z.object({
  downtimeId: NonEmpty,
  equipmentId: NonEmpty,
  downAt: IsoDateTime,
  restoredAt: IsoDateTime.optional(),
  category: NonEmpty,
  description: OptionalText,
  actionToRestore: OptionalText,
  recordedBy: NonEmpty,
  handledBy: OptionalText,
  workOrderId: OptionalText,
  downtimeMinutes: z.number().int().nonnegative().optional(),
})

export const ToolingTypeSchema = z.enum(['JIG', 'FIXTURE', 'MOLD', 'DIE', 'CUTTING_TOOL', 'PERISHABLE_TOOL', 'OTHER'])
export const ToolingStatusSchema = z.enum(['IN_PRODUCTION', 'REPAIR', 'STORED', 'DISPOSED'])
export const ToolingMasterSchema = z.object({
  toolingId: NonEmpty,
  toolingName: NonEmpty,
  serialOrAssetNumber: OptionalText,
  toolingType: ToolingTypeSchema,
  usedFor: OptionalText,
  ownership: z.enum(['COMPANY', 'CUSTOMER']),
  customerName: OptionalText,
  managingDepartment: OptionalText,
  storageLocation: OptionalText,
  status: ToolingStatusSchema,
  commissionDate: IsoDate.optional(),
  inspectionCycleDays: z.number().int().positive().optional(),
  note: OptionalText,
})

export const ToolingMaintenancePlanSchema = z.object({
  toolingPlanId: NonEmpty,
  toolingId: NonEmpty,
  inspectionItem: NonEmpty,
  acceptanceCriteria: NonEmpty,
  frequencyType: z.enum(['DAY', 'WEEK', 'MONTH', 'USE_COUNT', 'OUTPUT_COUNT']),
  frequencyValue: z.number().int().positive(),
  responsiblePerson: OptionalText,
  lastResultDate: IsoDate.optional(),
  note: OptionalText,
})

export const ToolingModificationSchema = z.object({
  modificationId: NonEmpty,
  toolingId: NonEmpty,
  modificationDate: IsoDate,
  modificationType: z.enum(['DESIGN_CHANGE', 'PHYSICAL_MODIFICATION']),
  reason: NonEmpty,
  ecnNumber: OptionalText,
  beforeAfterDescription: NonEmpty,
  proposedBy: NonEmpty,
  approvedBy: OptionalText,
  qaConfirmedBy: OptionalText,
  updatedDocuments: OptionalText,
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
})

export const CalibrationResultSchema = z.enum(['PASS', 'FAIL', 'LIMITED_USE'])
export const CalibrationLogSchema = z.object({
  calibrationId: NonEmpty,
  equipmentId: NonEmpty,
  calibrationDate: IsoDate,
  nextDueDate: IsoDate,
  certificateNumber: OptionalText,
  calibrationProvider: OptionalText,
  result: CalibrationResultSchema,
  certificateUrl: z.string().url().optional(),
  labelPhotoUrl: z.string().url().optional(),
  createdBy: NonEmpty,
  createdAt: IsoDateTime,
})

export const EquipmentMovementSchema = z.object({
  movementId: NonEmpty,
  equipmentId: NonEmpty,
  fromArea: OptionalText,
  fromLine: OptionalText,
  toArea: OptionalText,
  toLine: OptionalText,
  movedAt: IsoDateTime,
  reason: NonEmpty,
  approvedBy: OptionalText,
  performedBy: NonEmpty,
})

export const AuditLogSchema = z.object({
  auditId: NonEmpty,
  timestamp: IsoDateTime,
  userId: NonEmpty,
  action: NonEmpty,
  entityType: z.enum(['EQUIPMENT', 'INSPECTION', 'MAINTENANCE', 'HANDOVER', 'DOWNTIME', 'TOOLING', 'CALIBRATION', 'MOVEMENT', 'APPROVAL']),
  entityId: NonEmpty,
  oldValueJson: z.string().optional(),
  newValueJson: z.string().optional(),
})

export type Equipment = z.infer<typeof EquipmentSchema>
export type DailyInspection = z.infer<typeof DailyInspectionSchema>
export type MaintenancePlan = z.infer<typeof MaintenancePlanSchema>
export type MaintenanceWorkOrder = z.infer<typeof MaintenanceWorkOrderSchema>
export type MaintenanceExecution = z.infer<typeof MaintenanceExecutionSchema>
export type MaintenanceLog = z.infer<typeof MaintenanceLogSchema>
export type EquipmentHandover = z.infer<typeof EquipmentHandoverSchema>
export type DowntimeEvent = z.infer<typeof DowntimeEventSchema>
export type ToolingMaster = z.infer<typeof ToolingMasterSchema>
export type ToolingModification = z.infer<typeof ToolingModificationSchema>
export type CalibrationLog = z.infer<typeof CalibrationLogSchema>
export type EquipmentMovement = z.infer<typeof EquipmentMovementSchema>
export type AuditLog = z.infer<typeof AuditLogSchema>

/** @deprecated Use PERSISTENCE_TABLES from persistenceContract.ts for new code. */
export const CORE_SHEET_NAMES = PERSISTENCE_TABLES
