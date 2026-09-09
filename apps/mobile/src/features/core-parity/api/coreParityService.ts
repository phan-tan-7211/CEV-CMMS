import { supabase } from '../../../lib/supabase/client'

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || `Không thực hiện được ${name}.`)
  return data as T
}

export type ChecklistItem = { itemId?: string; sequenceNo?: number; itemType: string; label: string; description?: string; required?: boolean; unit?: string; minValue?: number | null; maxValue?: number | null; choices?: string[] }
export type ChecklistTemplate = { templateId: string; name: string; description: string; active: boolean; items: ChecklistItem[] }
export type CustomFieldDefinition = { fieldId: string; entityType: string; label: string; fieldType: string; required: boolean; choices: string[]; sortOrder: number }
export type LibraryFile = { fileId: string; fileName: string; bucket: string; path: string; mimeType: string; size?: number; description: string; tags: string[]; createdAt: string; links: Array<{ entityType: string; entityId: string }> }
export type FloorPlanPin = { pinId: string; equipmentId?: string; label: string; x: number; y: number; color: string }
export type FloorPlan = { floorPlanId: string; locationId: string; name: string; bucket: string; path: string; pins: FloorPlanPin[] }
export type DowntimeEvent = { downtimeId: string; equipmentId: string; workOrderId?: string; startedAt?: string; endedAt?: string; reason: string; durationMinutes: number }
export type EquipmentOption = { id: string; name: string; status: string }

export function listChecklistTemplates(search = '') { return rpc<ChecklistTemplate[]>('rpc_cmms_checklist_templates', { p_search: search.trim() || null }) }
export function saveChecklistTemplate(input: { templateId?: string; name: string; description?: string; items: ChecklistItem[] }) { return rpc<{ templateId: string }>('rpc_cmms_save_checklist_template', { p_input: input }) }
export function listCustomFields(entityType: string) { return rpc<CustomFieldDefinition[]>('rpc_cmms_custom_fields', { p_entity_type: entityType }) }
export function saveCustomField(input: { fieldId?: string; entityType: string; label: string; fieldType: string; required?: boolean; choices?: string[]; sortOrder?: number }) { return rpc<{ fieldId: string }>('rpc_cmms_save_custom_field', { p_input: input }) }
export function listLibraryFiles(search = '') { return rpc<LibraryFile[]>('rpc_cmms_file_library', { p_search: search.trim() || null, p_entity_type: null, p_entity_id: null }) }
export function registerLibraryFile(input: { fileName: string; bucket: string; path: string; mimeType?: string; size?: number; description?: string; tags?: string[]; entityType?: string; entityId?: string }) { return rpc<{ fileId: string }>('rpc_cmms_register_file', { p_input: input }) }
export function listFloorPlans(locationId: string) { return rpc<FloorPlan[]>('rpc_cmms_floor_plans', { p_location_id: locationId }) }
export function saveFloorPlan(input: { locationId: string; name: string; bucket: string; path: string }) { return rpc<{ floorPlanId: string }>('rpc_cmms_save_floor_plan', { p_input: input }) }
export function addFloorPlanPin(input: { floorPlanId: string; equipmentId?: string; label?: string; x: number; y: number; color?: string }) { return rpc<{ pinId: string }>('rpc_cmms_add_floor_plan_pin', { p_input: input }) }
export function listDowntime(equipmentId: string) { return rpc<DowntimeEvent[]>('rpc_cmms_downtime_history', { p_equipment_id: equipmentId }) }
export function setDowntime(input: { equipmentId: string; action: 'START' | 'STOP'; reason?: string; workOrderId?: string }) { return rpc<{ downtimeId: string; action: string }>('rpc_cmms_set_downtime', { p_input: input }) }

export async function listEquipmentOptions(): Promise<EquipmentOption[]> {
  const { data, error } = await supabase.from('equipment_master').select('equipment_id,equipment_name,status').order('equipment_name', { ascending: true }).limit(500)
  if (error) throw new Error(error.message || 'Không tải được thiết bị.')
  return (data || []).map((row) => ({ id: String(row.equipment_id || ''), name: String(row.equipment_name || row.equipment_id || ''), status: String(row.status || '') }))
}

export async function uploadImageArtifact(uri: string, prefix: string, mimeType = 'image/jpeg') {
  const response = await fetch(uri)
  const bytes = await response.arrayBuffer()
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const path = `core-parity/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  const bucket = 'work-order-attachments'
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: mimeType, upsert: false })
  if (error) throw new Error(error.message || 'Không tải được tệp lên storage.')
  return { bucket, path, size: bytes.byteLength }
}

export async function getSignedFileUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error) return ''
  return data.signedUrl || ''
}
