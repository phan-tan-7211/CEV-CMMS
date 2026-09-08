import { revalidateEquipmentDetail, type EquipmentDetail } from '../../equipment'
import { searchSparePartsByBarcode } from './partSearchService'

export type ScanSearchCandidate =
  | { type: 'asset'; id: string; label: string; asset: EquipmentDetail }
  | { type: 'part'; id: string; label: string }

export type RequestPortalSettings = {
  enabled: boolean
  canCreateWorkOrder: boolean
  canCreateRequest: boolean
}

const REQUEST_PORTAL_DISABLED: RequestPortalSettings = {
  enabled: false,
  canCreateWorkOrder: false,
  canCreateRequest: false,
}

export async function barcodeSearch(code: string): Promise<ScanSearchCandidate[]> {
  // Current production Mobile contract can resolve canonical Equipment IDs only.
  // Keep this repository as the single server-search boundary so Part and mixed
  // results can be added without changing scanner screens.
  const [assetResult, partResult] = await Promise.allSettled([
    revalidateEquipmentDetail(code, { force: true }),
    searchSparePartsByBarcode(code),
  ])
  const candidates: ScanSearchCandidate[] = []
  if (assetResult.status === 'fulfilled') candidates.push({
      type: 'asset',
      id: assetResult.value.equipmentId,
      label: assetResult.value.equipmentName || assetResult.value.equipmentId,
      asset: assetResult.value,
    })
  if (partResult.status === 'fulfilled') candidates.push(...partResult.value.map((part) => ({ type: 'part' as const, id: part.partId, label: part.partName || part.partId })))
  return candidates
}

export async function loadRequestPortalSettings(): Promise<RequestPortalSettings> {
  const { data, error } = await (await import('../../../lib/supabase/client')).supabase.from('request_portal_settings').select('enabled,can_create_work_order,can_create_request').eq('settings_id', 'DEFAULT').maybeSingle()
  if (error || !data) return REQUEST_PORTAL_DISABLED
  return { enabled: Boolean(data.enabled), canCreateWorkOrder: Boolean(data.can_create_work_order), canCreateRequest: Boolean(data.can_create_request) }
}
