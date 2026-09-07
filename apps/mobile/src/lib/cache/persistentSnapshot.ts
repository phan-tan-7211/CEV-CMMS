import AsyncStorage from '@react-native-async-storage/async-storage'

export type CacheEnvelope<T> = {
  version: number
  savedAt: number
  data: T
}

export async function readPersistentSnapshot<T>(
  key: string,
  version: number,
  maxAgeMs: number,
): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (parsed.version !== version || !Number.isFinite(parsed.savedAt)) return null
    if (Date.now() - parsed.savedAt > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}

export async function writePersistentSnapshot<T>(key: string, version: number, data: T) {
  const envelope: CacheEnvelope<T> = {
    version,
    savedAt: Date.now(),
    data,
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // Persistence is a performance layer. Network reads remain authoritative.
  }
  return envelope
}

export async function removePersistentSnapshot(key: string) {
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    // Cache invalidation should not make the feature unusable.
  }
}
