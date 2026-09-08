type Prefetcher = () => Promise<unknown>

const loaded = new Set<string>()
const loading = new Map<string, Promise<unknown>>()

const prefetchers: Record<string, Prefetcher> = {
  dashboard: () => import('../LiveDashboardPanel'),
  qr: () => import('../LiveQrScannerPanel'),
  equipment: () => Promise.all([
    import('../equipment/EquipmentWorkspace'),
    import('../LiveEquipmentRegistrationPanel'),
    import('../QrEquipmentResult'),
  ]),
  inventory: async () => {
    const [, data] = await Promise.all([import('../LiveEquipmentInventoryPanel'), import('./liveEquipmentInventory')])
    await data.warmEquipmentInventory()
  },
  inspection: () => import('../LiveInspectionPanel'),
  maintenance: async () => {
    const [, data] = await Promise.all([import('../maintenance/MaintenanceWorkspace'), import('./liveMaintenance')])
    await data.loadLiveMaintenance().then(() => undefined)
  },
  spare: () => import('../LiveSparePartsAutoPanel'),
  tooling: () => import('../LiveToolingPanel'),
  calibration: () => Promise.all([
    import('../LiveCalibrationPanel'),
    import('../LiveCalibrationEvaluationPanel'),
    import('../LiveCalibrationQuotePanel'),
  ]),
  print: () => import('../A4PrintCenter'),
  settings: () => import('../LiveAuditPanel'),
}

const labelToView: Array<[string, string]> = [
  ['Nhật ký & cấu hình', 'settings'],
  ['Jig, gá & dụng cụ', 'tooling'],
  ['Kiểm kê thiết bị', 'inventory'],
  ['Kiểm kê', 'inventory'],
  ['Kiểm tra ngày', 'inspection'],
  ['Hồ sơ A4', 'print'],
  ['Hiệu chuẩn', 'calibration'],
  ['Phụ tùng', 'spare'],
  ['Bảo trì', 'maintenance'],
  ['Công việc', 'maintenance'],
  ['Thiết bị', 'equipment'],
  ['Quét QR', 'qr'],
  ['Tổng quan', 'dashboard'],
  ['Trang chủ', 'dashboard'],
]

export function prefetchViewCode(view: string) {
  const run = prefetchers[view]
  if (!run || loaded.has(view)) return Promise.resolve()
  const existing = loading.get(view)
  if (existing) return existing
  const task = run()
    .then(() => { loaded.add(view) })
    .catch(() => undefined)
    .finally(() => { loading.delete(view) })
  loading.set(view, task)
  return task
}

function viewFromNavigationButton(button: HTMLButtonElement) {
  const label = (button.textContent || '').replace(/\s+/g, ' ').trim()
  return labelToView.find(([candidate]) => label.includes(candidate))?.[1] || ''
}

function handleIntent(event: Event) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('.sidebar nav button, .mobile-primary-nav button, .mobile-more-grid button, .dashboard-mobile-actions button')
  if (!button) return
  const view = viewFromNavigationButton(button)
  if (view) void prefetchViewCode(view)
}

export function installNavigationPrefetch() {
  document.addEventListener('pointerover', handleIntent, { passive: true })
  document.addEventListener('focusin', handleIntent)
}
