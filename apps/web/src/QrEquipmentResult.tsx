import { useEffect, useState } from 'react'
import { EquipmentProfile } from './EquipmentProfile'
import type { LiveEquipment } from './data/liveEquipment'
import { getEquipmentPhotoPreview, loadSupabaseEquipment } from './data/supabaseEquipment'

type Props = {
  equipmentId: string
  onClose: () => void
  onEdit: () => void
}

export function QrEquipmentResult({ equipmentId, onClose, onEdit }: Props) {
  const [equipment, setEquipment] = useState<LiveEquipment | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([loadSupabaseEquipment(), getEquipmentPhotoPreview(equipmentId)])
      .then(([rows, photo]) => {
        if (!active) return
        const row = rows.find((item) => item.equipmentId === equipmentId) || null
        if (!row) {
          setError(`Không tìm thấy ${equipmentId} trong Equipment Master.`)
          return
        }
        setEquipment(row)
        setPhotoUrl(photo.signedUrl)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'QR_PROFILE_LOAD_FAILED') })
    return () => { active = false }
  }, [equipmentId])

  if (error) return <section className="panel stack-sm"><strong>Không mở được hồ sơ QR</strong><div>{error}</div><button type="button" onClick={onClose}>Quét lại</button></section>
  if (!equipment) return <div className="workspace-loading" role="status">Đang mở {equipmentId}…</div>

  return <EquipmentProfile equipment={equipment} photoUrl={photoUrl} onClose={onClose} onEdit={onEdit} />
}
