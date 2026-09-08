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
import { installEquipmentWarmup } from './data/equipmentWarmup'
import { installSpareWarmup } from './data/spareWarmup'
import { installMaintenanceWarmup } from './data/maintenanceWarmup'
import { installInspectionWarmup } from './data/inspectionWarmup'
import { installCalibrationWarmup } from './data/calibrationWarmup'
import { installToolingWarmup } from './data/toolingWarmup'
import { installDashboardWarmup } from './data/dashboardWarmup'
import { installNavigationPrefetch } from './data/navigationPrefetch'

const SupabaseTestPanel = lazy(() => import('./SupabaseTestPanel').then((module) => ({ default: module.SupabaseTestPanel })))
const phase3Preview = new URLSearchParams(window.location.search).get('phase3')

if (phase3Preview !== 'supabase-test') {
  installEquipmentWarmup()
  installSpareWarmup()
  installMaintenanceWarmup()
  installInspectionWarmup()
  installCalibrationWarmup()
  installToolingWarmup()
  installDashboardWarmup()
  installNavigationPrefetch()
}

const content = phase3Preview === 'supabase-test'
  ? <Suspense fallback={<div className="workspace-loading" role="status">Đang tải Supabase diagnostics…</div>}><SupabaseTestPanel /></Suspense>
  : <><App /><EquipmentRegisterShortcut /></>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
)
