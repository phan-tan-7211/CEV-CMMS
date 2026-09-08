import { isClientCacheFresh } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type CalibrationQuoteRow = {
  quoteId: string
  equipmentId: string
  calibrationEquipmentId: string
  provider: string
  amountVnd: number
  sourceDate: string
  sourceDocument: string
  createdAt: string
}

const FRESH_MS = 60_000
let cache: { savedAt: number; rows: CalibrationQuoteRow[] } | null = null
let inFlight: Promise<CalibrationQuoteRow[]> | null = null

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function amount(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }

export function getCalibrationQuoteSnapshot() {
  return cache ? [...cache.rows] : []
}

async function fetchQuotes() {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const { data, error } = await dataGateway.readRows('calibration_vendor_quote', { order: { column: 'created_at', ascending: false } })
    if (error) throw error
    const rows = data.map((row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      return {
        quoteId: text(row.quote_id),
        equipmentId: text(row.equipment_id),
        calibrationEquipmentId: text(source.calibrationEquipmentId),
        provider: text(source.provider),
        amountVnd: amount(source.amountVnd),
        sourceDate: text(source.sourceDate),
        sourceDocument: text(source.sourceDocument),
        createdAt: text(row.created_at),
      }
    })
    cache = { savedAt: Date.now(), rows }
    return rows
  })().finally(() => { inFlight = null })
  return inFlight
}

export async function loadCalibrationQuotes(options: { force?: boolean } = {}) {
  if (!options.force && cache && isClientCacheFresh(cache.savedAt, FRESH_MS)) return cache.rows
  try { return await fetchQuotes() } catch (cause) { if (cache) return cache.rows; throw cause }
}

export async function recordCalibrationQuote(input: { calibrationEquipmentId: string; provider: string; amountVnd: number; sourceDate: string; sourceDocument: string }) {
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_record_calibration_vendor_quote', {
    p_input: {
      calibrationEquipmentId: input.calibrationEquipmentId,
      provider: input.provider.trim(),
      amountVnd: input.amountVnd,
      sourceDate: input.sourceDate,
      sourceDocument: input.sourceDocument.trim(),
    },
  })
  if (error) throw error
  const result = data || {}
  const quoteId = text(result.quoteId)
  const created: CalibrationQuoteRow = {
    quoteId,
    equipmentId: text(result.equipmentId),
    calibrationEquipmentId: input.calibrationEquipmentId,
    provider: input.provider.trim(),
    amountVnd: input.amountVnd,
    sourceDate: input.sourceDate,
    sourceDocument: input.sourceDocument.trim(),
    createdAt: new Date().toISOString(),
  }
  cache = { savedAt: Date.now(), rows: [created, ...(cache?.rows || []).filter((row) => row.quoteId !== quoteId)] }
  void loadCalibrationQuotes({ force: true }).catch(() => undefined)
  return created
}
