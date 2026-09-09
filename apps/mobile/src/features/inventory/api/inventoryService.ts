import { supabase } from '../../../lib/supabase/client'

export type InventoryPart = {
  partId: string
  partNumber: string
  name: string
  barcode: string
  manufacturer: string
  unit: string
  minStock: number
  reorderPoint: number
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  stockValue: number
  riskState: string
  suggestedOrderQuantity: number
}

export type StockLocation = {
  stockLocationId: string
  code: string
  name: string
  locationType: string
}

export type PartStockRow = {
  partId: string
  stockLocationId: string
  locationCode: string
  locationName: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  averageUnitCost: number
  updatedAt: string
}

export type StockTransaction = {
  transactionId: string
  partId: string
  stockLocationId: string
  locationCode: string
  locationName: string
  transactionType: string
  quantity: number
  note: string
  workOrderId: string
  occurredAt: string
}

export type InventorySnapshot = {
  parts: InventoryPart[]
  locations: StockLocation[]
  stock: PartStockRow[]
  transactions: StockTransaction[]
}

function text(value: unknown) { return String(value ?? '').trim() }
function number(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function rows(value: unknown) { return Array.isArray(value) ? value as Array<Record<string, unknown>> : [] }

export async function loadInventorySnapshot(input: { partId?: string; search?: string; transactionLimit?: number } = {}): Promise<InventorySnapshot> {
  const { data, error } = await supabase.rpc('rpc_cmms_inventory_snapshot', {
    p_part_id: input.partId || null,
    p_search: input.search || null,
    p_transaction_limit: input.transactionLimit || 100,
  })
  if (error) throw error
  const payload = (data || {}) as Record<string, unknown>
  return {
    parts: rows(payload.parts).map((r) => ({ partId:text(r.part_id),partNumber:text(r.part_number),name:text(r.name),barcode:text(r.barcode),manufacturer:text(r.manufacturer),unit:text(r.unit),minStock:number(r.min_stock),reorderPoint:number(r.reorder_point),quantityOnHand:number(r.quantity_on_hand),quantityReserved:number(r.quantity_reserved),quantityAvailable:number(r.quantity_available),stockValue:number(r.stock_value),riskState:text(r.risk_state),suggestedOrderQuantity:number(r.suggested_order_quantity) })),
    locations: rows(payload.locations).map((r) => ({ stockLocationId:text(r.stock_location_id),code:text(r.code),name:text(r.name),locationType:text(r.location_type) })),
    stock: rows(payload.stock).map((r) => ({ partId:text(r.part_id),stockLocationId:text(r.stock_location_id),locationCode:text(r.location_code),locationName:text(r.location_name),quantityOnHand:number(r.quantity_on_hand),quantityReserved:number(r.quantity_reserved),quantityAvailable:number(r.quantity_available),averageUnitCost:number(r.average_unit_cost),updatedAt:text(r.updated_at) })),
    transactions: rows(payload.transactions).map((r) => ({ transactionId:text(r.transaction_id),partId:text(r.part_id),stockLocationId:text(r.stock_location_id),locationCode:text(r.location_code),locationName:text(r.location_name),transactionType:text(r.transaction_type),quantity:number(r.quantity),note:text(r.note),workOrderId:text(r.work_order_id),occurredAt:text(r.occurred_at) })),
  }
}

export async function moveInventory(input: { partId: string; stockLocationId: string; action: 'RECEIVE'|'ISSUE'|'ADJUST_IN'|'ADJUST_OUT'; quantity: number; note?: string }) {
  const { data, error } = await supabase.rpc('rpc_cmms_inventory_move', {
    p_part_id: input.partId,
    p_stock_location_id: input.stockLocationId,
    p_action: input.action,
    p_quantity: input.quantity,
    p_note: input.note || null,
  })
  if (error) throw error
  return data
}
