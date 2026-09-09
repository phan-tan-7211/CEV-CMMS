import { supabase } from '../../../lib/supabase/client'

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || `Không thực hiện được ${name}.`)
  return data as T
}

export type WorkOrderSignature = { id: string; name: string; role?: string | null; text: string; signedAt: string }
export type ParityWorkOrder = { id: string; status: string; reason: string; equipmentId: string; signatureRequired: boolean; signatures: WorkOrderSignature[] }
export type AssetFinancialProfile = {
  purchaseDate?: string | null
  purchaseCost?: number | null
  warrantyExpiry?: string | null
  usefulLifeMonths?: number | null
  salvageValue?: number | null
  depreciationMethod?: string | null
  replacementTargetDate?: string | null
}
export type ParityEquipment = { id: string; name: string; profile?: AssetFinancialProfile | null }
export type ParityTag = { id: string; name: string; color?: string | null; usageCount: number }
export type ParityTagSet = { id: string; name: string; description?: string | null; tagIds: string[] }
export type ChecklistRule = {
  templateItemId: string
  templateId: string
  label: string
  locked: boolean
  restrictedRole?: string | null
  conditionItemId?: string | null
  conditionOperator?: string | null
  conditionValue?: string | null
}
export type EntityTag = { entityType: string; entityId: string; tagId: string }
export type MobileLastParitySnapshot = {
  workOrders: ParityWorkOrder[]
  equipment: ParityEquipment[]
  tags: ParityTag[]
  tagSets: ParityTagSet[]
  checklistRules: ChecklistRule[]
  entityTags: EntityTag[]
}

export function loadMobileLastParity(limit = 150) {
  return rpc<MobileLastParitySnapshot>('rpc_cmms_mobile_last_parity_snapshot', { p_limit: limit })
}
export function setSignatureRequirement(workOrderId: string, required: boolean) {
  return rpc<void>('rpc_cmms_set_signature_requirement', { p_work_order_id: workOrderId, p_required: required })
}
export function signWorkOrder(input: { workOrderId: string; signerName: string; signerRole?: string; signatureText: string }) {
  return rpc<string>('rpc_cmms_sign_work_order', {
    p_work_order_id: input.workOrderId,
    p_signer_name: input.signerName,
    p_signer_role: input.signerRole || null,
    p_signature_text: input.signatureText,
  })
}
export function saveChecklistRule(input: { templateItemId: string; locked: boolean; restrictedRole?: string; conditionItemId?: string; conditionOperator?: string; conditionValue?: string }) {
  return rpc<void>('rpc_cmms_save_checklist_rule', {
    p_template_item_id: input.templateItemId,
    p_locked: input.locked,
    p_restricted_role: input.restrictedRole || null,
    p_condition_item_id: input.conditionItemId || null,
    p_condition_operator: input.conditionOperator || null,
    p_condition_value: input.conditionValue || null,
  })
}
export function saveAssetFinancialProfile(equipmentId: string, profile: AssetFinancialProfile) {
  return rpc<void>('rpc_cmms_save_asset_financial_profile', {
    p_equipment_id: equipmentId,
    p_purchase_date: profile.purchaseDate || null,
    p_purchase_cost: profile.purchaseCost ?? null,
    p_warranty_expiry: profile.warrantyExpiry || null,
    p_useful_life_months: profile.usefulLifeMonths ?? null,
    p_salvage_value: profile.salvageValue ?? null,
    p_depreciation_method: profile.depreciationMethod || 'STRAIGHT_LINE',
    p_replacement_target_date: profile.replacementTargetDate || null,
  })
}
export function createTag(name: string, color?: string) {
  return rpc<string>('rpc_cmms_create_tag', { p_name: name, p_color: color || null })
}
export function setEntityTag(input: { entityType: 'ASSET' | 'WORK_ORDER'; entityId: string; tagId: string; enabled: boolean }) {
  return rpc<void>('rpc_cmms_set_entity_tag', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_tag_id: input.tagId,
    p_enabled: input.enabled,
  })
}
export function createTagSet(name: string, description?: string) {
  return rpc<string>('rpc_cmms_create_tag_set', { p_name: name, p_description: description || null })
}
export function setTagSetMember(input: { setId: string; tagId: string; enabled: boolean }) {
  return rpc<void>('rpc_cmms_set_tag_set_member', {
    p_set_id: input.setId,
    p_tag_id: input.tagId,
    p_enabled: input.enabled,
  })
}
