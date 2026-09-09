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
import { GeneralSettingsMenu } from './GeneralSettingsMenu'
import { SettingsWorkspace } from './SettingsWorkspace'

const A4PrintCenter = lazy(() => import('./A4PrintCenter').then((module) => ({ default: module.A4PrintCenter })))
const LiveAuditPanel = lazy(() => import('./LiveAuditPanel').then((module) => ({ default: module.LiveAuditPanel })))
const LiveCalibrationEvaluationPanel = lazy(() => import('./LiveCalibrationEvaluationPanel').then((module) => ({ default: module.LiveCalibrationEvaluationPanel })))
const LiveCalibrationPanel = lazy(() => import('./LiveCalibrationPanel').then((module) => ({ default: module.LiveCalibrationPanel })))
const LiveCalibrationQuotePanel = lazy(() => import('./LiveCalibrationQuotePanel').then((module) => ({ default: module.LiveCalibrationQuotePanel })))
const LiveDashboardPanel = lazy(() => import('./LiveDashboardPanel').then((module) => ({ default: module.LiveDashboardPanel })))
const LiveAnalyticsPanel = lazy(() => import('./LiveAnalyticsPanel').then((module) => ({ default: module.LiveAnalyticsPanel })))
const LiveSchedulerPanel = lazy(() => import('./LiveSchedulerPanel').then((module) => ({ default: module.LiveSchedulerPanel })))
const EquipmentWorkspace = lazy(() => import('./equipment/EquipmentWorkspace').then((module) => ({ default: module.EquipmentWorkspace })))
const LiveEquipmentInventoryPanel = lazy(() => import('./LiveEquipmentInventoryPanel').then((module) => ({ default: module.LiveEquipmentInventoryPanel })))
const LiveInspectionPanel = lazy(() => import('./LiveInspectionPanel').then((module) => ({ default: module.LiveInspectionPanel })))
const MaintenanceWorkspace = lazy(() => import('./maintenance/MaintenanceWorkspace').then((module) => ({ default: module.MaintenanceWorkspace })))
const LiveQrScannerPanel = lazy(() => import('./LiveQrScannerPanel').then((module) => ({ default: module.LiveQrScannerPanel })))
const QrEquipmentResult = lazy(() => import('./QrEquipmentResult').then((module) => ({ default: module.QrEquipmentResult })))
const LiveSparePartsAutoPanel = lazy(() => import('./LiveSparePartsAutoPanel').then((module) => ({ default: module.LiveSparePartsAutoPanel })))
const LiveToolingPanel = lazy(() => import('./LiveToolingPanel').then((module) => ({ default: module.LiveToolingPanel })))
const OrgManagementPanel = lazy(() => import('./OrgManagementPanel').then((module) => ({ default: module.OrgManagementPanel })))
const ProvidersNetworkPanel = lazy(() => import('./ProvidersNetworkPanel').then((module) => ({ default: module.ProvidersNetworkPanel })))
const CustomersListPanel = lazy(() => import('./CustomersListPanel').then((module) => ({ default: module.CustomersListPanel })))
const PurchaseOrdersPanel = lazy(() => import('./PurchaseOrdersPanel').then((module) => ({ default: module.PurchaseOrdersPanel })))
const CycleCountsPanel = lazy(() => import('./CycleCountsPanel').then((module) => ({ default: module.CycleCountsPanel })))
const SetsListPanel = lazy(() => import('./SetsListPanel').then((module) => ({ default: module.SetsListPanel })))
const ReferenceModulePanel = lazy(() => import('./ReferenceModulePanels').then((module) => ({ default: module.ReferenceModulePanel })))
const RequestsListPanel = lazy(() => import('./RequestsListPanel').then((module) => ({ default: module.RequestsListPanel })))
const WorkOrderCreatePanel = lazy(() => import('./WorkOrderCreatePanel').then((module) => ({ default: module.WorkOrderCreatePanel })))
const NotificationSettingsPanel = lazy(() => import('./NotificationSettingsPanel').then((module) => ({ default: module.NotificationSettingsPanel })))
const WorkOrderExportPanel = lazy(() => import('./WorkOrderExportPanel').then((module) => ({ default: module.WorkOrderExportPanel })))

