import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import './MobileUx.css'
import { AppErrorBoundary } from './AppErrorBoundary'
import { AppRoleProvider, canViewAudit, type AppRole } from './auth/AppRoleContext'
import { type LiveSession } from './data/liveAudit'
import { AuthGate } from './auth/AuthGate'
import { PwaStatus } from './PwaStatus'
import { DesktopSidebar } from './DesktopSidebar'
import { AccountMenu } from './AccountMenu'
import { AccountPreferences } from './AccountPreferences'
import { NotificationCenter } from './NotificationCenter'

const A4PrintCenter = lazy(() => import('./A4PrintCenter').then((module) => ({ default: module.A4PrintCenter })))
const LiveAuditPanel = lazy(() => import('./LiveAuditPanel').then((module) => ({ default: module.LiveAuditPanel })))
const LiveCalibrationEvaluationPanel = lazy(() => import('./LiveCalibrationEvaluationPanel').then((module) => ({ default: module.LiveCalibrationEvaluationPanel })))
const LiveCalibrationPanel = lazy(() => import('./LiveCalibrationPanel').then((module) => ({ default: module.LiveCalibrationPanel })))
const LiveCalibrationQuotePanel = lazy(() => import('./LiveCalibrationQuotePanel').then((module) => ({ default: module.LiveCalibrationQuotePanel })))
const LiveDashboardPanel = lazy(() => import('./LiveDashboardPanel').then((module) => ({ default: module.LiveDashboardPanel })))
const EquipmentWorkspace = lazy(() => import('./equipment/EquipmentWorkspace').then((module) => ({ default: module.EquipmentWorkspace })))
const LiveEquipmentInventoryPanel = lazy(() => import('./LiveEquipmentInventoryPanel').then((module) => ({ default: module.LiveEquipmentInventoryPanel })))
const LiveInspectionPanel = lazy(() => import('./LiveInspectionPanel').then((module) => ({ default: module.LiveInspectionPanel })))
const MaintenanceWorkspace = lazy(() => import('./maintenance/MaintenanceWorkspace').then((module) => ({ default: module.MaintenanceWorkspace })))
const LiveQrScannerPanel = lazy(() => import('./LiveQrScannerPanel').then((module) => ({ default: module.LiveQrScannerPanel })))
const QrEquipmentResult = lazy(() => import('./QrEquipmentResult').then((module) => ({ default: module.QrEquipmentResult })))
const LiveSparePartsAutoPanel = lazy(() => import('./LiveSparePartsAutoPanel').then((module) => ({ default: module.LiveSparePartsAutoPanel })))
const LiveToolingPanel = lazy(() => import('./LiveToolingPanel').then((module) => ({ default: module.LiveToolingPanel })))
const OrgManagementPanel = lazy(() => import('./OrgManagementPanel').then((module) => ({ default: module.OrgManagementPanel })))

type View = 'dashboard' | 'qr' | 'work-orders' | 'maintenance' | 'scheduler' | 'requests' | 'analytics' | 'meters' | 'edge' | 'equipment' | 'locations' | 'people' | 'inspection' | 'files' | 'import-export' | 'inventory' | 'spare' | 'purchase-orders' | 'customers' | 'providers' | 'tooling' | 'calibration' | 'print' | 'organization' | 'settings'

