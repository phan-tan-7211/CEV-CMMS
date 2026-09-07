import AsyncStorage from '@react-native-async-storage/async-storage'

import { supabase } from '../supabase'

const PHOTO_BUCKET = 'equipment-photos'
const PHOTO_FILE_NAME = 'photo.webp'
const CACHE_KEY = 'cev:data:mobile:equipment-photo-urls:v1'
const CACHE_VERSION = 1
const SIGNED_URL_SECONDS = 6 * 60 * 60
const CLIENT_TTL_MS = 5.5 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 600

type PhotoCacheEntry = {
  url: string
  expiresAt: number
  touchedAt: number
}

type PhotoCacheEnvelope = {
  version: number
  savedAt: number
  entries: Record<string, PhotoCacheEntry>
}

let memoryCache: Record<string, PhotoCacheEntry> | null = null
let cacheHydration: Promise<Record<string, PhotoCacheEntry>> | null = null

function normalizeEquipmentId(value: string) {
  return value.trim()
}

function photoPath(equipmentId: string) {
  return `${equipmentId}/${PHOTO_FILE_NAME}`
}

function isUsable(entry: PhotoCacheEntry | undefined, now: number) {
  return Boolean(entry?.url && entry.expiresAt > now)
}

function trimCache(entries: Record<string, PhotoCacheEntry>) {
  const ordered = Object.entries(entries)
    .sort(([, left], [, right]) => right.touchedAt - left.touchedAt)
    .slice(0, MAX_CACHE_ENTRIES)
  return Object.fromEntries(ordered)
}

async function hydrateCache() {
  if (memoryCache) return memoryCache
  if (cacheHydration) return cacheHydration

  cacheHydration = AsyncStorage.getItem(CACHE_KEY)
    .then((raw) => {
      if (!raw) return {}
      try {
        const parsed = JSON.parse(raw) as PhotoCacheEnvelope
        if (parsed.version !== CACHE_VERSION || !parsed.entries) return {}
        const now = Date.now()
        return trimCache(Object.fromEntries(
          Object.entries(parsed.entries).filter(([, entry]) => isUsable(entry, now)),
        ))
      } catch {
        return {}
      }
    })
    .catch(() => ({}))
    .then((entries) => {
      memoryCache = entries
      return entries
    })
    .finally(() => {
      cacheHydration = null
    })

  return cacheHydration
}

async function persistCache(entries: Record<string, PhotoCacheEntry>) {
  const bounded = trimCache(entries)
  memoryCache = bounded
  const envelope: PhotoCacheEnvelope = {
    version: CACHE_VERSION,
    savedAt: Date.now(),
    entries: bounded,
  }
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(envelope))
  } catch {
    // Image URL persistence is a performance enhancement; image loading remains usable without it.
  }
}

export async function getEquipmentPhotoUrls(equipmentIds: string[]) {
  const ids = Array.from(new Set(equipmentIds.map(normalizeEquipmentId).filter(Boolean)))
  if (ids.length === 0) return {} as Record<string, string>

  const cache = await hydrateCache()
  const now = Date.now()
  const result: Record<string, string> = {}
  const missing: string[] = []

  for (const equipmentId of ids) {
    const entry = cache[equipmentId]
    if (isUsable(entry, now)) {
      result[equipmentId] = entry.url
      entry.touchedAt = now
    } else {
      missing.push(equipmentId)
    }
  }

  if (missing.length === 0) return result

  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const { data, error } = await bucket.createSignedUrls(missing.map(photoPath), SIGNED_URL_SECONDS)

  if (!error && data) {
    const nextCache = { ...cache }
    data.forEach((signed, index) => {
      const equipmentId = missing[index]
      const url = signed?.signedUrl || ''
      if (!equipmentId || !url || signed?.error) return
      result[equipmentId] = url
      nextCache[equipmentId] = {
        url,
        expiresAt: now + CLIENT_TTL_MS,
        touchedAt: now,
      }
    })
    await persistCache(nextCache)
  }

  return result
}

export async function getEquipmentPhotoUrl(equipmentId: string) {
  const normalizedId = normalizeEquipmentId(equipmentId)
  if (!normalizedId) return ''
  const urls = await getEquipmentPhotoUrls([normalizedId])
  return urls[normalizedId] || ''
}
