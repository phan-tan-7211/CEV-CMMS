import { dataGateway } from './dataGateway'

const PHOTO_BUCKET = 'equipment-photos'

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

export async function deleteEquipmentPhotos(equipmentId: string) {
  const normalizedId = equipmentId.trim().toUpperCase()
  if (!normalizedId) throw new Error('EQUIPMENT_ID_REQUIRED')

  const { data, error: listError } = await dataGateway.listFiles(PHOTO_BUCKET, normalizedId, 100)
  if (listError) throw new Error(`SUPABASE_PHOTO_LIST_FAILED: ${errorMessage(listError)}`)

  const paths = data.map((file) => `${normalizedId}/${file.name}`)
  if (paths.length === 0) return 0

  const { error: removeError } = await dataGateway.remove(PHOTO_BUCKET, paths)
  if (removeError) throw new Error(`SUPABASE_PHOTO_DELETE_FAILED: ${errorMessage(removeError)}`)
  return paths.length
}