const NAV: Array<{ id: View; label: string; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Tổng quan' },
  { id: 'qr', label: 'Quét QR' },
  { id: 'work-orders', label: 'Lệnh công việc' },
  { id: 'maintenance', label: 'Bảo trì phòng ngừa' },
  { id: 'scheduler', label: 'Lịch trình' },
  { id: 'requests', label: 'Yêu cầu' },
  { id: 'analytics', label: 'Phân tích' },
  { id: 'meters', label: 'Đồng hồ đo' },
  { id: 'edge', label: 'Edge' },
  { id: 'equipment', label: 'Thiết bị' },
  { id: 'locations', label: 'Địa điểm' },
  { id: 'people', label: 'Nhân sự & Nhóm' },
  { id: 'inspection', label: 'Danh sách kiểm tra' },
  { id: 'files', label: 'Quản lý tệp' },
  { id: 'import-export', label: 'Nhập & Xuất' },
  { id: 'inventory', label: 'Kiểm kê thiết bị' },
  { id: 'spare', label: 'Phụ tùng & Kho' },
  { id: 'purchase-orders', label: 'Đơn đặt hàng' },
  { id: 'customers', label: 'Khách hàng' },
  { id: 'providers', label: 'Nhà cung cấp và Mạng lưới' },
  { id: 'tooling', label: 'Jig, gá & dụng cụ' },
  { id: 'calibration', label: 'Hiệu chuẩn' },
  { id: 'print', label: 'Hồ sơ A4' },
  { id: 'organization', label: 'Tổ chức & nhân sự', adminOnly: true },
  { id: 'settings', label: 'Nhật ký & cấu hình', adminOnly: true },
]

const MOBILE_PRIMARY: Array<{ id: View; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Trang chủ', icon: '⌂' },
  { id: 'maintenance', label: 'Công việc', icon: '⚒' },
  { id: 'qr', label: 'Quét QR', icon: '▣' },
  { id: 'equipment', label: 'Thiết bị', icon: '▤' },
]

const ROLE_LABEL: Record<AppRole, string> = {
  MAINTENANCE: 'Bảo trì',
  SUPERVISOR: 'Giám sát',
  QUALITY: 'Chất lượng',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị hệ thống',
  UNKNOWN: 'Chưa xác định',
}

function initialView(): View {
  const requested = new URLSearchParams(window.location.search).get('phase3')
  if (requested && NAV.some((item) => item.id === requested)) return requested as View
  if (requested === 'audit') return 'settings'
  return 'dashboard'
}

function initialEquipmentTarget() {
  return new URLSearchParams(window.location.search).get('equipment')?.trim().toUpperCase() || ''
}

function normalizeRole(value: string): AppRole {
  return ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(value) ? value as AppRole : 'UNKNOWN'
}

function permittedView(nextView: View, role: AppRole): View {
  return (nextView === 'settings' || nextView === 'organization') && !canViewAudit(role) ? 'dashboard' : nextView
}

function syncUrl(nextView: View, equipmentId = '') {
  const url = new URL(window.location.href)
  url.searchParams.set('phase3', nextView === 'settings' ? 'audit' : nextView)
  if (equipmentId) url.searchParams.set('equipment', equipmentId)
  else url.searchParams.delete('equipment')
  window.history.replaceState({}, '', url)
}

function LiveView({ view, equipmentTarget, contextEquipmentId, onOpenEquipment, onCloseQrResult, onEditQrResult, onNavigate }: { view: View; equipmentTarget: string; contextEquipmentId: string; onOpenEquipment: (equipmentId: string) => void; onCloseQrResult: () => void; onEditQrResult: () => void; onNavigate: (view: View) => void }) {
  if (view === 'dashboard') return <LiveDashboardPanel onNavigate={onNavigate} />
  if (view === 'qr') return <LiveQrScannerPanel onOpenEquipment={onOpenEquipment} />
  if (view === 'equipment' && equipmentTarget) return <QrEquipmentResult equipmentId={equipmentTarget} onClose={onCloseQrResult} onEdit={onEditQrResult} />
  if (view === 'equipment') return <EquipmentWorkspace />
  if (view === 'inventory') return <LiveEquipmentInventoryPanel />
  if (view === 'inspection') return <LiveInspectionPanel />
  if (view === 'work-orders') return <MaintenanceWorkspace equipmentId={contextEquipmentId} />
  if (view === 'maintenance') return <MaintenanceWorkspace equipmentId={contextEquipmentId} />
  if (view === 'spare') return <LiveSparePartsAutoPanel />
  if (view === 'tooling') return <LiveToolingPanel />
  if (view === 'calibration') return <div className="maintenance-workspace-stack"><LiveCalibrationPanel /><LiveCalibrationEvaluationPanel /><LiveCalibrationQuotePanel /></div>
  if (view === 'print') return <A4PrintCenter />
  if (view === 'organization') return <OrgManagementPanel />
  if (view === 'settings') return <LiveAuditPanel />
  return <ModulePlaceholderPanel title={NAV.find((item) => item.id === view)?.label || view} />
}

