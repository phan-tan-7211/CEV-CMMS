import { dataGateway } from './dataGateway'
import { removeEquipmentFromCache } from './supabaseEquipment'

const PHOTO_BUCKET = 'equipment-photos'

type DeleteBlocker = {
  label: string
  relation: string
  count: number
}

export type EquipmentDeleteCheck = {
  exists: boolean
  canDelete: boolean
  equipmentId: string
  blockers: DeleteBlocker[]
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

function normalizeCheck(value: unknown): EquipmentDeleteCheck {
  const row = (value || {}) as Record<string, unknown>
  const rawBlockers = Array.isArray(row.blockers) ? row.blockers : []
  return {
    exists: row.exists === true,
    canDelete: row.canDelete === true,
    equipmentId: String(row.equipmentId || ''),
    blockers: rawBlockers.map((item) => {
      const blocker = (item || {}) as Record<string, unknown>
      return {
        label: String(blocker.label || blocker.relation || 'Dữ liệu liên quan'),
        relation: String(blocker.relation || ''),
        count: Number(blocker.count || 0),
      }
    }).filter((item) => item.count > 0),
  }
}

export async function checkEquipmentDeletion(equipmentId: string) {
  const id = equipmentId.trim().toUpperCase()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')
  const { data, error } = await dataGateway.rpc('rpc_check_equipment_delete', { p_equipment_id: id })
  if (error) throw new Error(`EQUIPMENT_DELETE_CHECK_FAILED: ${errorMessage(error)}`)
  return normalizeCheck(data)
}

async function removeEquipmentPhotos(equipmentId: string) {
  const id = equipmentId.trim().toUpperCase()
  const { data, error } = await dataGateway.listFiles(PHOTO_BUCKET, id, 100)
  if (error) throw new Error(`EQUIPMENT_PHOTO_DELETE_LIST_FAILED: ${errorMessage(error)}`)
  const paths = data.map((file) => `${id}/${file.name}`)
  if (!paths.length) return 0
  const { error: removeError } = await dataGateway.remove(PHOTO_BUCKET, paths)
  if (removeError) throw new Error(`EQUIPMENT_PHOTO_DELETE_FAILED: ${errorMessage(removeError)}`)
  return paths.length
}

export async function deleteUnusedEquipment(equipmentId: string) {
  const id = equipmentId.trim().toUpperCase()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')

  // DB function re-checks dependencies immediately before deletion.
  const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_delete_unused_equipment', { p_equipment_id: id })
  if (error) throw new Error(`EQUIPMENT_DELETE_FAILED: ${errorMessage(error)}`)

  // Storage is outside the DB transaction, so clean the whole equipment folder after the guarded DB delete.
  const removedPhotos = await removeEquipmentPhotos(id)
  removeEquipmentFromCache(id)
  const deleted = data || {}
  return { ...deleted, removedPhotos }
}
