import type { LiveEquipment } from './liveEquipment'
import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { supabase } from './supabaseClient'

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

function sourceText(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return ''
  const value = (source as Record<string, unknown>)[key]
  return value === null || value === undefined ? '' : String(value).trim()
}

function sourceObject(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return {} as Record<string, unknown>
  const value = (source as Record<string, unknown>)[key]
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function sourceBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'boolean' ? value : undefined
}

export type EquipmentEditInput = {
  oldEquipmentId: string
  equipmentId: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  department: string
  model: string
  serialNumber: string
  status: string
}

export type EquipmentPhotoPreview = { exists: boolean; path: string; signedUrl: string }
export type EquipmentHistory = {
  calibration: Array<Record<string, unknown>>
  maintenance: Array<Record<string, unknown>>
  inspections: Array<Record<string, unknown>>
  downtime: Array<Record<string, unknown>>
  movements: Array<Record<string, unknown>>
  audit: Array<Record<string, unknown>>
}

type EquipmentCachePatch = Partial<LiveEquipment> & { equipmentId: string; department?: string }
const EQUIPMENT_CACHE_KEY = 'cev:data:equipment-master'
const EQUIPMENT_CACHE_VERSION = 1
const EQUIPMENT_CACHE_FRESH_MS = 30_000
const restoredEquipmentCache = readClientCache<LiveEquipment[]>(EQUIPMENT_CACHE_KEY, EQUIPMENT_CACHE_VERSION)
let equipmentCache: LiveEquipment[] | null = restoredEquipmentCache?.data || null
let equipmentCacheSavedAt = restoredEquipmentCache?.savedAt || 0
let consumeEquipmentCacheOnce = false

function persistEquipmentCache() {
  if (!equipmentCache) return
  const saved = writeClientCache(EQUIPMENT_CACHE_KEY, EQUIPMENT_CACHE_VERSION, equipmentCache)
  equipmentCacheSavedAt = saved.savedAt
}

export function getEquipmentCacheSnapshot(): LiveEquipment[] {
  return equipmentCache ? [...equipmentCache] : []
}

export function patchEquipmentCacheAfterWrite(patch: EquipmentCachePatch) {
  if (!equipmentCache) return
  const equipmentId = patch.equipmentId.trim().toUpperCase()
  equipmentCache = equipmentCache.map((row) => row.equipmentId === equipmentId ? {
    ...row,
    ...patch,
    equipmentId,
    usingDepartment: patch.department ?? patch.usingDepartment ?? row.usingDepartment,
    updatedAt: new Date().toISOString(),
  } : row)
  persistEquipmentCache()
  consumeEquipmentCacheOnce = true
}

export function patchEquipmentCacheAfterBulk(equipmentIds: string[], patch: Record<string, unknown>) {
  if (!equipmentCache) return
  const ids = new Set(equipmentIds.map((id) => id.trim().toUpperCase()).filter(Boolean))
  equipmentCache = equipmentCache.map((row) => {
    if (!ids.has(row.equipmentId)) return row
    return {
      ...row,
      usingDepartment: typeof patch.department === 'string' ? patch.department : row.usingDepartment,
      managingDepartment: typeof patch.managingDepartment === 'string' ? patch.managingDepartment : row.managingDepartment,
      currentArea: typeof patch.currentArea === 'string' ? patch.currentArea : row.currentArea,
      currentLine: typeof patch.currentLine === 'string' ? patch.currentLine : row.currentLine,
      equipmentCategory: typeof patch.equipmentCategory === 'string' ? patch.equipmentCategory : row.equipmentCategory,
      status: typeof patch.status === 'string' ? patch.status : row.status,
      updatedAt: new Date().toISOString(),
    }
  })
  persistEquipmentCache()
  consumeEquipmentCacheOnce = true
}

export function removeEquipmentFromCache(equipmentId: string) {
  if (!equipmentCache) return
  const id = equipmentId.trim().toUpperCase()
  equipmentCache = equipmentCache.filter((row) => row.equipmentId !== id)
  persistEquipmentCache()
  consumeEquipmentCacheOnce = true
}

