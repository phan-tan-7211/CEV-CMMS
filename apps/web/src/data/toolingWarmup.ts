import { loadLiveTooling } from './liveTooling'

const WARM_INTERVAL_MS = 30_000
let lastWarmAt = 0
let inflight: Promise<unknown> | null = null

function warmTooling(force = false) {
  const now = Date.now()
  if (!force && now - lastWarmAt < WARM_INTERVAL_MS) return inflight || Promise.resolve()
  if (inflight) return inflight
  lastWarmAt = now
  inflight = loadLiveTooling({ force: true }).catch(() => undefined).finally(() => { inflight = null })
  return inflight
}

export function installToolingWarmup() {
  const idle = window.requestIdleCallback
    ? window.requestIdleCallback(() => void warmTooling())
    : window.setTimeout(() => void warmTooling(), 1200)

  const onVisible = () => { if (document.visibilityState === 'visible') void warmTooling() }
  const onFocus = () => void warmTooling()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)

  return () => {
    if (window.cancelIdleCallback && typeof idle === 'number') window.cancelIdleCallback(idle)
    else window.clearTimeout(idle as number)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
  }
}
