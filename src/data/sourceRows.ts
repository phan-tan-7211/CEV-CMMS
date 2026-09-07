import { dataGateway } from './dataGateway'

export const TABLE_IDS: Record<string, string> = {
  equipment_master: 'equipment_id', daily_inspection: 'inspection_id', daily_inspection_item: 'item_id',
  maintenance_plan: 'plan_id', maintenance_plan_item: 'item_id', maintenance_work_order: 'work_order_id',
  maintenance_execution: 'execution_id', maintenance_result_item: 'result_item_id', maintenance_log: 'log_id',
  equipment_handover: 'handover_id', downtime_event: 'downtime_id', tooling_master: 'tooling_id',
  tooling_maintenance_plan: 'tooling_plan_id', tooling_modification: 'modification_id', calibration_master: 'calibration_id',
  calibration_log: 'calibration_log_id', calibration_vendor_quote: 'quote_id', calibration_quote_summary: 'summary_id',
  equipment_movement_log: 'movement_id', audit_log: 'audit_id',
}

const sourceRowsInFlight = new Map<string, Promise<Record<string, unknown>[]>>()

function cacheKey(table: string, filter?: { column: string; value: unknown }) {
  return filter ? `${table}|${filter.column}|${String(filter.value ?? '')}` : `${table}|*`
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || error)
  return String(error)
}

export function invalidateSourceRows(table: string, filter?: { column: string; value: unknown }) {
  if (filter) {
    sourceRowsInFlight.delete(cacheKey(table, filter))
    return
  }
  for (const key of sourceRowsInFlight.keys()) if (key === `${table}|*` || key.startsWith(`${table}|`)) sourceRowsInFlight.delete(key)
}

// Keyset pagination respects the server row cap and uses the canonical table PK.
// Only simultaneous reads are deduplicated. Completed results are not retained here so
// every later read re-checks backend authorization and inaccessible rows always fail closed.
export async function fetchSourceRows(table: string, filter?: { column: string; value: unknown }, options: { force?: boolean } = {}) {
  const id = TABLE_IDS[table]
  if (!id) throw new Error(`Unsupported source table: ${table}`)

  const key = cacheKey(table, filter)
  if (!options.force) {
    const existing = sourceRowsInFlight.get(key)
    if (existing) return existing
  }

  const task = (async () => {
    const rows: Record<string, unknown>[] = []
    let after: string | undefined
    for (;;) {
      const { data, error } = await dataGateway.readRows(table, {
        columns: '*',
        eq: filter ? [{ column: filter.column, value: filter.value }] : undefined,
        gt: after !== undefined ? [{ column: id, value: after }] : undefined,
        order: { column: id },
        limit: 500,
      })
      if (error) throw new Error(`${table}: ${errorMessage(error)}`)
      if (!data.length) return rows
      const next = String(data[data.length - 1][id])
      if (next === after || data.some(row => row[id] == null)) throw new Error(`${table}: invalid pagination`)
      rows.push(...data)
      after = next
    }
  })().finally(() => {
    if (sourceRowsInFlight.get(key) === task) sourceRowsInFlight.delete(key)
  })

  sourceRowsInFlight.set(key, task)
  return task
}