export async function loadSupabaseEquipment(options: { force?: boolean } = {}): Promise<LiveEquipment[]> {
  if (!options.force && consumeEquipmentCacheOnce && equipmentCache) {
    consumeEquipmentCacheOnce = false
    return equipmentCache
  }
  if (!options.force && equipmentCache && isClientCacheFresh(equipmentCacheSavedAt, EQUIPMENT_CACHE_FRESH_MS)) return equipmentCache

  const client = requireSupabase()
  const { data, error } = await client.from('equipment_master').select('equipment_id,equipment_type,equipment_name,manufacturer,model,serial_number,department,status,active,qr_code,updated_at,source_data').order('equipment_id')
  if (error) {
    if (equipmentCache) return equipmentCache
    throw new Error(`SUPABASE_EQUIPMENT_READ_FAILED: ${error.message}`)
  }
  equipmentCache = (data || []).map((row) => {
    const source = row.source_data
    const criticalityFacts = sourceObject(source, 'criticalityFacts')
    return {
      equipmentId: String(row.equipment_id || ''),
      equipmentName: String(row.equipment_name || row.equipment_id || ''),
      equipmentType: row.equipment_type as LiveEquipment['equipmentType'],
      equipmentCategory: sourceText(source, 'equipmentCategory'),
      manufacturer: String(row.manufacturer || ''),
      model: String(row.model || ''),
      serialNumber: String(row.serial_number || ''),
      currentArea: sourceText(source, 'currentArea'),
      currentLine: sourceText(source, 'currentLine'),
      managingDepartment: sourceText(source, 'managingDepartment'),
      usingDepartment: String(row.department || sourceText(source, 'usingDepartment')),
      technicalSpecification: sourceText(source, 'technicalSpecification'),
      description: sourceText(source, 'description'),
      accuracy: sourceText(source, 'accuracy'),
      origin: sourceText(source, 'origin') || sourceText(source, 'countryOfOrigin'),
      manufactureDate: sourceText(source, 'manufactureDate'),
      inServiceDate: sourceText(source, 'inServiceDate'),
      warrantyUntil: sourceText(source, 'warrantyUntil'),
      warrantyContact: sourceText(source, 'warrantyContact'),
      note: sourceText(source, 'note'),
      relatedDocuments: sourceText(source, 'relatedDocuments'),
      status: String(row.status || 'UNKNOWN'),
      criticality: sourceText(source, 'criticality'),
      criticalityFacts: {
        controlsProductQuality: sourceBoolean(criticalityFacts, 'controlsProductQuality'),
        specialCharacteristicImpact: sourceBoolean(criticalityFacts, 'specialCharacteristicImpact'),
        stopsProduction: sourceBoolean(criticalityFacts, 'stopsProduction'),
        hasBackup: sourceBoolean(criticalityFacts, 'hasBackup'),
        capacityImpact: sourceBoolean(criticalityFacts, 'capacityImpact'),
      },
      qrCode: String(row.qr_code || row.equipment_id || ''),
      active: Boolean(row.active),
      updatedAt: String(row.updated_at || ''),
    }
  })
  persistEquipmentCache()
  return equipmentCache
}

export async function loadEquipmentHistory(equipmentId: string): Promise<EquipmentHistory> {
  const client = requireSupabase()
  const id = equipmentId.trim()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')
  const [calibration, maintenance, inspections, downtime, movements, audit] = await Promise.all([
    client.from('calibration_log').select('calibration_log_id,calibration_date,next_due_date,result,actor_email,created_at,source_data').eq('equipment_id', id).order('calibration_date', { ascending: false }).limit(50),
    client.from('maintenance_work_order').select('work_order_id,status,priority,reason,source_type,source_id,created_by,created_at,updated_at,source_data').eq('equipment_id', id).order('created_at', { ascending: false }).limit(50),
    client.from('daily_inspection').select('inspection_id,inspection_date,shift,area,overall_mark,note,actor_email,created_at,source_data').eq('equipment_id', id).order('inspection_date', { ascending: false }).limit(50),
    client.from('downtime_event').select('downtime_id,work_order_id,started_at,ended_at,created_at,source_data').eq('equipment_id', id).order('started_at', { ascending: false }).limit(50),
    client.from('equipment_movement_log').select('movement_id,from_location,to_location,actor_email,created_at,source_data').eq('equipment_id', id).order('created_at', { ascending: false }).limit(50),
    client.from('audit_log').select('audit_id,entity_type,entity_id,action,actor_email,detail,created_at').eq('equipment_id', id).order('created_at', { ascending: false }).limit(50),
  ])
  const failures = [calibration, maintenance, inspections, downtime, movements, audit].filter((result) => result.error)
  if (failures.length > 0) throw new Error(`SUPABASE_EQUIPMENT_HISTORY_FAILED: ${failures[0].error?.message}`)
  return {
    calibration: (calibration.data || []) as Array<Record<string, unknown>>,
    maintenance: (maintenance.data || []) as Array<Record<string, unknown>>,
    inspections: (inspections.data || []) as Array<Record<string, unknown>>,
    downtime: (downtime.data || []) as Array<Record<string, unknown>>,
    movements: (movements.data || []) as Array<Record<string, unknown>>,
    audit: (audit.data || []) as Array<Record<string, unknown>>,
  }
}

