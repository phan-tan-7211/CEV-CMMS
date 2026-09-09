import { supabase } from '../../../lib/supabase/client'

export type ReorderRequest = {
  reorderRequestId: string
  partId: string
  partNumber: string
  partName: string
  stockLocationId: string
  locationCode: string
  locationName: string
  requestedQuantity: number
  reason: string
  status: string
  purchaseOrderId: string
}

export type PurchaseOrder = {
  purchaseOrderId: string
  poNumber: string
  vendorId: string
  vendorName: string
  status: string
  orderDate: string
  expectedDate: string
  currencyCode: string
  subtotal: number
  totalAmount: number
  lineCount: number
  remainingQuantity: number
}

export type Vendor = { partyId: string; companyName: string; contactName: string; email: string; phone: string; address: string }
export type StockLocation = { stockLocationId: string; code: string; name: string; locationType: string }
export type PurchaseOrderLine = { purchaseOrderLineId: string; partId: string; description: string; quantityOrdered: number; quantityReceived: number; unit: string; unitCost: number; lineTotal: number; stockLocationId: string }
export type PurchaseOrderDetail = { order: PurchaseOrder; vendor: Vendor | null; lines: PurchaseOrderLine[] }
export type PurchasingSnapshot = { reorders: ReorderRequest[]; orders: PurchaseOrder[]; vendors: Vendor[]; locations: StockLocation[] }

function text(v: unknown) { return String(v ?? '').trim() }
function number(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function rows(v: unknown) { return Array.isArray(v) ? v as Array<Record<string, unknown>> : [] }

function mapOrder(r: Record<string, unknown>): PurchaseOrder {
  return { purchaseOrderId:text(r.purchase_order_id),poNumber:text(r.po_number),vendorId:text(r.vendor_id),vendorName:text(r.vendor_name),status:text(r.status),orderDate:text(r.order_date),expectedDate:text(r.expected_date),currencyCode:text(r.currency_code),subtotal:number(r.subtotal),totalAmount:number(r.total_amount),lineCount:number(r.line_count),remainingQuantity:number(r.remaining_quantity) }
}

export async function loadPurchasingSnapshot(): Promise<PurchasingSnapshot> {
  const { data, error } = await supabase.rpc('rpc_cmms_purchasing_snapshot')
  if (error) throw error
  const p = (data || {}) as Record<string, unknown>
  return {
    reorders: rows(p.reorders).map((r) => ({ reorderRequestId:text(r.reorder_request_id),partId:text(r.part_id),partNumber:text(r.part_number),partName:text(r.part_name),stockLocationId:text(r.stock_location_id),locationCode:text(r.location_code),locationName:text(r.location_name),requestedQuantity:number(r.requested_quantity),reason:text(r.reason),status:text(r.status),purchaseOrderId:text(r.purchase_order_id) })),
    orders: rows(p.orders).map(mapOrder),
    vendors: rows(p.vendors).map((r) => ({ partyId:text(r.party_id),companyName:text(r.company_name),contactName:text(r.contact_name),email:text(r.email),phone:text(r.phone),address:text(r.address) })),
    locations: rows(p.locations).map((r) => ({ stockLocationId:text(r.stock_location_id),code:text(r.code),name:text(r.name),locationType:text(r.location_type) })),
  }
}

export async function generateReorders(stockLocationId?: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_generate_reorder_requests', { p_stock_location_id: stockLocationId || null })
  if (error) throw error
  return Number(data || 0)
}

export async function createPurchaseOrder(reorderRequestIds: string[], vendorId: string, expectedDate?: string, currencyCode = 'VND') {
  const { data, error } = await supabase.rpc('rpc_cmms_create_purchase_order_from_reorders', { p_reorder_request_ids: reorderRequestIds, p_vendor_id: vendorId, p_currency_code: currencyCode, p_expected_date: expectedDate || null })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function transitionPurchaseOrder(purchaseOrderId: string, action: 'SUBMIT'|'APPROVE'|'ORDER'|'CANCEL'|'CLOSE') {
  const { data, error } = await supabase.rpc('rpc_cmms_transition_purchase_order', { p_purchase_order_id: purchaseOrderId, p_action: action })
  if (error) throw error
  return data
}

export async function loadPurchaseOrderDetail(purchaseOrderId: string): Promise<PurchaseOrderDetail> {
  const { data, error } = await supabase.rpc('rpc_cmms_purchase_order_detail', { p_purchase_order_id: purchaseOrderId })
  if (error) throw error
  const p = (data || {}) as Record<string, unknown>
  const orderRow = (p.purchaseOrder || {}) as Record<string, unknown>
  const vendorRow = p.vendor as Record<string, unknown> | null
  return {
    order: mapOrder(orderRow),
    vendor: vendorRow ? { partyId:text(vendorRow.party_id),companyName:text(vendorRow.company_name),contactName:text(vendorRow.contact_name),email:text(vendorRow.email),phone:text(vendorRow.phone),address:text(vendorRow.address) } : null,
    lines: rows(p.lines).map((r) => ({ purchaseOrderLineId:text(r.purchase_order_line_id),partId:text(r.part_id),description:text(r.description),quantityOrdered:number(r.quantity_ordered),quantityReceived:number(r.quantity_received),unit:text(r.unit),unitCost:number(r.unit_cost),lineTotal:number(r.line_total),stockLocationId:text(r.stock_location_id) })),
  }
}

export async function receivePurchaseOrderLine(lineId: string, quantity: number, stockLocationId?: string, note?: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_receive_purchase_order_line', { p_purchase_order_line_id: lineId, p_quantity: quantity, p_stock_location_id: stockLocationId || null, p_note: note || null })
  if (error) throw error
  return data
}
