import { barcodeSearch, loadRequestPortalSettings } from './scanSearchRepository'
import type { EquipmentDetail } from '../../equipment'

export type HomeScanResult =
  | { type: 'asset'; code: string; asset: EquipmentDetail }
  | { type: 'part'; code: string; partId: string; label: string }
  | { type: 'multiple'; code: string; items: Array<{ type: 'asset' | 'part'; id: string; label: string }> }
  | { type: 'request-portal-asset'; code: string; asset: EquipmentDetail; canCreateWorkOrder: boolean; canCreateRequest: boolean }
  | { type: 'request-portal-multiple'; code: string; items: Array<{ id: string; label: string }>; canCreateWorkOrder: boolean; canCreateRequest: boolean }
  | { type: 'not-found'; code: string }

export function normalizeScanCode(value: string) {
  return value.trim()
}

export async function resolveHomeScan(rawCode: string): Promise<HomeScanResult> {
  const code = normalizeScanCode(rawCode)
  if (!code) return { type: 'not-found', code: '' }

  const [matches, requestPortal] = await Promise.all([
    barcodeSearch(code),
    loadRequestPortalSettings(),
  ])

  if (matches.length === 0) return { type: 'not-found', code }

  const assetMatches = matches.filter((item) => item.type === 'asset')

  if (requestPortal.enabled && assetMatches.length > 0) {
    if (assetMatches.length === 1) {
      const match = assetMatches[0]
      if (match?.type === 'asset') {
        return {
          type: 'request-portal-asset',
          code,
          asset: match.asset,
          canCreateWorkOrder: requestPortal.canCreateWorkOrder,
          canCreateRequest: requestPortal.canCreateRequest,
        }
      }
    }

    return {
      type: 'request-portal-multiple',
      code,
      items: assetMatches.map((item) => ({ id: item.id, label: item.label })),
      canCreateWorkOrder: requestPortal.canCreateWorkOrder,
      canCreateRequest: requestPortal.canCreateRequest,
    }
  }

  if (matches.length > 1) {
    return {
      type: 'multiple',
      code,
      items: matches.map((item) => ({ type: item.type, id: item.id, label: item.label })),
    }
  }

  const match = matches[0]
  if (!match) return { type: 'not-found', code }
  if (match.type === 'asset') return { type: 'asset', code, asset: match.asset }
  return { type: 'part', code, partId: match.id, label: match.label }
}
