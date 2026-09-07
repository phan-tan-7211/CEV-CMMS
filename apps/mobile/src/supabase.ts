import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
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

const PHOTO_FORMATS: Record<string, { contentType: string; extension: string }> = {
  gif: { contentType: 'image/gif', extension: 'gif' },
  heic: { contentType: 'image/heic', extension: 'heic' },
  heif: { contentType: 'image/heif', extension: 'heif' },
  jpeg: { contentType: 'image/jpeg', extension: 'jpg' },
  jpg: { contentType: 'image/jpeg', extension: 'jpg' },
  png: { contentType: 'image/png', extension: 'png' },
  webp: { contentType: 'image/webp', extension: 'webp' },
}

function resolvePhotoFormat(photoUri: string, responseContentType: string | null) {
  const headerType = responseContentType?.split(';')[0].trim().toLowerCase() || ''
  const headerFormat = Object.values(PHOTO_FORMATS).find(({ contentType }) => contentType === headerType)
  if (headerFormat) return headerFormat

  const uriExtension = photoUri.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase() || ''
  return PHOTO_FORMATS[uriExtension] || PHOTO_FORMATS.jpeg
}

export async function uploadEquipmentPhoto(equipmentId: string, photoUri: string) {
  const response = await fetch(photoUri)
  if (!response.ok) throw new Error('Không đọc được ảnh trên thiết bị.')

  const bytes = await response.arrayBuffer()
  const format = resolvePhotoFormat(photoUri, response.headers.get('content-type'))
  const path = `${equipmentId}/photo.${format.extension}`
  const { error } = await supabase.storage
    .from('equipment-photos')
    .upload(path, bytes, {
      cacheControl: '3600',
      contentType: format.contentType,
      upsert: true,
    })

  if (error) throw new Error(`Không tải được ảnh thiết bị: ${error.message}`)
  return path
}
