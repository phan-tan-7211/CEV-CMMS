import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function PwaStatus() {
  const [offlineReady, setOfflineReady] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady() { setOfflineReady(true) },
      onNeedRefresh() { setNeedRefresh(true) },
    })

    const listener = () => { void updateSW(true) }
    window.addEventListener('equipment:update-pwa', listener)
    return () => window.removeEventListener('equipment:update-pwa', listener)
  }, [])

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="pwa-banner" role="status">
      <span>{needRefresh ? 'Có phiên bản ứng dụng mới.' : 'Ứng dụng đã sẵn sàng chạy offline.'}</span>
      {needRefresh ? <button type="button" onClick={() => window.dispatchEvent(new Event('equipment:update-pwa'))}>Cập nhật</button> : null}
      <button type="button" aria-label="Đóng thông báo" onClick={() => { setOfflineReady(false); setNeedRefresh(false) }}>×</button>
    </div>
  )
}
