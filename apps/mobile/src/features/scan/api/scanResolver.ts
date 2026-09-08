import { revalidateEquipmentDetail, type EquipmentDetail } from '../../equipment'

export type HomeScanResult =
  | { type: 'asset'; code: string; asset: EquipmentDetail }
  | { type: 'part'; code: string; partId: string; label: string }
  | { type: 'multiple'; code: string; items: Array<{ type: 'asset' | 'part'; id: string; label: string }> }
  | { type: 'request-portal'; code: string }
  | { type: 'not-found'; code: string }

export function normalizeScanCode(value: string) {
  return value.trim()
}

export async function resolveHomeScan(rawCode: string): Promise<HomeScanResult> {
  const code = normalizeScanCode(rawCode)
  if (!code) return { type: 'not-found', code: '' }

  try {
    // Current CEV production contract resolves Equipment directly by canonical
    // equipment_id. Keep the result union extensible for Part/multi/request flows,
    // but do not fabricate those results until their server contracts exist.
    const asset = await revalidateEquipmentDetail(code, { force: true })
    return { type: 'asset', code, asset }
  } catch {
    return { type: 'not-found', code }
  }
}
