import { useCallback, useState, type ClipboardEvent } from 'react'
import { deleteEquipmentPhotos } from '../../data/equipmentPhotoDelete'
import {
  getEquipmentPhotoCacheSnapshot,
  invalidateEquipmentPhotoCache,
  loadCachedEquipmentPhotoPreview,
  loadCachedEquipmentPhotoPreviews,
} from '../../data/equipmentPhotoCache'
import type { LiveEquipment } from '../../data/liveEquipment'
import { uploadEquipmentPhoto } from '../../data/supabaseEquipment'
import type { PhotoInfo } from './equipmentColumns'

function clipboardFileExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'jpg'
}

function photoCacheInitialState(): Record<string, PhotoInfo> {
  const snapshot = getEquipmentPhotoCacheSnapshot()
  return Object.fromEntries(
    Object.entries(snapshot).map(([id, preview]) => [id, { state: preview.exists ? 'yes' : 'no', url: preview.signedUrl } as PhotoInfo]),
  )
}

export function useEquipmentPhotos(setMessage: (message: string) => void) {
  const [photos, setPhotos] = useState<Record<string, PhotoInfo>>(photoCacheInitialState)
  const [uploadingId, setUploadingId] = useState('')
  const [deletingPhotoId, setDeletingPhotoId] = useState('')

  async function refreshOnePhoto(equipmentId: string, force = false) {
    setPhotos((current) => ({
      ...current,
      [equipmentId]: { state: 'loading', url: current[equipmentId]?.url || '' },
    }))
    try {
      const preview = await loadCachedEquipmentPhotoPreview(equipmentId, force)
      setPhotos((current) => ({
        ...current,
        [equipmentId]: { state: preview.exists ? 'yes' : 'no', url: preview.signedUrl },
      }))
      return preview.exists
    } catch {
      setPhotos((current) => ({
        ...current,
        [equipmentId]: { state: 'error', url: current[equipmentId]?.url || '' },
      }))
      return false
    }
  }

  const refreshPhotoStates = useCallback(async (rows: LiveEquipment[]) => {
    setPhotos((current) => Object.fromEntries(
      rows.map((row) => [row.equipmentId, current[row.equipmentId] || { state: 'loading', url: '' } as PhotoInfo]),
    ))
    try {
      const previews = await loadCachedEquipmentPhotoPreviews(rows.map((row) => row.equipmentId))
      setPhotos((current) => Object.fromEntries(rows.map((row) => {
        const preview = previews[row.equipmentId]
        return [row.equipmentId, preview
          ? { state: preview.exists ? 'yes' : 'no', url: preview.signedUrl || '' } as PhotoInfo
          : current[row.equipmentId] || { state: 'loading', url: '' } as PhotoInfo]
      })))
    } catch {
      setPhotos((current) => Object.fromEntries(
        rows.map((row) => [row.equipmentId, current[row.equipmentId] || { state: 'error', url: '' } as PhotoInfo]),
      ))
    }
  }, [])

  async function confirmPhotoReplacement(equipmentId: string) {
    const current = photos[equipmentId]
    if (current?.state === 'yes') return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)
    if (!current || current.state === 'loading' || current.state === 'error') {
      const exists = await refreshOnePhoto(equipmentId)
      if (exists) return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)
    }
    return true
  }

  async function uploadAndRefresh(equipmentId: string, file: File) {
    setUploadingId(equipmentId)
    setMessage('')
    try {
      await uploadEquipmentPhoto(equipmentId, file)
      invalidateEquipmentPhotoCache(equipmentId)
      await refreshOnePhoto(equipmentId, true)
      setMessage(`Đã cập nhật ảnh ${equipmentId}`)
    } catch (cause) {
      setMessage(cause instanceof Error ? `Không thể tải ảnh: ${cause.message}` : 'Không thể tải ảnh')
    } finally {
      setUploadingId('')
    }
  }

  async function handlePhotoUpload(equipmentId: string, file: File | undefined) {
    if (!file || !await confirmPhotoReplacement(equipmentId)) return
    await uploadAndRefresh(equipmentId, file)
  }

  async function handlePhotoDelete(equipmentId: string) {
    if (!photos[equipmentId]?.url || uploadingId || deletingPhotoId) return
    if (!window.confirm(`Xóa ảnh hiện tại của ${equipmentId}?\n\nChỉ ảnh sẽ bị xóa. Dữ liệu thiết bị và lịch sử không thay đổi.`)) return
    setDeletingPhotoId(equipmentId)
    setMessage('')
    try {
      const removed = await deleteEquipmentPhotos(equipmentId)
      invalidateEquipmentPhotoCache(equipmentId)
      setPhotos((current) => ({ ...current, [equipmentId]: { state: 'no', url: '' } }))
      setMessage(removed > 0 ? `Đã xóa ảnh ${equipmentId}.` : `${equipmentId} không có ảnh để xóa.`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể xóa ảnh')
    } finally {
      setDeletingPhotoId('')
    }
  }

  async function handleClipboardUpload(equipmentId: string) {
    if (!navigator.clipboard?.read) {
      setMessage('Trình duyệt không hỗ trợ đọc ảnh từ bộ nhớ tạm.')
      return
    }
    try {
      for (const item of await navigator.clipboard.read()) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (!imageType) continue
        if (!await confirmPhotoReplacement(equipmentId)) return
        const blob = await item.getType(imageType)
        await uploadAndRefresh(equipmentId, new File([blob], `clipboard.${clipboardFileExtension(imageType)}`, { type: imageType }))
        return
      }
      setMessage('Bộ nhớ tạm không có ảnh.')
    } catch (cause) {
      setMessage(cause instanceof Error ? `Không thể đọc ảnh từ bộ nhớ tạm: ${cause.message}` : 'Không thể đọc ảnh từ bộ nhớ tạm')
    }
  }

  async function handleEmptyPhotoCellPaste(equipmentId: string, event: ClipboardEvent<HTMLElement>) {
    const current = photos[equipmentId]
    if (current?.state !== 'no' || uploadingId) return
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (!imageItem) {
      setMessage('Bộ nhớ tạm không có ảnh.')
      return
    }
    event.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) {
      setMessage('Không đọc được ảnh từ bộ nhớ tạm.')
      return
    }
    await uploadAndRefresh(equipmentId, file)
  }

  function removeEquipmentPhotoState(equipmentId: string) {
    invalidateEquipmentPhotoCache(equipmentId)
    setPhotos((current) => {
      const next = { ...current }
      delete next[equipmentId]
      return next
    })
  }

  return {
    photos,
    uploadingId,
    deletingPhotoId,
    refreshPhotoStates,
    removeEquipmentPhotoState,
    handlePhotoUpload,
    handlePhotoDelete,
    handleClipboardUpload,
    handleEmptyPhotoCellPaste,
  }
}
