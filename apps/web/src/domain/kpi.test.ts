import { describe, expect, it } from 'vitest'
import { calculateDowntimeKpi, getDowntimeMinutes } from './kpi'

describe('BM-TBSX-06 downtime KPI', () => {
  it('derives downtime from timestamps when explicit minutes are missing', () => {
    expect(getDowntimeMinutes({
      downAt: '2026-08-28T01:00:00.000Z',
      restoredAt: '2026-08-28T01:45:00.000Z',
    })).toBe(45)
  })

  it('calculates MTBF, MTTR and downtime rate using the source formula', () => {
    const kpi = calculateDowntimeKpi([
      { downAt: '2026-08-04T01:00:00.000Z', downtimeMinutes: 60 },
      { downAt: '2026-08-07T01:00:00.000Z', downtimeMinutes: 60 },
    ], 30)

    expect(kpi.runtimeMinutes).toBe(43_200)
    expect(kpi.downtimeMinutes).toBe(120)
    expect(kpi.failureCount).toBe(2)
    expect(kpi.mtbfMinutes).toBe(21_540)
    expect(kpi.mttrMinutes).toBe(60)
    expect(kpi.downtimeRate).toBeCloseTo(120 / 43_200)
  })

  it('returns null MTBF/MTTR when no failures exist', () => {
    const kpi = calculateDowntimeKpi([], 30)
    expect(kpi.mtbfMinutes).toBeNull()
    expect(kpi.mttrMinutes).toBeNull()
    expect(kpi.downtimeRate).toBe(0)
  })
})
