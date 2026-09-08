import { loadLiveDashboard } from './liveDashboard'

const MIN_INTERVAL_MS = 30_000
let lastRunAt = 0
let inFlight: Promise<unknown> | null = null

function runWarmup() {
  const now = Date.now()
  if (inFlight || now - lastRunAt < MIN_INTERVAL_MS) return
  lastRunAt = now
  inFlight = loadLiveDashboard(new Date().toISOString().slice(0, 10), { force: true })
    .catch(() => undefined)
    .finally(() => { inFlight = null })
}

export function installDashboardWarmup() {
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => runWarmup(), { timeout: 1800 })
    else globalThis.setTimeout(runWarmup, 600)
  }
  schedule()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runWarmup() })
  window.addEventListener('focus', runWarmup)
}
