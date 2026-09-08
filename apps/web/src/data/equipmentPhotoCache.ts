import { readClientCache, writeClientCache } from './clientDataCache'
import { getEquipmentPhotoPreview, getEquipmentPhotoPreviews, type EquipmentPhotoPreview } from './supabaseEquipment'

type CachedPhoto = EquipmentPhotoPreview & { cachedAt: number }

const CACHE_KEY = 'cev:data:equipment-photo-previews'
const CACHE_VERSION = 1
const CACHE_TTL_MS = 45 * 60 * 1000
const restored = readClientCache<Record<string, CachedPhoto>>(CACHE_KEY, CACHE_VERSION)
let photoCache: Record<string, CachedPhoto> = restored?.data || {}

function persist() {
  writeClientCache(CACHE_KEY, CACHE_VERSION, photoCache)
}

function fresh(entry: CachedPhoto | undefined) {
  return Boolean(entry && Date.now() - entry.cachedAt < CACHE_TTL_MS)
}

export function getEquipmentPhotoCacheSnapshot(equipmentIds: string[] = []) {
  const ids = equipmentIds.length ? equipmentIds.map((id) => id.trim()).filter(Boolean) : Object.keys(photoCache)
  return Object.fromEntries(ids.flatMap((id) => {
    const entry = photoCache[id]
    return fresh(entry) ? [[id, { exists: entry.exists, path: entry.path, signedUrl: entry.signedUrl } satisfies EquipmentPhotoPreview]] : []
  }))
}

export function invalidateEquipmentPhotoCache(equipmentId: string) {
  const id = equipmentId.trim()
  if (!id || !photoCache[id]) return
  const next = { ...photoCache }
  delete next[id]
  photoCache = next
  persist()
}

export async function loadCachedEquipmentPhotoPreview(equipmentId: string, force = false): Promise<EquipmentPhotoPreview> {
  const id = equipmentId.trim()
  if (!id) return { exists: false, path: '', signedUrl: '' }
  const cached = photoCache[id]
  if (!force && fresh(cached)) return { exists: cached.exists, path: cached.path, signedUrl: cached.signedUrl }
  const preview = await getEquipmentPhotoPreview(id)
  photoCache = { ...photoCache, [id]: { ...preview, cachedAt: Date.now() } }
  persist()
  return preview
}

export async function loadCachedEquipmentPhotoPreviews(equipmentIds: string[], force = false): Promise<Record<string, EquipmentPhotoPreview>> {
  const ids = Array.from(new Set(equipmentIds.map((id) => id.trim()).filter(Boolean)))
  if (!ids.length) return {}

  const result: Record<string, EquipmentPhotoPreview> = {}
  const missing: string[] = []
  for (const id of ids) {
    const cached = photoCache[id]
    if (!force && fresh(cached)) result[id] = { exists: cached.exists, path: cached.path, signedUrl: cached.signedUrl }
    else missing.push(id)
  }

  if (missing.length) {
    const loaded = await getEquipmentPhotoPreviews(missing)
    const now = Date.now()
    const next = { ...photoCache }
    for (const id of missing) {
      const preview = loaded[id] || { exists: false, path: '', signedUrl: '' }
      result[id] = preview
      next[id] = { ...preview, cachedAt: now }
    }
    photoCache = next
    persist()
  }
  return result
}
