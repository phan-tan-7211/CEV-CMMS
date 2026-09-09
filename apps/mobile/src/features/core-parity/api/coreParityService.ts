import { supabase } from '../../../lib/supabase/client'

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || `Không thực hiện được ${name}.`)
  return data as T
}

export type ChecklistItem = { itemId?: string; sequenceNo?: number; itemType: string; label: string; description?: string; required?: boolean; unit?: string; minValue?: number | null; maxValue?: number | null; choices?: string[] }
export type ChecklistTemplate = { templateId: string; name: string; description: string; active: boolean; items: ChecklistItem[] }
export type CustomFieldDefinition = { fieldId: string; entityType: string; label: string; fieldType: string; required: boolean; choices: string[]; sortOrder: number }
export type CustomFieldValueRow = CustomFieldDefinition & { value: unknown }
export type CustomFieldDraftValue = { fieldId: string; value: unknown }
export type LibraryFile = { fileId: string; fileName: string; bucket: string; path: string; mimeType: string; size?: number; description: string; tags: string[]; createdAt: string; links: Array<{ entityType: string; entityId: string }> }
export type FloorPlanPin = { pinId: string; equipmentId?: string; label: string; x: number; y: number; color: string }
export type FloorPlan = { floorPlanId: string; locationId: string; name: string; bucket: string; path: string; pins: FloorPlanPin[] }
export type DowntimeEvent = { downtimeId: string; equipmentId: string; workOrderId?: string; startedAt?: string; endedAt?: string; reason: string; durationMinutes: number }
export type EquipmentOption = { id: string; name: string; status: string }
export type ImportResult = { entityType: string; successCount: number; failedCount: number; items: Array<{ row: number; ok: boolean; error?: string; result?: Record<string, unknown> }> }
export type ExportEntityType = 'ASSET' | 'PART' | 'LOCATION' | 'METER' | 'WORK_ORDER'

export function listChecklistTemplates(search = '') { return rpc<ChecklistTemplate[]>('rpc_cmms_checklist_templates', { p_search: search.trim() || null }) }
export function saveChecklistTemplate(input: { templateId?: string; name: string; description?: string; items: ChecklistItem[] }) { return rpc<{ templateId: string }>('rpc_cmms_save_checklist_template', { p_input: input }) }
export function listCustomFields(entityType: string) { return rpc<CustomFieldDefinition[]>('rpc_cmms_custom_fields', { p_entity_type: entityType }) }
export function saveCustomField(input: { fieldId?: string; entityType: string; label: string; fieldType: string; required?: boolean; choices?: string[]; sortOrder?: number }) { return rpc<{ fieldId: string }>('rpc_cmms_save_custom_field', { p_input: input }) }
export function listEntityCustomValues(entityType: string, entityId: string) { return rpc<CustomFieldValueRow[]>('rpc_cmms_entity_custom_values', { p_entity_type: entityType, p_entity_id: entityId }) }
export function saveEntityCustomValues(entityType: string, entityId: string, values: CustomFieldDraftValue[]) { return rpc<{ savedCount: number }>('rpc_cmms_save_custom_field_values', { p_entity_type: entityType, p_entity_id: entityId, p_values: values }) }
export function listLibraryFiles(search = '', entityType?: string, entityId?: string) { return rpc<LibraryFile[]>('rpc_cmms_file_library', { p_search: search.trim() || null, p_entity_type: entityType || null, p_entity_id: entityId || null }) }
export function registerLibraryFile(input: { fileName: string; bucket: string; path: string; mimeType?: string; size?: number; description?: string; tags?: string[]; entityType?: string; entityId?: string }) { return rpc<{ fileId: string }>('rpc_cmms_register_file', { p_input: input }) }
export function listFloorPlans(locationId: string) { return rpc<FloorPlan[]>('rpc_cmms_floor_plans', { p_location_id: locationId }) }
export function saveFloorPlan(input: { locationId: string; name: string; bucket: string; path: string }) { return rpc<{ floorPlanId: string }>('rpc_cmms_save_floor_plan', { p_input: input }) }
export function addFloorPlanPin(input: { floorPlanId: string; equipmentId?: string; label?: string; x: number; y: number; color?: string }) { return rpc<{ pinId: string }>('rpc_cmms_add_floor_plan_pin', { p_input: input }) }
export function listDowntime(equipmentId: string) { return rpc<DowntimeEvent[]>('rpc_cmms_downtime_history', { p_equipment_id: equipmentId }) }
export function setDowntime(input: { equipmentId: string; action: 'START' | 'STOP'; reason?: string; workOrderId?: string }) { return rpc<{ downtimeId: string; action: string }>('rpc_cmms_set_downtime', { p_input: input }) }
export function exportDataset(entityType: ExportEntityType) { return rpc<Array<Record<string, unknown>>>('rpc_cmms_export_dataset', { p_entity_type: entityType }) }
export function importDataset(entityType: ExportEntityType, rows: Array<Record<string, unknown>>) { return rpc<ImportResult>('rpc_cmms_import_dataset', { p_entity_type: entityType, p_rows: rows }) }

export async function listEquipmentOptions(): Promise<EquipmentOption[]> {
  const { data, error } = await supabase.from('equipment_master').select('equipment_id,equipment_name,status').is('archived_at', null).eq('active', true).order('equipment_name', { ascending: true }).limit(500)
  if (error) throw new Error(error.message || 'Không tải được thiết bị.')
  return (data || []).map((row) => ({ id: String(row.equipment_id || ''), name: String(row.equipment_name || row.equipment_id || ''), status: String(row.status || '') }))
}

function extensionFromName(name: string, mimeType: string) {
  const clean = name.trim()
  const dot = clean.lastIndexOf('.')
  if (dot > -1 && dot < clean.length - 1) return clean.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xlsx'
  if (mimeType.includes('csv')) return 'csv'
  return 'bin'
}

export async function uploadFileArtifact(uri: string, prefix: string, fileName: string, mimeType = 'application/octet-stream') {
  const response = await fetch(uri)
  if (!response.ok) throw new Error('Không đọc được tệp đã chọn.')
  const bytes = await response.arrayBuffer()
  const ext = extensionFromName(fileName, mimeType)
  const safeBase = (fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'file')
  const path = `core-parity/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeBase}.${ext}`
  const bucket = 'work-order-attachments'
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: mimeType, upsert: false })
  if (error) throw new Error(error.message || 'Không tải được tệp lên storage.')
  return { bucket, path, size: bytes.byteLength }
}

export function uploadImageArtifact(uri: string, prefix: string, mimeType = 'image/jpeg') {
  return uploadFileArtifact(uri, prefix, `image.${extensionFromName('', mimeType)}`, mimeType)
}

export async function getSignedFileUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error) return ''
  return data.signedUrl || ''
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return ''
  const keys = Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((key) => set.add(key)); return set }, new Set<string>()))
  const cell = (value: unknown) => {
    const raw = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
  }
  return [keys.map(cell).join(','), ...rows.map((row) => keys.map((key) => cell(row[key])).join(','))].join('\n')
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      continue
    }
    cell += char
  }
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  const headers = (rows.shift() || []).map((value) => value.trim())
  if (!headers.length) return []
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}