import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

import { supabase } from '../../../lib/supabase/client'
import { invalidateEquipmentPhotoUrl } from './equipmentImageService'

const PHOTO_BUCKET = 'equipment-photos'
const EQUIPMENT_PHOTO_NAME = 'photo.webp'
const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024
const PHOTO_MAX_EDGE = 1280
const PHOTO_TARGET_BYTES = 700 * 1024
const PHOTO_INITIAL_QUALITY = 0.82
const PHOTO_MIN_QUALITY = 0.70

async function optimizeEquipmentPhoto(photoUri: string) {
  const sourceResponse = await fetch(photoUri)
  if (!sourceResponse.ok) throw new Error('Không đọc được ảnh trên thiết bị.')
  const sourceBytes = await sourceResponse.arrayBuffer()
  if (sourceBytes.byteLength > PHOTO_MAX_INPUT_BYTES) {
    throw new Error('Ảnh vượt quá giới hạn 25 MB.')
  }

  const sourceContext = ImageManipulator.manipulate(photoUri)
  const sourceImage = await sourceContext.renderAsync()
  const longestEdge = Math.max(sourceImage.width, sourceImage.height)
  let image = sourceImage

  if (longestEdge > PHOTO_MAX_EDGE) {
    const resizeContext = ImageManipulator.manipulate(photoUri)
    if (sourceImage.width >= sourceImage.height) {
      resizeContext.resize({ width: PHOTO_MAX_EDGE, height: null })
    } else {
      resizeContext.resize({ width: null, height: PHOTO_MAX_EDGE })
    }
    image = await resizeContext.renderAsync()
  }

  let quality = PHOTO_INITIAL_QUALITY
  let result = await image.saveAsync({ compress: quality, format: SaveFormat.WEBP })
  let response = await fetch(result.uri)
  if (!response.ok) throw new Error('Không nén được ảnh thiết bị.')
  let bytes = await response.arrayBuffer()

  while (bytes.byteLength > PHOTO_TARGET_BYTES && quality > PHOTO_MIN_QUALITY) {
    quality = Math.max(PHOTO_MIN_QUALITY, quality - 0.04)
    result = await image.saveAsync({ compress: quality, format: SaveFormat.WEBP })
    response = await fetch(result.uri)
    if (!response.ok) throw new Error('Không nén được ảnh thiết bị.')
    bytes = await response.arrayBuffer()
  }

  return bytes
}

export async function uploadEquipmentPhoto(equipmentId: string, photoUri: string) {
  const normalizedId = equipmentId.trim()
  if (!normalizedId) throw new Error('Thiếu mã thiết bị.')

  const bytes = await optimizeEquipmentPhoto(photoUri)
  const path = `${normalizedId}/${EQUIPMENT_PHOTO_NAME}`
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const { error } = await bucket.upload(path, bytes, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw new Error(`Không tải được ảnh thiết bị: ${error.message}`)

  const { data: files, error: listError } = await bucket.list(normalizedId, { limit: 100 })
  if (listError) throw new Error(`Ảnh đã tải lên nhưng không kiểm tra được thư mục ảnh: ${listError.message}`)
  const stalePaths = (files || [])
    .filter((file) => file.name !== EQUIPMENT_PHOTO_NAME)
    .map((file) => `${normalizedId}/${file.name}`)
  if (stalePaths.length > 0) {
    const { error: removeError } = await bucket.remove(stalePaths)
    if (removeError) throw new Error(`Ảnh WebP đã tải lên nhưng chưa xóa được ảnh cũ: ${removeError.message}`)
  }

  await invalidateEquipmentPhotoUrl(normalizedId)
  return path
}
