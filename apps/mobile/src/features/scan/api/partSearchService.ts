import { supabase } from '../../../lib/supabase/client'

export type SparePart = {
  partId: string
  partName: string
  barcode: string
  partNumber: string
  maker: string
  stockQty: number
  minQty: number
  location: string
  classification: string
}

function text(value: unknown) { return String(value ?? '').trim() }
function number(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0 }

function mapPart(row: Record<string, unknown>): SparePart {
  return {
    partId: text(row.part_id), partName: text(row.part_name), barcode: text(row.barcode),
    partNumber: text(row.part_number), maker: text(row.maker), stockQty: number(row.stock_qty),
    minQty: number(row.min_qty), location: text(row.location), classification: text(row.spare_classification) || 'NORMAL',
  }
}

export async function searchSparePartsByBarcode(code: string) {
  const value = code.trim()
  if (!value) return []
  const { data, error } = await supabase.from('spare_part_overview').select('part_id,part_name,barcode,part_number,maker,stock_qty,min_qty,location,spare_classification').or(`barcode.ilike.%${value}%,part_number.ilike.%${value}%`).eq('active', true).limit(20)
  if (error) throw error
  return ((data || []) as Record<string, unknown>[]).map(mapPart)
}

export async function getSparePart(partId: string) {
  const { data, error } = await supabase.from('spare_part_overview').select('part_id,part_name,barcode,part_number,maker,stock_qty,min_qty,location,spare_classification').eq('part_id', partId.trim()).single()
  if (error) throw error
  return mapPart((data || {}) as Record<string, unknown>)
}

export async function listSparePartUsage(partId: string) {
  const { data, error } = await supabase.from('spare_part_usage').select('usage_id,equipment_id,quantity,used_at,work_order_id,reason,performed_by').eq('part_id', partId.trim()).order('used_at', { ascending: false }).limit(20)
  if (error) throw error
  return (data || []) as Array<Record<string, unknown>>
}
