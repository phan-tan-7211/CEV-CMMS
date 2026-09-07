import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://owwfmviduprmjksmelfq.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QWdi-_gAL39N0YC0nRwkFw_FbcJBIRd'

const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim()
const supabaseKey = String(
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
).trim()

export const mobileSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = createClient(
  supabaseUrl || 'https://supabase-not-configured.invalid',
  supabaseKey || 'supabase-not-configured',
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

export type EquipmentCreateInput = {
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  distributor: string
  model: string
  serialNumber: string
  department: string
  currentArea: string
  currentLine: string
  managingDepartment: string
  managementResponsiblePrimary: string
  managementResponsibleSecondary: string
  technicalSpecification: string
  description: string
  origin: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  status: string
  controlsProductQuality: boolean
  specialCharacteristicImpact: boolean
  stopsProduction: boolean
  hasBackup: boolean
  capacityImpact: boolean
}

export type EquipmentCreateResult = {
  equipmentId: string
  qrCode: string
  criticality: string
}

export async function createEquipment(input: EquipmentCreateInput): Promise<EquipmentCreateResult> {
  const { data, error } = await supabase.rpc('rpc_create_equipment_auto', { p_input: input })
  if (error) throw new Error(error.message || 'Không thể tạo thiết bị.')

  const row = (data || {}) as Record<string, unknown>
  const equipmentId = String(row.equipmentId || row.equipment_id || '')
  if (!equipmentId) throw new Error('RPC không trả về mã thiết bị.')

  if (input.distributor.trim()) {
    const { error: distributorError } = await supabase.rpc('rpc_set_equipment_distributor', {
      p_equipment_id: equipmentId,
      p_distributor: input.distributor.trim(),
    })
    if (distributorError) {
      throw new Error(`Thiết bị ${equipmentId} đã tạo nhưng chưa lưu được nhà phân phối: ${distributorError.message}`)
    }
  }

  return {
    equipmentId,
    qrCode: String(row.qrCode || row.qr_code || equipmentId),
    criticality: String(row.criticality || ''),
  }
}

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

  return path
}
