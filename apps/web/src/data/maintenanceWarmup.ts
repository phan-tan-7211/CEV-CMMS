import { loadLiveMaintenance } from './liveMaintenance'

let warmupPromise: Promise<void> | null = null
let lastWarmupAt = 0
const MIN_WARMUP_INTERVAL_MS = 30_000

export function warmMaintenanceCache(force = false) {
  const now = Date.now()
  if (!force && now - lastWarmupAt < MIN_WARMUP_INTERVAL_MS) return warmupPromise || Promise.resolve()
  if (warmupPromise) return warmupPromise

  lastWarmupAt = now
  warmupPromise = loadLiveMaintenance({ force })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { warmupPromise = null })
  return warmupPromise
}

export function installMaintenanceWarmup() {
  if (typeof window === 'undefined') return () => undefined

  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => { void warmMaintenanceCache(true) }, { timeout: 1800 })
      return () => window.cancelIdleCallback(id)
    }
    const id = globalThis.setTimeout(() => { void warmMaintenanceCache(true) }, 700)
    return () => globalThis.clearTimeout(id)
  }

  const cancelScheduled = schedule()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void warmMaintenanceCache(true)
  }
  const onFocus = () => { void warmMaintenanceCache(true) }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)

  return () => {
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
  }
}
