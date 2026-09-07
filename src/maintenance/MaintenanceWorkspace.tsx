import { lazy, Suspense, useState } from 'react'
import './MaintenanceWorkspace.css'
import './MaintenanceWorkflowHistory.css'

const LiveMaintenancePanel = lazy(() => import('../LiveMaintenancePanel').then((module) => ({ default: module.LiveMaintenancePanel })))
const MaintenanceWorkloadPanel = lazy(() => import('./MaintenanceWorkloadPanel').then((module) => ({ default: module.MaintenanceWorkloadPanel })))
const LiveMaintenancePlanPanel = lazy(() => import('../LiveMaintenancePlanPanel').then((module) => ({ default: module.LiveMaintenancePlanPanel })))
const LiveMaintenanceResultPanel = lazy(() => import('../LiveMaintenanceResultPanel').then((module) => ({ default: module.LiveMaintenanceResultPanel })))
const LiveHandoverPanel = lazy(() => import('../LiveHandoverPanel').then((module) => ({ default: module.LiveHandoverPanel })))
const LiveDowntimePanel = lazy(() => import('../LiveDowntimePanel').then((module) => ({ default: module.LiveDowntimePanel })))

type MaintenanceTab = 'work-orders' | 'workload' | 'plans' | 'results' | 'handovers' | 'downtime'

type TabDefinition = {
  id: MaintenanceTab
  label: string
  shortLabel: string
  description: string
}

const TABS: TabDefinition[] = [
  { id: 'work-orders', label: 'Công việc', shortLabel: 'Công việc', description: 'Hàng đợi lệnh công việc và hành động tiếp theo' },
  { id: 'workload', label: 'Phân công', shortLabel: 'Phân công', description: 'My Work và tải công việc theo từng nhân sự' },
  { id: 'plans', label: 'Kế hoạch', shortLabel: 'Kế hoạch', description: 'Kế hoạch bảo dưỡng định kỳ BM-03' },
  { id: 'results', label: 'Kết quả', shortLabel: 'Kết quả', description: 'Kết quả thực hiện bảo dưỡng / sửa chữa BM-08' },
  { id: 'handovers', label: 'Bàn giao', shortLabel: 'Bàn giao', description: 'Biên bản bàn giao thiết bị BM-05' },
  { id: 'downtime', label: 'Dừng máy', shortLabel: 'Dừng máy', description: 'Theo dõi thời gian và nguyên nhân dừng máy' },
]

function preloadTab(tab: MaintenanceTab) {
  if (tab === 'work-orders') return import('../LiveMaintenancePanel')
  if (tab === 'workload') return import('./MaintenanceWorkloadPanel')
  if (tab === 'plans') return import('../LiveMaintenancePlanPanel')
  if (tab === 'results') return import('../LiveMaintenanceResultPanel')
  if (tab === 'handovers') return import('../LiveHandoverPanel')
  return import('../LiveDowntimePanel')
}

function MaintenanceTabPanel({ tab, equipmentId }: { tab: MaintenanceTab; equipmentId: string }) {
  if (tab === 'work-orders') return <LiveMaintenancePanel equipmentId={equipmentId} />
  if (tab === 'workload') return <MaintenanceWorkloadPanel />
  if (tab === 'plans') return <LiveMaintenancePlanPanel />
  if (tab === 'results') return <LiveMaintenanceResultPanel />
  if (tab === 'handovers') return <LiveHandoverPanel />
  return <LiveDowntimePanel />
}

export function MaintenanceWorkspace({ equipmentId = '' }: { equipmentId?: string }) {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('work-orders')
  const [visitedTabs, setVisitedTabs] = useState<Set<MaintenanceTab>>(() => new Set(['work-orders']))
  const activeDefinition = TABS.find((tab) => tab.id === activeTab) || TABS[0]

  function openTab(tab: MaintenanceTab) {
    setVisitedTabs((current) => current.has(tab) ? current : new Set([...current, tab]))
    setActiveTab(tab)
  }

  return <div className="maintenance-workspace">
    <header className="maintenance-workspace-header">
      <div><p className="eyebrow">CMMS · Thiết bị sản xuất</p><h1>Bảo trì thiết bị</h1><p>{equipmentId ? `Đang theo dõi công việc liên quan đến ${equipmentId}. Hàng đợi công việc tự lọc theo thiết bị để giữ nguyên ngữ cảnh từ hồ sơ máy.` : 'Một nơi xử lý công việc bảo trì từ tiếp nhận đến bàn giao. Phân công, My Work và tải nhân sự được tách riêng để supervisor cân bằng công việc mà không làm rối hàng đợi.'}</p></div>
      <div className="maintenance-workspace-current"><span>{equipmentId ? 'Ngữ cảnh thiết bị' : 'Đang xem'}</span><strong>{equipmentId || activeDefinition.label}</strong><small>{equipmentId ? activeDefinition.label : activeDefinition.description}</small></div>
    </header>

    <nav className="maintenance-workspace-tabs" aria-label="Chức năng bảo trì">
      {TABS.map((tab) => <button
        key={tab.id}
        type="button"
        className={activeTab === tab.id ? 'active' : ''}
        aria-current={activeTab === tab.id ? 'page' : undefined}
        aria-controls={`maintenance-tab-${tab.id}`}
        onPointerEnter={() => { void preloadTab(tab.id) }}
        onFocus={() => { void preloadTab(tab.id) }}
        onClick={() => openTab(tab.id)}
      ><span>{tab.shortLabel}</span><small>{tab.description}</small></button>)}
    </nav>

    <div className="maintenance-workspace-panels">
      {TABS.filter((tab) => visitedTabs.has(tab.id)).map((tab) => <section
        key={tab.id}
        id={`maintenance-tab-${tab.id}`}
        className="maintenance-workspace-panel"
        hidden={activeTab !== tab.id}
        aria-hidden={activeTab !== tab.id}
      ><Suspense fallback={<div className="workspace-loading" role="status">Đang mở {tab.label.toLocaleLowerCase('vi-VN')}…</div>}><MaintenanceTabPanel tab={tab.id} equipmentId={equipmentId} /></Suspense></section>)}
    </div>
  </div>
}
