import { readClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'
import type { LiveEquipment } from './liveEquipment'

export type QrEquipmentIndexItem = {
  equipmentId: string
  equipmentName: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  status: string
}

const CANONICAL_EQUIPMENT_ID = /CEV-(?:PR|ME)-\d{3}/i
const EQUIPMENT_CACHE_KEY = 'cev:data:equipment-master'
const EQUIPMENT_CACHE_VERSION = 1

export function parseEquipmentIdFromQr(rawValue: string) {
  const raw = rawValue.trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    const queryId = url.searchParams.get('equipment') || url.searchParams.get('equipmentId') || ''
    const queryMatch = queryId.match(CANONICAL_EQUIPMENT_ID)
    if (queryMatch) return queryMatch[0].toUpperCase()
  } catch {
    // Raw QR values are expected to fail URL parsing.
  }

  const match = raw.match(CANONICAL_EQUIPMENT_ID)
  return match ? match[0].toUpperCase() : ''
}

function fromEquipmentCache(rows: LiveEquipment[]): QrEquipmentIndexItem[] {
  return rows
    .filter((row) => row.active)
    .map((row) => ({
      equipmentId: row.equipmentId,
      equipmentName: row.equipmentName || row.equipmentId,
      equipmentType: row.equipmentType,
      status: row.status || 'UNKNOWN',
    }))
    .toSorted((a, b) => a.equipmentId.localeCompare(b.equipmentId))
}

export async function loadQrEquipmentIndex(options: { force?: boolean } = {}): Promise<QrEquipmentIndexItem[]> {
  if (!options.force) {
    const cached = readClientCache<LiveEquipment[]>(EQUIPMENT_CACHE_KEY, EQUIPMENT_CACHE_VERSION)
    if (cached?.data?.length) return fromEquipmentCache(cached.data)
  }

  const { data, error } = await dataGateway.readRows('equipment_master', {
    columns: 'equipment_id,equipment_name,equipment_type,status',
    eq: [{ column: 'active', value: true }],
    order: { column: 'equipment_id' },
  })
  if (error) throw new Error(`QR_EQUIPMENT_INDEX_FAILED: ${error instanceof Error ? error.message : String(error)}`)

  return data.map((row) => ({
    equipmentId: String(row.equipment_id || ''),
    equipmentName: String(row.equipment_name || row.equipment_id || ''),
    equipmentType: row.equipment_type as QrEquipmentIndexItem['equipmentType'],
    status: String(row.status || 'UNKNOWN'),
  }))
}
