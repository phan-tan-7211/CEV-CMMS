import { loadSpareParts } from './liveSpareParts'

let warmupPromise: Promise<void> | null = null
let lastWarmupAt = 0
const MIN_WARMUP_INTERVAL_MS = 30_000

export function warmSpareCache(force = false) {
  const now = Date.now()
  if (!force && now - lastWarmupAt < MIN_WARMUP_INTERVAL_MS) return warmupPromise || Promise.resolve()
  if (warmupPromise) return warmupPromise

  lastWarmupAt = now
  warmupPromise = loadSpareParts({ force: true })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { warmupPromise = null })
  return warmupPromise
}

export function installSpareWarmup() {
  if (typeof window === 'undefined') return () => undefined

  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => { void warmSpareCache(false) }, { timeout: 1600 })
      return () => window.cancelIdleCallback(id)
    }
    const id = globalThis.setTimeout(() => { void warmSpareCache(false) }, 500)
    return () => globalThis.clearTimeout(id)
  }

  const cancelScheduled = schedule()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void warmSpareCache(false)
  }
  const onFocus = () => { void warmSpareCache(false) }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)

  return () => {
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
  }
}
