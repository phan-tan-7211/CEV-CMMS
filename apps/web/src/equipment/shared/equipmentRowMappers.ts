import { deriveEquipmentCriticality } from '../../data/autoRegistration'
import type { EquipmentRowPatch } from '../../data/equipmentBulkEdit'
import type { EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import type { LiveEquipment } from '../../data/liveEquipment'

export function mergeInlinePatch(row: LiveEquipment, patch: EquipmentRowPatch): LiveEquipment {
  const next: LiveEquipment={...row}
  if (patch.equipmentName!==undefined) next.equipmentName=patch.equipmentName
  if (patch.equipmentCategory!==undefined) next.equipmentCategory=patch.equipmentCategory
  if (patch.manufacturer!==undefined) next.manufacturer=patch.manufacturer
  if (patch.distributor!==undefined) next.distributor=patch.distributor
  if (patch.model!==undefined) next.model=patch.model
  if (patch.serialNumber!==undefined) next.serialNumber=patch.serialNumber
  if (patch.department!==undefined) next.usingDepartment=patch.department
  if (patch.managingDepartment!==undefined) next.managingDepartment=patch.managingDepartment
  if (patch.managementResponsiblePrimary!==undefined) next.managementResponsiblePrimary=patch.managementResponsiblePrimary
  if (patch.managementResponsibleSecondary!==undefined) next.managementResponsibleSecondary=patch.managementResponsibleSecondary
  if (patch.currentArea!==undefined) next.currentArea=patch.currentArea
  if (patch.currentLine!==undefined) next.currentLine=patch.currentLine
  if (patch.status!==undefined) next.status=patch.status
  if (patch.defaultLabelSize!==undefined) next.defaultLabelSize=patch.defaultLabelSize
  if (patch.technicalSpecification!==undefined) next.technicalSpecification=patch.technicalSpecification
  if (patch.description!==undefined) next.description=patch.description
  if (patch.accuracy!==undefined) next.accuracy=patch.accuracy
  if (patch.origin!==undefined) next.origin=patch.origin
  if (patch.manufactureDate!==undefined) next.manufactureDate=patch.manufactureDate
  if (patch.inServiceDate!==undefined) next.inServiceDate=patch.inServiceDate
  if (patch.warrantyUntil!==undefined) next.warrantyUntil=patch.warrantyUntil
  if (patch.warrantyContact!==undefined) next.warrantyContact=patch.warrantyContact
  if (patch.note!==undefined) next.note=patch.note
  if (patch.relatedDocuments!==undefined) next.relatedDocuments=patch.relatedDocuments
  if (patch.active!==undefined) next.active=patch.active
  const facts={...row.criticalityFacts}
  if (patch.controlsProductQuality!==undefined) facts.controlsProductQuality=patch.controlsProductQuality
  if (patch.specialCharacteristicImpact!==undefined) facts.specialCharacteristicImpact=patch.specialCharacteristicImpact
  if (patch.stopsProduction!==undefined) facts.stopsProduction=patch.stopsProduction
  if (patch.hasBackup!==undefined) facts.hasBackup=patch.hasBackup
  if (patch.capacityImpact!==undefined) facts.capacityImpact=patch.capacityImpact
  next.criticalityFacts=facts
  const derived=deriveEquipmentCriticality(facts)
  if (derived) next.criticality=derived
  next.updatedAt=new Date().toISOString()
  return next
}

export function toDraft(row: LiveEquipment): EquipmentMasterEditInput {
  const criticalityFacts = row.criticalityFacts
  return {
    equipmentId: row.equipmentId, equipmentType: row.equipmentType, equipmentName: row.equipmentName,
    equipmentCategory: row.equipmentCategory || '', manufacturer: row.manufacturer || '', distributor: row.distributor || '', model: row.model || '', serialNumber: row.serialNumber || '',
    department: row.usingDepartment || '', currentArea: row.currentArea || '', currentLine: row.currentLine || '', managingDepartment: row.managingDepartment || '',
    managementResponsiblePrimary: row.managementResponsiblePrimary || '', managementResponsibleSecondary: row.managementResponsibleSecondary || '',
    technicalSpecification: row.technicalSpecification || '', description: row.description || '', accuracy: row.accuracy || '', origin: row.origin || '',
    manufactureDate: row.manufactureDate || '', inServiceDate: row.inServiceDate || '', warrantyUntil: row.warrantyUntil || '', warrantyContact: row.warrantyContact || '',
    note: row.note || '', relatedDocuments: row.relatedDocuments || '', status: row.status || 'RUNNING',
    controlsProductQuality: criticalityFacts?.controlsProductQuality, specialCharacteristicImpact: criticalityFacts?.specialCharacteristicImpact,
    stopsProduction: criticalityFacts?.stopsProduction, hasBackup: criticalityFacts?.hasBackup, capacityImpact: criticalityFacts?.capacityImpact,
  }
}

export function mergeDraftIntoRow(row: LiveEquipment, draft: EquipmentMasterEditInput, criticality: string): LiveEquipment {
  if (row.equipmentId !== draft.equipmentId.trim().toUpperCase()) return row
  return {
    ...row,
    equipmentName: draft.equipmentName.trim(), equipmentType: draft.equipmentType, equipmentCategory: draft.equipmentCategory.trim(),
    manufacturer: draft.manufacturer.trim(), distributor: draft.distributor?.trim() || '', model: draft.model.trim(), serialNumber: draft.serialNumber.trim(),
    currentArea: draft.currentArea.trim(), currentLine: draft.currentLine.trim(), managingDepartment: draft.managingDepartment.trim(),
    managementResponsiblePrimary: draft.managementResponsiblePrimary?.trim() || '', managementResponsibleSecondary: draft.managementResponsibleSecondary?.trim() || '',
    usingDepartment: draft.department.trim(), technicalSpecification: draft.technicalSpecification.trim(), description: draft.description.trim(),
    accuracy: draft.accuracy.trim(), origin: draft.origin.trim(), manufactureDate: draft.manufactureDate.trim(), inServiceDate: draft.inServiceDate.trim(),
    warrantyUntil: draft.warrantyUntil.trim(), warrantyContact: draft.warrantyContact.trim(), note: draft.note.trim(), relatedDocuments: draft.relatedDocuments.trim(),
    status: draft.status.trim() || 'RUNNING', criticality,
    criticalityFacts: { controlsProductQuality: draft.controlsProductQuality, specialCharacteristicImpact: draft.specialCharacteristicImpact, stopsProduction: draft.stopsProduction, hasBackup: draft.hasBackup, capacityImpact: draft.capacityImpact },
    updatedAt: new Date().toISOString(),
  }
}
