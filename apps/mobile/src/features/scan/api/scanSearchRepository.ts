import { revalidateEquipmentDetail, type EquipmentDetail } from '../../equipment'

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
  try {
    const asset = await revalidateEquipmentDetail(code, { force: true })
    return [{
      type: 'asset',
      id: asset.equipmentId,
      label: asset.equipmentName || asset.equipmentId,
      asset,
    }]
  } catch {
    return []
  }
}

export async function loadRequestPortalSettings(): Promise<RequestPortalSettings> {
  // No production Request Portal settings contract exists in CEV Mobile yet.
  // Return an explicit disabled state rather than fabricating portal behavior.
  return REQUEST_PORTAL_DISABLED
}
