import { loadLiveCalibration } from './liveCalibration'

const WARMUP_INTERVAL_MS = 30_000
let installed = false
let lastRunAt = 0
let inFlight: Promise<unknown> | null = null

function warmCalibration() {
  if (inFlight) return inFlight
  const now = Date.now()
  if (now - lastRunAt < WARMUP_INTERVAL_MS) return Promise.resolve()
  lastRunAt = now
  inFlight = loadLiveCalibration({ force: true }).catch(() => undefined).finally(() => { inFlight = null })
  return inFlight
}

export function installCalibrationWarmup() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return
  installed = true
  const run = () => { void warmCalibration() }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run)
  else globalThis.setTimeout(run, 1200)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run() })
  window.addEventListener('focus', run)
}