function ModulePlaceholderPanel({ title }: { title: string }) {
  return <div className="workspace-placeholder" aria-labelledby="workspace-placeholder-title">
    <p className="eyebrow">CEV CMMS · UpKeep layout</p>
    <h2 id="workspace-placeholder-title">{title}</h2>
    <p>Khung màn hình đã được thêm vào điều hướng. Logic dữ liệu và thao tác chi tiết sẽ nối ở bước tiếp theo.</p>
  </div>
}

export default function App() {
  return <><PwaStatus /><AuthGate>{(session, signOut) => <AppWorkspace session={session} signOut={signOut} />}</AuthGate></>
}

function AppWorkspace({ session, signOut }: { session: LiveSession; signOut: () => Promise<void> }) {
  const role = normalizeRole(session.role)
  const initial = permittedView(initialView(), role)
  const [view, setView] = useState<View>(initial)
  const [visitedViews, setVisitedViews] = useState<Set<View>>(() => new Set([initial]))
  const [equipmentTarget, setEquipmentTarget] = useState(initialEquipmentTarget)
  const [returnEquipmentId, setReturnEquipmentId] = useState('')
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [preferenceMode, setPreferenceMode] = useState<'cookie' | 'notifications' | null>(null)
  const sessionEmail = session.email

  const markVisited = useCallback((nextView: View) => {
    setVisitedViews((current) => current.has(nextView) ? current : new Set([...current, nextView]))
  }, [])

  const visibleNav = useMemo(() => NAV.filter((item) => !item.adminOnly || canViewAudit(role)), [role])
  const mobileMoreItems = useMemo(() => visibleNav.filter((item) => !MOBILE_PRIMARY.some((primary) => primary.id === item.id)), [visibleNav])
  const mountedViews = useMemo(() => visibleNav.filter((item) => visitedViews.has(item.id)), [visibleNav, visitedViews])

  function openEquipmentFromQr(equipmentId: string) {
    setMobileMoreOpen(false)
    markVisited('equipment')
    setEquipmentTarget(equipmentId)
    setView('equipment')
    syncUrl('equipment', equipmentId)
  }

  function openView(requestedView: View) {
    const nextView = permittedView(requestedView, role)
    setMobileMoreOpen(false)
    setReturnEquipmentId('')
    markVisited(nextView)
    setView(nextView)
    setEquipmentTarget('')
    syncUrl(nextView)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const openContextView = useCallback((requestedView: View, equipmentId: string) => {
    const nextView = permittedView(requestedView, role)
    const normalizedEquipmentId = equipmentId.trim().toUpperCase()
    setMobileMoreOpen(false)
    setReturnEquipmentId(normalizedEquipmentId)
    markVisited(nextView)
    setView(nextView)
    setEquipmentTarget('')
    syncUrl(nextView, normalizedEquipmentId)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [markVisited, role])

  function backToEquipmentContext() {
    if (!returnEquipmentId) return
    const equipmentId = returnEquipmentId
    setReturnEquipmentId('')
    markVisited('equipment')
    setEquipmentTarget(equipmentId)
    setView('equipment')
    syncUrl('equipment', equipmentId)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function closeQrResult() {
    markVisited('qr')
    setEquipmentTarget('')
    setView('qr')
    syncUrl('qr')
  }

  function editQrResult() {
    markVisited('equipment')
    setEquipmentTarget('')
    setView('equipment')
    syncUrl('equipment')
  }

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: View; equipmentId?: string }>).detail
      const requested = detail?.view
      if (requested && NAV.some((item) => item.id === requested)) openContextView(requested, detail?.equipmentId || '')
    }
    window.addEventListener('cev:navigate', handleNavigate)
    return () => window.removeEventListener('cev:navigate', handleNavigate)
  }, [openContextView])

  const mobileNav = <>
    <nav className="bottom-nav mobile-primary-nav" aria-label="Điều hướng trên điện thoại">
      {MOBILE_PRIMARY.map((item) => <button key={item.id} type="button" className={`${item.id === view ? 'active ' : ''}${item.id === 'qr' ? 'scan-action' : ''}`.trim()} aria-current={item.id === view ? 'page' : undefined} onClick={() => openView(item.id)}><span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}
      <button type="button" className={mobileMoreOpen ? 'active' : ''} aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen((current) => !current)}><span className="mobile-nav-icon" aria-hidden="true">•••</span><span>Thêm</span></button>
    </nav>
    {mobileMoreOpen ? <div className="mobile-more-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMoreOpen(false) }}>
      <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Các chức năng khác">
        <header><div><p className="eyebrow">Quản lý thiết bị CEV</p><h2>Chức năng khác</h2></div><button type="button" aria-label="Đóng" onClick={() => setMobileMoreOpen(false)}>×</button></header>
        <div className="mobile-more-grid">{mobileMoreItems.map((item) => <button key={item.id} type="button" className={item.id === view ? 'active' : ''} onClick={() => openView(item.id)}><strong>{item.label}</strong><small>Mở chức năng</small></button>)}</div>
        <div className="mobile-more-account"><strong>{ROLE_LABEL[role]}</strong><span>{sessionEmail || 'Xác thực Supabase'}</span><button type="button" onClick={() => { setMobileMoreOpen(false); void signOut() }}>Đăng xuất</button></div>
      </section>
    </div> : null}
  </>

  return <AppRoleProvider role={role}>
    <div className="app-shell" data-role={role}>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <DesktopSidebar items={visibleNav} currentView={view} roleLabel={ROLE_LABEL[role]} email={sessionEmail || ''} onNavigate={openView} onSignOut={() => void signOut()} />
      <div className="app-body">
        <header className="workspace-topbar">
          <div><p className="eyebrow">CEV CMMS · UpKeep workspace</p><h1>{NAV.find((item) => item.id === view)?.label || 'Tổng quan'}</h1></div>
          <div className="workspace-topbar-actions">
            <NotificationCenter />
            <AccountMenu email={sessionEmail || ''} role={role} signOut={signOut} onProfile={() => openView('settings')} onCompanyProfile={() => openView('organization')} onCookieSettings={() => setPreferenceMode('cookie')} onNotificationSettings={() => setPreferenceMode('notifications')} />
          </div>
        </header>
        <main id="main-content" className={`main-content${view === 'equipment' ? ' equipment-main' : ''}`} tabIndex={-1}>
          {returnEquipmentId && view !== 'equipment' ? <div className="equipment-context-nav"><button type="button" onClick={backToEquipmentContext}>← Trở về {returnEquipmentId}</button><span>Đang làm việc trong ngữ cảnh thiết bị {returnEquipmentId}</span></div> : null}
          {mountedViews.map((item) => <section key={item.id} hidden={item.id !== view} aria-hidden={item.id !== view} className="workspace-keepalive-pane"><AppErrorBoundary><Suspense fallback={<div className="workspace-loading" role="status">Đang mở chức năng…</div>}><LiveView view={item.id} equipmentTarget={item.id === 'equipment' && view === 'equipment' ? equipmentTarget : ''} contextEquipmentId={item.id === view ? returnEquipmentId : ''} onOpenEquipment={openEquipmentFromQr} onCloseQrResult={closeQrResult} onEditQrResult={editQrResult} onNavigate={openView} /></Suspense></AppErrorBoundary></section>)}
        </main>
      </div>
    </div>
    <AccountPreferences mode={preferenceMode} onClose={() => setPreferenceMode(null)} />
    {createPortal(mobileNav, document.body)}
  </AppRoleProvider>
}