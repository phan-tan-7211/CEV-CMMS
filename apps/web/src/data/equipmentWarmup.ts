import { loadSupabaseEquipment } from './supabaseEquipment'

let warmupPromise: Promise<void> | null = null
let lastWarmupAt = 0
const MIN_WARMUP_INTERVAL_MS = 30_000

export function warmEquipmentCache(force = false) {
  const now = Date.now()
  if (now - lastWarmupAt < MIN_WARMUP_INTERVAL_MS) return warmupPromise || Promise.resolve()
  if (warmupPromise) return warmupPromise

  lastWarmupAt = now
  warmupPromise = loadSupabaseEquipment({ force })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { warmupPromise = null })
  return warmupPromise
}

export function installEquipmentWarmup() {
  if (typeof window === 'undefined') return () => undefined

  const schedule = () => {
    const run = () => { void warmEquipmentCache(true) }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }
    const id = globalThis.setTimeout(run, 350)
    return () => globalThis.clearTimeout(id)
  }

  const cancelScheduled = schedule()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void warmEquipmentCache(true)
  }
  const onFocus = () => { void warmEquipmentCache(true) }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)

  return () => {
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
  }
}
