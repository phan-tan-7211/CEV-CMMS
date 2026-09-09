import { supabase } from '../../../lib/supabase/client'

export async function applyChecklistTemplateToWorkOrder(workOrderId: string, templateId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_apply_checklist_template_to_work_order', {
    p_work_order_id: workOrderId,
    p_template_id: templateId,
  })
  if (error) throw new Error(error.message || 'Không áp dụng được checklist template.')
  return data as { workOrderId: string; templateId: string; appliedCount: number }
}

export async function listEntityCustomValues(entityType: string, entityId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_entity_custom_values', { p_entity_type: entityType, p_entity_id: entityId })
  if (error) throw new Error(error.message || 'Không tải được custom fields.')
  return (Array.isArray(data) ? data : []) as Array<{ fieldId: string; label: string; fieldType: string; required: boolean; choices: string[]; value: unknown }>
}

export async function saveEntityCustomValues(entityType: string, entityId: string, values: Array<{ fieldId: string; value: unknown }>) {
  const { data, error } = await supabase.rpc('rpc_cmms_save_custom_field_values', { p_entity_type: entityType, p_entity_id: entityId, p_values: values })
  if (error) throw new Error(error.message || 'Không lưu được custom fields.')
  return data as { savedCount: number }
}
