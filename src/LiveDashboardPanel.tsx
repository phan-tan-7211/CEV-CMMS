import { useEffect, useState } from 'react'
import './Dashboard.css'
import { getDashboardCacheSnapshot, loadLiveDashboard, type LiveDashboardAction, type LiveDashboardSummary } from './data/liveDashboard'

const EMPTY: LiveDashboardSummary = {
  equipmentTotal: 0,
  productionCount: 0,
  measurementCount: 0,
  runningCount: 0,
  downCount: 0,
  calibrationTotal: 0,
  calibrationOverdue: 0,
  workOrderOpen: 0,
  criticalOpen: 0,
  pmOverdue: 0,
  downtimeOpen: 0,
  downtimeMinutes: 0,
}

const kindLabel: Record<LiveDashboardAction['kind'], string> = {
  DOWN: 'DỪNG MÁY',
  CRITICAL_WO: 'LỆNH KHẨN CẤP',
  CALIBRATION_OVERDUE: 'HIỆU CHUẨN',
  PM_OVERDUE: 'BẢO DƯỠNG ĐỊNH KỲ',
  DOWNTIME_OPEN: 'DỪNG MÁY',
}

type DashboardTarget = 'qr' | 'maintenance' | 'equipment' | 'inventory' | 'inspection' | 'calibration'

type Props = {
  onNavigate?: (view: DashboardTarget) => void
}