type View = 'dashboard' | 'qr' | 'work-orders' | 'maintenance' | 'scheduler' | 'requests' | 'analytics' | 'meters' | 'edge' | 'equipment' | 'locations' | 'people' | 'inspection' | 'files' | 'import-export' | 'inventory' | 'cycle-counts' | 'sets' | 'files-upkeep' | 'checklists-upkeep' | 'people-upkeep' | 'locations-upkeep' | 'locations-map' | 'teams-upkeep' | 'imports-upkeep' | 'inventory-upkeep' | 'parts-upkeep' | 'edge-upkeep' | 'meters-upkeep' | 'analytics-upkeep' | 'analytics-complete-upkeep' | 'requests-upkeep' | 'work-order-create' | 'notification-settings' | 'work-order-export' | 'spare' | 'purchase-orders' | 'customers' | 'providers' | 'tooling' | 'calibration' | 'print' | 'organization' | 'settings'

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
  { id: 'cycle-counts', label: 'Kiểm kê chu kỳ' },
  { id: 'sets', label: 'Bộ thẻ' },
  { id: 'files-upkeep', label: 'Tệp (UpKeep)' },
  { id: 'checklists-upkeep', label: 'Checklist (UpKeep)' },
  { id: 'people-upkeep', label: 'Nhân sự (UpKeep)' },
  { id: 'locations-upkeep', label: 'Địa điểm (UpKeep)' },
  { id: 'locations-map', label: 'Bản đồ địa điểm' },
  { id: 'teams-upkeep', label: 'Nhóm (UpKeep)' },
  { id: 'imports-upkeep', label: 'Nhập work order' },
  { id: 'inventory-upkeep', label: 'Kho & phụ tùng (UpKeep)' },
  { id: 'parts-upkeep', label: 'Phụ tùng (UpKeep)' },
  { id: 'edge-upkeep', label: 'Edge (UpKeep)' },
  { id: 'meters-upkeep', label: 'Đồng hồ đo (UpKeep)' },
  { id: 'analytics-upkeep', label: 'Phân tích (UpKeep)' },
  { id: 'analytics-complete-upkeep', label: 'Phân tích hoàn thành (UpKeep)' },
  { id: 'requests-upkeep', label: 'Yêu cầu (UpKeep)' },
  { id: 'work-order-create', label: 'Tạo Work Order (UpKeep)' },
  { id: 'notification-settings', label: 'Thông báo (UpKeep)' },
  { id: 'work-order-export', label: 'Xuất Work Order (UpKeep)' },
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
  if (view === 'analytics') return <LiveAnalyticsPanel />
  if (view === 'scheduler') return <LiveSchedulerPanel />
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
  if (view === 'providers') return <ProvidersNetworkPanel />
  if (view === 'customers') return <CustomersListPanel />
  if (view === 'purchase-orders') return <PurchaseOrdersPanel />
  if (view === 'cycle-counts') return <CycleCountsPanel />
  if (view === 'sets') return <SetsListPanel />
  if (view === 'files-upkeep') return <ReferenceModulePanel kind="files" />
  if (view === 'checklists-upkeep') return <ReferenceModulePanel kind="checklists" />
  if (view === 'people-upkeep') return <ReferenceModulePanel kind="people" />
  if (view === 'locations-upkeep') return <ReferenceModulePanel kind="locations" />
  if (view === 'locations-map') return <ReferenceModulePanel kind="locations-map" />
  if (view === 'teams-upkeep') return <ReferenceModulePanel kind="teams" />
  if (view === 'imports-upkeep') return <ReferenceModulePanel kind="imports" />
  if (view === 'inventory-upkeep') return <ReferenceModulePanel kind="inventory" />
  if (view === 'parts-upkeep') return <ReferenceModulePanel kind="parts" />
  if (view === 'edge-upkeep') return <ReferenceModulePanel kind="edge" />
  if (view === 'meters-upkeep') return <ReferenceModulePanel kind="meters" />
  if (view === 'analytics-upkeep') return <ReferenceModulePanel kind="analytics-open" />
  if (view === 'analytics-complete-upkeep') return <ReferenceModulePanel kind="analytics-complete" />
  if (view === 'requests-upkeep') return <RequestsListPanel />
  if (view === 'work-order-create') return <WorkOrderCreatePanel />
  if (view === 'notification-settings') return <NotificationSettingsPanel />
  if (view === 'work-order-export') return <WorkOrderExportPanel />
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
  const [settingsOpen, setSettingsOpen] = useState(false)
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
            <GeneralSettingsMenu onOpenCompanyProfile={() => openView('organization')} onOpenOrganization={() => openView('organization')} onOpenAudit={() => setSettingsOpen(true)} />
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
    {settingsOpen ? <SettingsWorkspace onClose={() => setSettingsOpen(false)} /> : null}
    {createPortal(mobileNav, document.body)}
  </AppRoleProvider>
}