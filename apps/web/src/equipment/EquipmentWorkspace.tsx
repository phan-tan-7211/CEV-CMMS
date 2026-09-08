import { lazy, Suspense, useEffect, useState } from 'react'

type EquipmentViewportMode = 'desktop' | 'mobile'

const DesktopEquipmentWorkspace = lazy(() => import('./desktop/EquipmentDesktopWorkspace').then((module) => ({ default: module.EquipmentDesktopWorkspace })))
const MobileEquipmentWorkspace = lazy(() => import('./mobile/EquipmentMobileWorkspace').then((module) => ({ default: module.EquipmentMobileWorkspace })))

function currentMode(): EquipmentViewportMode {
  return window.matchMedia('(min-width: 901px)').matches ? 'desktop' : 'mobile'
}

/**
 * Equipment has two independent presentation entrypoints.
 * Business/data components remain reusable, but desktop/mobile layout ownership is separate.
 */
export function EquipmentWorkspace() {
  const [mode, setMode] = useState<EquipmentViewportMode>(() => currentMode())
  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)')
    const sync = () => setMode(media.matches ? 'desktop' : 'mobile')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return <Suspense fallback={<div className="workspace-loading" role="status">Đang mở danh mục thiết bị…</div>}>{mode === 'desktop' ? <DesktopEquipmentWorkspace/> : <MobileEquipmentWorkspace/>}</Suspense>
}
