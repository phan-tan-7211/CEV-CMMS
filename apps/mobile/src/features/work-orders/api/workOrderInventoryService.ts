import { supabase } from '../../../lib/supabase/client'

function rows(data: unknown): Array<Record<string, unknown>> {
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : []
}

export type AvailablePartStock = {
  partId: string
  partNumber: string
  partName: string
  barcode: string
  unit: string
  stockLocationId: string
  stockLocationCode: string
  stockLocationName: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  averageUnitCost: number | null
}

export async function listAvailablePartStock(search = ''): Promise<AvailablePartStock[]> {
  const { data, error } = await supabase.rpc('rpc_cmms_inventory_available_parts', {
    p_search: search.trim() || null,
    p_stock_location_id: null,
    p_limit: 200,
    p_offset: 0,
  })
  if (error) throw new Error(error.message || 'Không tải được tồn kho khả dụng.')
  return rows(data).map((row) => ({
    partId: String(row.part_id || ''),
    partNumber: String(row.part_number || ''),
    partName: String(row.part_name || ''),
    barcode: String(row.barcode || ''),
    unit: String(row.unit || ''),
    stockLocationId: String(row.stock_location_id || ''),
    stockLocationCode: String(row.stock_location_code || ''),
    stockLocationName: String(row.stock_location_name || ''),
    quantityOnHand: Number(row.quantity_on_hand || 0),
    quantityReserved: Number(row.quantity_reserved || 0),
    quantityAvailable: Number(row.quantity_available || 0),
    averageUnitCost: row.average_unit_cost == null ? null : Number(row.average_unit_cost),
  }))
}

export async function issuePartToWorkOrder(input: {
  workOrderId: string
  partId: string
  stockLocationId: string
  quantity: number
  note?: string
}) {
  if (!(input.quantity > 0)) throw new Error('Số lượng phải lớn hơn 0.')
  const { data, error } = await supabase.rpc('rpc_cmms_inventory_issue_to_work_order', {
    p_work_order_id: input.workOrderId.trim(),
    p_part_id: input.partId,
    p_stock_location_id: input.stockLocationId,
    p_quantity: input.quantity,
    p_note: input.note?.trim() || null,
  })
  if (error) throw new Error(error.message || 'Không thể xuất phụ tùng cho Work Order.')
  return data
}