function dateText(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

function actionTarget(action: LiveDashboardAction): DashboardTarget {
  if (action.kind === 'DOWN') return 'equipment'
  if (action.kind === 'CALIBRATION_OVERDUE') return 'calibration'
  return 'maintenance'
}

export function LiveDashboardPanel({ onNavigate }: Props) {
  const [initialSnapshot] = useState(getDashboardCacheSnapshot)
  const [summary, setSummary] = useState<LiveDashboardSummary>(() => initialSnapshot?.summary || EMPTY)
  const [actions, setActions] = useState<LiveDashboardAction[]>(() => initialSnapshot?.actions || [])
  const [loading, setLoading] = useState(!initialSnapshot)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadLiveDashboard(new Date().toISOString().slice(0, 10), { force: Boolean(initialSnapshot) })
      .then((result) => {
        if (!active) return
        setSummary(result.summary)
        setActions(result.actions)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active && !initialSnapshot) setError(cause instanceof Error ? cause.message : 'Không thể tải tổng quan')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [initialSnapshot])

  const urgentCount = summary.downCount + summary.criticalOpen + summary.downtimeOpen

  return <div className="dashboard-page">
    <section className="dashboard-command" aria-labelledby="live-dashboard-title">
      <div>
        <p className="eyebrow">IATF 16949 · Trung tâm kiểm soát thiết bị</p>
        <h2 id="live-dashboard-title">Trung tâm điều hành thiết bị</h2>
        <p>Ưu tiên bất thường cần xử lý trước, sau đó mới đến chỉ số tổng hợp.</p>
      </div>
      <div className="dashboard-live"><span />DỮ LIỆU TRỰC TIẾP</div>
    </section>

    <section className="dashboard-mobile-actions" aria-label="Thao tác nhanh">
      <button type="button" className="primary" onClick={() => onNavigate?.('qr')}><span aria-hidden="true">▣</span><strong>Quét QR</strong><small>Mở thiết bị ngay</small></button>
      <button type="button" onClick={() => onNavigate?.('maintenance')}><span aria-hidden="true">⚒</span><strong>Công việc</strong><small>Lệnh bảo trì & kế hoạch</small></button>
      <button type="button" onClick={() => onNavigate?.('equipment')}><span aria-hidden="true">▤</span><strong>Thiết bị</strong><small>Danh mục & hồ sơ</small></button>
      <button type="button" onClick={() => onNavigate?.('inventory')}><span aria-hidden="true">◎</span><strong>Kiểm kê</strong><small>Quét tem · xác nhận hiện trạng</small></button>
      <button type="button" onClick={() => onNavigate?.('inspection')}><span aria-hidden="true">✓</span><strong>Kiểm tra</strong><small>Kiểm tra hằng ngày</small></button>
    </section>

    {loading ? <section className="dashboard-state" role="status">Đang tải dữ liệu thiết bị…</section> : null}
    {error ? <section className="dashboard-state error" role="alert"><b>Không tải được tổng quan</b><span>{error}</span></section> : null}

    {!loading && !error ? <>
      <section className="dashboard-priority-grid" aria-label="Các chỉ số cần hành động">
        <button type="button" className={summary.downCount ? 'needs-action' : ''} onClick={() => onNavigate?.('equipment')}>
          <span>Máy đang dừng</span><strong>{summary.downCount}</strong><small>{summary.downCount ? 'Cần xử lý ngay · Mở Thiết bị' : 'Không có máy đang dừng'}</small>
        </button>
        <button type="button" className={summary.criticalOpen ? 'needs-action' : ''} onClick={() => onNavigate?.('maintenance')}>
          <span>Lệnh khẩn cấp</span><strong>{summary.criticalOpen}</strong><small>{summary.workOrderOpen} lệnh công việc đang mở · Mở Bảo trì</small>
        </button>
        <button type="button" className={summary.calibrationOverdue ? 'warning' : ''} onClick={() => onNavigate?.('calibration')}>
          <span>Hiệu chuẩn quá hạn</span><strong>{summary.calibrationOverdue}</strong><small>{summary.calibrationTotal} hồ sơ hiệu chuẩn · Mở Hiệu chuẩn</small>
        </button>
        <button type="button" className={summary.pmOverdue ? 'warning' : ''} onClick={() => onNavigate?.('maintenance')}>
          <span>Bảo dưỡng định kỳ quá hạn</span><strong>{summary.pmOverdue}</strong><small>Kế hoạch cần cập nhật · Mở Bảo trì</small>
        </button>
      </section>

      <section className="dashboard-overview-strip" aria-label="Tình trạng hệ thống">
        <div><span>Tổng thiết bị</span><b>{summary.equipmentTotal}</b><small>{summary.productionCount} sản xuất · {summary.measurementCount} đo kiểm</small></div>
        <div><span>Đang hoạt động</span><b>{summary.runningCount}</b><small>Danh mục thiết bị</small></div>
        <div><span>Sự kiện dừng máy đang mở</span><b>{summary.downtimeOpen}</b><small>{summary.downtimeMinutes.toLocaleString('vi-VN')} phút ghi nhận</small></div>
        <div><span>Cần chú ý ngay</span><b>{urgentCount}</b><small>Máy dừng + lệnh khẩn cấp + sự kiện dừng máy đang mở</small></div>
      </section>

      <section className="dashboard-action-panel" aria-labelledby="dashboard-actions-title">
        <header>
          <div><p className="eyebrow">Danh sách ưu tiên</p><h3 id="dashboard-actions-title">Việc cần xử lý</h3></div>
          <span className={actions.length ? 'dashboard-action-count active' : 'dashboard-action-count'}>{actions.length} mục</span>
        </header>

        {actions.length ? <div className="dashboard-action-list">
          {actions.slice(0, 30).map((action) => <button type="button" key={`${action.kind}-${action.sourceId}`} className={`dashboard-action-row ${action.severity.toLowerCase()}`} onClick={() => onNavigate?.(actionTarget(action))}>
            <div className="dashboard-action-kind">{kindLabel[action.kind]}</div>
            <div className="dashboard-action-equipment"><b>{action.equipmentId || '—'}</b><span>{action.equipmentName || 'Chưa có tên thiết bị'}</span></div>
            <div className="dashboard-action-detail"><b>{action.title}</b><span>{action.detail}</span></div>
            <div className="dashboard-action-source"><b>{action.sourceId || '—'}</b><span>{dateText(action.date)}</span></div>
            <span className="dashboard-action-open" aria-hidden="true">Mở →</span>
          </button>)}
        </div> : <div className="dashboard-clear-state"><strong>Không có cảnh báo ưu tiên.</strong><span>Không có máy dừng, lệnh khẩn cấp, hiệu chuẩn/bảo dưỡng quá hạn hoặc sự kiện dừng máy đang mở.</span></div>}
      </section>

      <section className="dashboard-workflow">
        <p className="eyebrow">Luồng kiểm soát</p>
        <div><span>Kiểm tra ngày</span><b>→</b><span>Lệnh công việc</span><b>→</b><span>Phê duyệt</span><b>→</b><span>Thực hiện</span><b>→</b><span>Xác nhận</span><b>→</b><span>BM-05 bàn giao</span><b>→</b><span>Chỉ số</span></div>
      </section>
    </> : null}
  </div>
}
