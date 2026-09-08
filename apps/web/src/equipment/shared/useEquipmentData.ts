import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { loadLiveEquipment, type LiveEquipment } from '../../data/liveEquipment'
import { getEquipmentCacheSnapshot } from '../../data/supabaseEquipment'

type RefreshPhotoStates = (rows: LiveEquipment[]) => Promise<void> | void

type UseEquipmentDataResult = {
  rows: LiveEquipment[]
  setRows: Dispatch<SetStateAction<LiveEquipment[]>>
  loading: boolean
  error: string
  setError: Dispatch<SetStateAction<string>>
  reloadEquipment: (force?: boolean) => Promise<void>
}

export function useEquipmentData(refreshPhotoStates: RefreshPhotoStates): UseEquipmentDataResult {
  const [initialSnapshot] = useState<LiveEquipment[]>(getEquipmentCacheSnapshot)
  const [rows, setRows] = useState<LiveEquipment[]>(initialSnapshot)
  const [loading, setLoading] = useState(initialSnapshot.length === 0)
  const [error, setError] = useState('')

  async function reloadEquipment(force = false) {
    const block = force || rows.length === 0
    if (block) setLoading(true)
    try {
      const result = await loadLiveEquipment({ force })
      setRows(result)
      setError('')
      void refreshPhotoStates(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải danh mục thiết bị')
    } finally {
      if (block) setLoading(false)
    }
  }

  useEffect(() => {
    if (initialSnapshot.length) void refreshPhotoStates(initialSnapshot)

    void loadLiveEquipment({ force: true }).then((result) => {
      setRows(result)
      setError('')
      void refreshPhotoStates(result)
    }).catch((cause) => {
      if (!initialSnapshot.length) setError(cause instanceof Error ? cause.message : 'Không thể tải danh mục thiết bị')
    }).finally(() => setLoading(false))
  }, [initialSnapshot, refreshPhotoStates])

  return { rows, setRows, loading, error, setError, reloadEquipment }
}