const PHOTO_BUCKET = 'equipment-photos'
const EQUIPMENT_PHOTO_NAME = 'photo.webp'

async function preparePhotoIdMigration(oldEquipmentId: string, newEquipmentId: string) {
  const client = requireSupabase()
  const oldId = oldEquipmentId.trim(); const newId = newEquipmentId.trim()
  if (!oldId || !newId || oldId === newId) return [] as string[]
  const [oldResult, newResult] = await Promise.all([client.storage.from(PHOTO_BUCKET).list(oldId, { limit: 100 }), client.storage.from(PHOTO_BUCKET).list(newId, { limit: 100 })])
  if (oldResult.error) throw new Error(`SUPABASE_PHOTO_ID_MIGRATION_SOURCE_FAILED: ${oldResult.error.message}`)
  if (newResult.error) throw new Error(`SUPABASE_PHOTO_ID_MIGRATION_TARGET_FAILED: ${newResult.error.message}`)
  const sourceFiles = oldResult.data || []; const targetFiles = newResult.data || []
  if (targetFiles.length > 0) throw new Error(`EQUIPMENT_NEW_ID_PHOTO_CONFLICT: ${newId}`)
  if (sourceFiles.length === 0) return [] as string[]
  const copiedPaths: string[] = []
  try {
    for (const file of sourceFiles) { const sourcePath = `${oldId}/${file.name}`; const targetPath = `${newId}/${file.name}`; const { error } = await client.storage.from(PHOTO_BUCKET).copy(sourcePath, targetPath); if (error) throw new Error(`SUPABASE_PHOTO_ID_COPY_FAILED: ${error.message}`); copiedPaths.push(targetPath) }
    return copiedPaths
  } catch (cause) { if (copiedPaths.length > 0) await client.storage.from(PHOTO_BUCKET).remove(copiedPaths); throw cause }
}

async function finalizePhotoIdMigration(oldEquipmentId: string, newEquipmentId: string, copiedPaths: string[]) {
  if (copiedPaths.length === 0 || oldEquipmentId.trim() === newEquipmentId.trim()) return
  const client = requireSupabase(); const oldFiles = await listEquipmentPhotos(oldEquipmentId); const oldPaths = oldFiles.map((file) => `${oldEquipmentId.trim()}/${file.name}`)
  if (oldPaths.length === 0) return
  const { error } = await client.storage.from(PHOTO_BUCKET).remove(oldPaths)
  if (error) throw new Error(`SUPABASE_PHOTO_ID_CLEANUP_FAILED: ${error.message}`)
}
async function rollbackPreparedPhotoMigration(copiedPaths: string[]) { if (copiedPaths.length === 0) return; await requireSupabase().storage.from(PHOTO_BUCKET).remove(copiedPaths) }

export async function updateSupabaseEquipment(input: EquipmentEditInput) {
  const client = requireSupabase(); const oldEquipmentId = input.oldEquipmentId.trim(); const newEquipmentId = input.equipmentId.trim()
  const payload = { p_old_equipment_id: oldEquipmentId, p_equipment_id: newEquipmentId, p_equipment_type: input.equipmentType, p_equipment_name: input.equipmentName.trim(), p_model: input.model.trim(), p_serial_number: input.serialNumber.trim(), p_department: input.department.trim(), p_status: input.status.trim() || 'RUNNING' }
  const copiedPaths = await preparePhotoIdMigration(oldEquipmentId, newEquipmentId)
  const { error } = await client.rpc('admin_update_equipment', payload)
  if (error) { await rollbackPreparedPhotoMigration(copiedPaths); throw new Error(`SUPABASE_EQUIPMENT_SAVE_FAILED: ${error.message}`) }
  await finalizePhotoIdMigration(oldEquipmentId, newEquipmentId, copiedPaths)
}

