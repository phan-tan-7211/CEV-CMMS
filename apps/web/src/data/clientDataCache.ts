type CacheEnvelope<T> = {
  version: number
  savedAt: number
  data: T
}

const memory = new Map<string, CacheEnvelope<unknown>>()

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readClientCache<T>(key: string, version: number): CacheEnvelope<T> | null {
  const inMemory = memory.get(key) as CacheEnvelope<T> | undefined
  if (inMemory?.version === version) return inMemory
  if (!storageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || parsed.version !== version || typeof parsed.savedAt !== 'number') {
      window.localStorage.removeItem(key)
      return null
    }
    memory.set(key, parsed as CacheEnvelope<unknown>)
    return parsed
  } catch {
    return null
  }
}

export function writeClientCache<T>(key: string, version: number, data: T) {
  const envelope: CacheEnvelope<T> = { version, savedAt: Date.now(), data }
  memory.set(key, envelope as CacheEnvelope<unknown>)
  if (!storageAvailable()) return envelope
  try { window.localStorage.setItem(key, JSON.stringify(envelope)) } catch { /* memory cache still works */ }
  return envelope
}

export function clearClientCache(key: string) {
  memory.delete(key)
  if (!storageAvailable()) return
  try { window.localStorage.removeItem(key) } catch { /* noop */ }
}

export function isClientCacheFresh(savedAt: number, maxAgeMs: number) {
  return Date.now() - savedAt <= maxAgeMs
}
