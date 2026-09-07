import { isClientCacheFresh } from './clientDataCache'
import { dataGateway } from './dataGateway'
import { invalidateCalibrationLogs } from './liveCalibration'

export type CalibrationEvaluationRow = {
  calibrationLogId: string
  equipmentId: string
  calibrationDate: string
  calibrationResult: string
  provider: string
  evaluationResult: string
  evaluationNote: string
  evaluatedBy: string
  evaluatedAt: string
}

const FRESH_MS = 60_000
let cache: { savedAt: number; rows: CalibrationEvaluationRow[] } | null = null
let inFlight: Promise<CalibrationEvaluationRow[]> | null = null

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export function getCalibrationEvaluationSnapshot() {
  return cache ? [...cache.rows] : []
}

async function fetchRows() {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const { data, error } = await dataGateway.readRows('calibration_log', { order: { column: 'calibration_date', ascending: false }, limit: 150 })
    if (error) throw error
    const rows = data.map((row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      return {
        calibrationLogId: text(row.calibration_log_id), equipmentId: text(row.equipment_id), calibrationDate: text(row.calibration_date), calibrationResult: text(row.result), provider: text(source.provider), evaluationResult: text(source.evaluationResult), evaluationNote: text(source.evaluationNote), evaluatedBy: text(source.evaluatedBy), evaluatedAt: text(source.evaluatedAt),
      }
    })
    cache = { savedAt: Date.now(), rows }
    return rows
  })().finally(() => { inFlight = null })
  return inFlight
}

export async function loadCalibrationEvaluations(options: { force?: boolean } = {}) {
  if (!options.force && cache && isClientCacheFresh(cache.savedAt, FRESH_MS)) return cache.rows
  try { return await fetchRows() } catch (cause) { if (cache) return cache.rows; throw cause }
}

export async function evaluateCalibration(input: { calibrationLogId: string; equipmentId: string; result: 'PASS' | 'FAIL' | 'LIMITED_USE'; note: string }) {
  const { error } = await dataGateway.rpc('rpc_evaluate_calibration', {
    p_calibration_log_id: input.calibrationLogId,
    p_evaluation_result: input.result,
    p_evaluation_note: input.note.trim(),
  })
  if (error) throw error
  if (cache) {
    cache = {
      savedAt: Date.now(),
      rows: cache.rows.map((row) => row.calibrationLogId === input.calibrationLogId ? { ...row, evaluationResult: input.result, evaluationNote: input.note.trim(), evaluatedAt: new Date().toISOString() } : row),
    }
  }
  invalidateCalibrationLogs(input.equipmentId)
  void loadCalibrationEvaluations({ force: true }).catch(() => undefined)
}