const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024
const PHOTO_MAX_EDGE = 1280
const PHOTO_TARGET_BYTES = 700 * 1024
const PHOTO_INITIAL_QUALITY = 0.82
const PHOTO_MIN_QUALITY = 0.70

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) { return new Promise<Blob>((resolve, reject) => { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('IMAGE_COMPRESSION_FAILED')), 'image/webp', quality) }) }
async function loadImage(file: File) { const objectUrl = URL.createObjectURL(file); try { const image = new Image(); image.decoding = 'async'; image.src = objectUrl; await image.decode(); return image } finally { URL.revokeObjectURL(objectUrl) } }
async function optimizeEquipmentPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('IMAGE_FILE_REQUIRED')
  if (file.size > PHOTO_MAX_INPUT_BYTES) throw new Error('IMAGE_TOO_LARGE_MAX_25MB')
  const image = await loadImage(file); const sourceWidth = image.naturalWidth || image.width; const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('IMAGE_DIMENSIONS_INVALID')
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(sourceWidth, sourceHeight)); const width = Math.max(1, Math.round(sourceWidth * scale)); const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d', { alpha: true }); if (!context) throw new Error('IMAGE_CANVAS_UNAVAILABLE')
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(image, 0, 0, width, height)
  let quality = PHOTO_INITIAL_QUALITY; let blob = await canvasToBlob(canvas, quality)
  while (blob.size > PHOTO_TARGET_BYTES && quality > PHOTO_MIN_QUALITY) { quality = Math.max(PHOTO_MIN_QUALITY, quality - 0.04); blob = await canvasToBlob(canvas, quality) }
  return new File([blob], EQUIPMENT_PHOTO_NAME, { type: 'image/webp', lastModified: Date.now() })
}

export async function listEquipmentPhotos(equipmentId: string) { const client = requireSupabase(); const { data, error } = await client.storage.from(PHOTO_BUCKET).list(equipmentId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }); if (error) throw new Error(`SUPABASE_PHOTO_LIST_FAILED: ${error.message}`); return data || [] }
export async function getEquipmentPhotoPreview(equipmentId: string): Promise<EquipmentPhotoPreview> {
  const client = requireSupabase(); const normalizedId = equipmentId.trim(); if (!normalizedId) return { exists: false, path: '', signedUrl: '' }
  const files = await listEquipmentPhotos(normalizedId); const canonical = files.find((file) => file.name === EQUIPMENT_PHOTO_NAME); const selected = canonical || files[0]; if (!selected) return { exists: false, path: '', signedUrl: '' }
  const path = `${normalizedId}/${selected.name}`; const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600); if (error) throw new Error(`SUPABASE_PHOTO_URL_FAILED: ${error.message}`); return { exists: true, path, signedUrl: data.signedUrl }
}
export async function getEquipmentPhotoPreviews(equipmentIds: string[]): Promise<Record<string, EquipmentPhotoPreview>> {
  const client = requireSupabase(); const ids = Array.from(new Set(equipmentIds.map((id) => id.trim()).filter(Boolean))); if (ids.length === 0) return {}
  const { data: pathRows, error: pathError } = await client.rpc('rpc_equipment_photo_paths', { p_equipment_ids: ids }); if (pathError) throw new Error(`SUPABASE_PHOTO_BATCH_LOOKUP_FAILED: ${pathError.message}`)
  const pathById = new Map<string, string>(); for (const row of pathRows || []) { const id = String(row.equipment_id || ''); const path = String(row.path || ''); if (id && path) pathById.set(id, path) }
  const paths = Array.from(pathById.values()); const signedByPath = new Map<string, string>()
  if (paths.length > 0) { const { data: signedRows, error: signedError } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600); if (signedError) throw new Error(`SUPABASE_PHOTO_BATCH_URL_FAILED: ${signedError.message}`); for (const row of signedRows || []) if (row.path && row.signedUrl) signedByPath.set(row.path, row.signedUrl) }
  return Object.fromEntries(ids.map((id) => { const path = pathById.get(id) || ''; return [id, { exists: Boolean(path), path, signedUrl: path ? signedByPath.get(path) || '' : '' } satisfies EquipmentPhotoPreview] }))
}
export async function hasEquipmentPhoto(equipmentId: string) { return (await getEquipmentPhotoPreview(equipmentId)).exists }
export async function uploadEquipmentPhoto(equipmentId: string, file: File) {
  const client = requireSupabase(); const normalizedId = equipmentId.trim(); if (!normalizedId) throw new Error('EQUIPMENT_ID_REQUIRED')
  const optimizedFile = await optimizeEquipmentPhoto(file); const path = `${normalizedId}/${EQUIPMENT_PHOTO_NAME}`
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, optimizedFile, { cacheControl: '3600', upsert: true, contentType: 'image/webp' }); if (error) throw new Error(`SUPABASE_PHOTO_UPLOAD_FAILED: ${error.message}`)
  const files = await listEquipmentPhotos(normalizedId); const stalePaths = files.filter((item) => item.name !== EQUIPMENT_PHOTO_NAME).map((item) => `${normalizedId}/${item.name}`)
  if (stalePaths.length > 0) { const { error: removeError } = await client.storage.from(PHOTO_BUCKET).remove(stalePaths); if (removeError) throw new Error(`SUPABASE_PHOTO_CLEANUP_FAILED: ${removeError.message}`) }
  return path
}
