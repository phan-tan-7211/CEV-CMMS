import type { DowntimeEvent } from './models'

export type DowntimeKpi = {
  runtimeMinutes: number
  downtimeMinutes: number
  failureCount: number
  mtbfMinutes: number | null
  mttrMinutes: number | null
  downtimeRate: number
}

export function getDowntimeMinutes(event: Pick<DowntimeEvent, 'downAt' | 'restoredAt' | 'downtimeMinutes'>): number {
  if (typeof event.downtimeMinutes === 'number') return event.downtimeMinutes
  if (!event.restoredAt) return 0
  const started = new Date(event.downAt).getTime()
  const restored = new Date(event.restoredAt).getTime()
  return Math.max(0, Math.round((restored - started) / 60_000))
}

export function calculateDowntimeKpi(
  events: Array<Pick<DowntimeEvent, 'downAt' | 'restoredAt' | 'downtimeMinutes'>>,
  recordedDays: number,
): DowntimeKpi {
  const runtimeMinutes = Math.max(0, recordedDays) * 24 * 60
  const downtimeMinutes = events.reduce((sum, event) => sum + getDowntimeMinutes(event), 0)
  const failureCount = events.length
  const effectiveRunMinutes = Math.max(0, runtimeMinutes - downtimeMinutes)

  return {
    runtimeMinutes,
    downtimeMinutes,
    failureCount,
    mtbfMinutes: failureCount > 0 ? effectiveRunMinutes / failureCount : null,
    mttrMinutes: failureCount > 0 ? downtimeMinutes / failureCount : null,
    downtimeRate: runtimeMinutes > 0 ? downtimeMinutes / runtimeMinutes : 0,
  }
}

export const DOWNTIME_TARGET_RATE = 0.08
