import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './EquipmentDelete.css'
import './EquipmentDrawerScroll.css'
import './EquipmentUnified.css'
import './DesktopWorkspace.css'
import './UiHierarchyAudit.css'
import App from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { EquipmentRegisterShortcut } from './EquipmentRegisterShortcut'
import { ProviderPortalPublic } from './ProviderPortalPublic'
import { installEquipmentWarmup } from './data/equipmentWarmup'
import { installSpareWarmup } from './data/spareWarmup'
import { installMaintenanceWarmup } from './data/maintenanceWarmup'
import { installInspectionWarmup } from './data/inspectionWarmup'
import { installCalibrationWarmup } from './data/calibrationWarmup'
import { installToolingWarmup } from './data/toolingWarmup'
import { installDashboardWarmup } from './data/dashboardWarmup'
import { installNavigationPrefetch } from './data/navigationPrefetch'

const SupabaseTestPanel = lazy(() => import('./SupabaseTestPanel').then((module) => ({ default: module.SupabaseTestPanel })))
const query = new URLSearchParams(window.location.search)
const phase3Preview = query.get('phase3')
const providerToken = query.get('providerToken')?.trim() || ''

if (!providerToken && phase3Preview !== 'supabase-test') {
  installEquipmentWarmup()
  installSpareWarmup()
  installMaintenanceWarmup()
  installInspectionWarmup()
  installCalibrationWarmup()
  installToolingWarmup()
  installDashboardWarmup()
  installNavigationPrefetch()
}

const content = providerToken
  ? <ProviderPortalPublic token={providerToken} />
  : phase3Preview === 'supabase-test'
    ? <Suspense fallback={<div className="workspace-loading" role="status">Đang tải Supabase diagnostics…</div>}><SupabaseTestPanel /></Suspense>
    : <><App /><EquipmentRegisterShortcut /></>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
)
