import type { DailyInspection, DowntimeEvent, Equipment, MaintenancePlan, MaintenanceWorkOrder, ToolingMaster } from '../domain/models'

export const mockEquipment: Equipment[] = [
  { equipmentId: 'CEV-BCS-0002', equipmentName: 'Máy đúc áp lực 350T', equipmentType: 'PRODUCTION', manufacturer: 'Toshiba', model: 'DC350', serialNumber: 'BCS-0002', currentArea: 'Die Casting', currentLine: 'Line 1', managingDepartment: 'Kỹ thuật', usingDepartment: 'Sản xuất', technicalSpecification: '350T', maintenanceCycleMonths: 1, status: 'RUNNING', criticality: 'A', qrCode: 'CEV-BCS-0002', active: true, updatedAt: '2026-08-28T01:00:00.000Z' },
  { equipmentId: 'CEV-CNC-0001', equipmentName: 'Máy CNC', equipmentType: 'PRODUCTION', manufacturer: 'Makino', model: 'V56', currentArea: 'Machining', currentLine: 'Line 2', managingDepartment: 'Kỹ thuật', usingDepartment: 'Sản xuất', maintenanceCycleMonths: 3, status: 'MAINTENANCE', criticality: 'A', qrCode: 'CEV-CNC-0001', active: true, updatedAt: '2026-08-28T01:00:00.000Z' },
  { equipmentId: 'CEV-PRS-0003', equipmentName: 'Máy ép Terminal', equipmentType: 'PRODUCTION', currentArea: 'Assembly', currentLine: 'Terminal', managingDepartment: 'Kỹ thuật', usingDepartment: 'Sản xuất', maintenanceCycleMonths: 1, status: 'DOWN', criticality: 'B', qrCode: 'CEV-PRS-0003', active: true, updatedAt: '2026-08-28T01:00:00.000Z' },
]

export const mockInspections: DailyInspection[] = [
  { inspectionId: 'DI-20260828-01', equipmentId: 'CEV-BCS-0002', inspectionDate: '2026-08-28', shift: 'MORNING', area: 'Die Casting', inspectorId: 'line-leader-01', overallMark: 'V', createdAt: '2026-08-28T00:30:00.000Z' },
  { inspectionId: 'DI-20260828-02', equipmentId: 'CEV-PRS-0003', inspectionDate: '2026-08-28', shift: 'MORNING', area: 'Assembly', inspectorId: 'line-leader-02', overallMark: 'STOP_REPAIR', note: 'Tiếng động bất thường, dừng máy để kiểm tra', createdAt: '2026-08-28T00:40:00.000Z' },
]

export const mockPlans: MaintenancePlan[] = [
  { planId: 'PM-BCS-08', equipmentId: 'CEV-BCS-0002', maintenanceType: 'PM', frequencyType: 'MONTH', frequencyValue: 1, plannedDate: '2026-08-30', responsiblePerson: 'Maintenance', status: 'DUE_SOON' },
  { planId: 'PM-CNC-08', equipmentId: 'CEV-CNC-0001', maintenanceType: 'PM', frequencyType: 'QUARTER', frequencyValue: 1, plannedDate: '2026-08-27', responsiblePerson: 'Maintenance', status: 'OVERDUE' },
]

export const mockWorkOrders: MaintenanceWorkOrder[] = [
  { workOrderId: 'WO-20260828-01', equipmentId: 'CEV-PRS-0003', sourceType: 'DAILY_INSPECTION', sourceId: 'DI-20260828-02', requestedAt: '2026-08-28T00:41:00.000Z', requestedBy: 'line-leader-02', reason: 'BM-KTTBHN: X / STOP_REPAIR', priority: 'CRITICAL', status: 'OPEN' },
  { workOrderId: 'WO-20260827-02', equipmentId: 'CEV-CNC-0001', sourceType: 'PLAN', sourceId: 'PM-CNC-08', requestedAt: '2026-08-27T01:00:00.000Z', requestedBy: 'maintenance', reason: 'PM định kỳ quá hạn', priority: 'HIGH', status: 'IN_PROGRESS' },
]

export const mockDowntimeEvents: DowntimeEvent[] = [
  { downtimeId: 'DT-20260804-01', equipmentId: 'CEV-PRS-0003', downAt: '2026-08-04T01:00:00.000Z', restoredAt: '2026-08-04T02:00:00.000Z', category: 'MECHANICAL', description: 'Kẹt cơ cấu cấp terminal', actionToRestore: 'Vệ sinh và căn chỉnh', recordedBy: 'line-leader-02', handledBy: 'maintenance', downtimeMinutes: 60 },
  { downtimeId: 'DT-20260807-01', equipmentId: 'CEV-CNC-0001', downAt: '2026-08-07T03:00:00.000Z', restoredAt: '2026-08-07T04:00:00.000Z', category: 'ELECTRICAL', description: 'Servo alarm', actionToRestore: 'Reset và kiểm tra encoder', recordedBy: 'line-leader-01', handledBy: 'maintenance', downtimeMinutes: 60 },
]

export const mockTooling: ToolingMaster[] = [
  { toolingId: 'CEV-JG-0012026', toolingName: 'Jig Terminal A', toolingType: 'JIG', usedFor: 'Terminal A / Assembly', ownership: 'COMPANY', managingDepartment: 'Kỹ thuật', storageLocation: 'Tooling Rack A', status: 'IN_PRODUCTION', commissionDate: '2026-01-10', inspectionCycleDays: 30 },
  { toolingId: 'CUS-MOLD-014', toolingName: 'Customer Mold 014', toolingType: 'MOLD', usedFor: 'Customer product', ownership: 'CUSTOMER', customerName: 'Customer', managingDepartment: 'Kỹ thuật', storageLocation: 'Mold Area', status: 'IN_PRODUCTION', inspectionCycleDays: 90 },
]
