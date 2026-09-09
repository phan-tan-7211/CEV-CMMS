import { useEffect, useMemo, useState } from 'react'
import './LiveAnalyticsPanel.css'
import {
  loadAnalyticsFilterOptions,
  loadAnalyticsSnapshot,
  type AnalyticsBucket,
  type AnalyticsDashboard,
  type AnalyticsDrilldown,
  type AnalyticsFilterOption,
  type AnalyticsMetric,
  type AnalyticsTrend,
} from './data/liveAnalytics'

type Snapshot = { dashboard: AnalyticsDashboard; trends: AnalyticsTrend[]; drilldown: AnalyticsDrilldown[] }

const METRICS: Array<{ id: AnalyticsMetric; label: string }> = [
  { id: 'DOWNTIME', label: 'Dừng máy' },
  { id: 'WORK_ORDER', label: 'Work Order' },
  { id: 'COST', label: 'Chi phí' },
  { id: 'OEE', label: 'OEE' },
]

function localDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function daysAgo(days: number) {
  return localDateValue(new Date(Date.now() - days * 86400000))
}

function startIso(date: string) { return `${date}T00:00:00+07:00` }
function endExclusiveIso(date: string) {
  const value = new Date(`${date}T00:00:00+07:00`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString()
}
function numberText(value: number | null, digits = 0) {
  if (value == null) return '—'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value)
}
function percentText(value: number | null) { return value == null ? '—' : `${numberText(value, 2)}%` }
function dateText(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
function shortDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }).format(date)
}

function metricValue(row: AnalyticsTrend, metric: AnalyticsMetric) {
  if (metric === 'WORK_ORDER') return row.workOrdersCreated
  if (metric === 'COST') return row.maintenanceCost
  if (metric === 'OEE') return row.oeePercent
  return row.downtimeMinutes
}

function metricUnit(metric: AnalyticsMetric) {
  if (metric === 'WORK_ORDER') return 'WO'
  if (metric === 'COST') return ''
  if (metric === 'OEE') return '%'
  return 'phút'
}

export function LiveAnalyticsPanel() {
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate] = useState(localDateValue(new Date()))
  const [bucket, setBucket] = useState<AnalyticsBucket>('DAY')
  const [metric, setMetric] = useState<AnalyticsMetric>('DOWNTIME')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [locations, setLocations] = useState<AnalyticsFilterOption[]>([])
  const [equipment, setEquipment] = useState<AnalyticsFilterOption[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh(nextMetric = metric) {
    if (!startDate || !endDate || startDate > endDate) {
      setError('Khoảng thời gian không hợp lệ.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await loadAnalyticsSnapshot({
        startAt: startIso(startDate),
        endAt: endExclusiveIso(endDate),
        bucket,
        timezone: 'Asia/Ho_Chi_Minh',
        locationId,
        equipmentId,
        metric: nextMetric,
      })
      setSnapshot(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu phân tích.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    loadAnalyticsFilterOptions()
      .then((result) => {
        if (!active) return
        setLocations(result.locations)
        setEquipment(result.equipment)
      })
      .catch(() => {})
    void refresh()
    return () => { active = false }
    // Initial load only; filters are applied explicitly to avoid expensive requests on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trendMax = useMemo(() => {
    const values = (snapshot?.trends || []).map((row) => metricValue(row, metric) || 0)
    return metric === 'OEE' ? 100 : Math.max(1, ...values)
  }, [snapshot?.trends, metric])

  const dashboard = snapshot?.dashboard
  const noActivity = Boolean(snapshot) && (snapshot?.trends || []).every((row) =>
    row.workOrdersCreated === 0 && row.downtimeEvents === 0 && row.maintenanceCost === 0 && row.oeePercent == null,
  )

  function applyPreset(days: number) {
    setStartDate(daysAgo(days))
    setEndDate(localDateValue(new Date()))
  }

  async function chooseMetric(nextMetric: AnalyticsMetric) {
    setMetric(nextMetric)
    await refresh(nextMetric)
  }

  return <div className="live-analytics-page">
    <section className="analytics-hero">
      <div>
        <p className="eyebrow">CEV CMMS · Analytics</p>
        <h2>Phân tích bảo trì & hiệu suất</h2>
        <p>Work Order, downtime, chi phí và OEE từ dữ liệu vận hành thực tế. Múi giờ báo cáo: Việt Nam (UTC+7).</p>
      </div>
      <div className="analytics-live"><span />LIVE DATA</div>
    </section>

    <section className="analytics-filters" aria-label="Bộ lọc phân tích">
      <label><span>Từ ngày</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Đến ngày</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <label><span>Nhóm thời gian</span><select value={bucket} onChange={(event) => setBucket(event.target.value as AnalyticsBucket)}><option value="DAY">Ngày</option><option value="WEEK">Tuần</option><option value="MONTH">Tháng</option></select></label>
      <label><span>Địa điểm</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Tất cả địa điểm</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label><span>Thiết bị</span><select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}><option value="">Tất cả thiết bị</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <button type="button" className="analytics-apply" onClick={() => void refresh()}>Áp dụng</button>
      <div className="analytics-presets"><button type="button" onClick={() => applyPreset(30)}>30 ngày</button><button type="button" onClick={() => applyPreset(90)}>90 ngày</button><button type="button" onClick={() => applyPreset(365)}>12 tháng</button><button type="button" onClick={() => applyPreset(15 * 365)}>Lịch sử</button></div>
    </section>

    {loading ? <div className="analytics-state" role="status">Đang tổng hợp dữ liệu…</div> : null}
    {error ? <div className="analytics-state error" role="alert"><b>Không tải được Analytics</b><span>{error}</span></div> : null}

    {!loading && !error && dashboard ? <>
      <section className="analytics-kpi-grid">
        <article><span>Work Order</span><strong>{numberText(dashboard.workOrders.total)}</strong><small>{dashboard.workOrders.backlog} tồn · hoàn thành {percentText(dashboard.workOrders.completionRate)}</small></article>
        <article><span>Downtime</span><strong>{numberText(dashboard.reliability.downtimeMinutes, 2)}</strong><small>phút · {dashboard.reliability.downtimeEvents} sự kiện · {dashboard.reliability.openDowntimeEvents} đang mở</small></article>
        <article><span>Chi phí bảo trì</span><strong>{numberText(dashboard.cost.total, 2)}</strong><small>Phụ tùng {numberText(dashboard.cost.parts, 2)} · Nhân công {numberText(dashboard.cost.labor, 2)}</small></article>
        <article><span>PM Compliance</span><strong>{percentText(dashboard.preventiveMaintenance.complianceRate)}</strong><small>{dashboard.preventiveMaintenance.completed}/{dashboard.preventiveMaintenance.generated} WO PM hoàn thành</small></article>
        <article><span>MTTR / MTBF</span><strong>{numberText(dashboard.reliability.mttrHours, 2)} / {numberText(dashboard.reliability.mtbfHours, 2)}</strong><small>giờ sửa chữa / giờ giữa hai lần hỏng</small></article>
        <article><span>SLA breach</span><strong>{percentText(dashboard.sla.breachRate)}</strong><small>{dashboard.sla.breached}/{dashboard.sla.total} trường hợp vi phạm</small></article>
        <article><span>Tồn kho rủi ro</span><strong>{dashboard.inventory.lowStockParts}</strong><small>{dashboard.inventory.stockoutParts} hết hàng · {dashboard.inventory.criticalRiskParts} critical</small></article>
      </section>

      {noActivity ? <section className="analytics-empty-banner"><b>Khoảng thời gian này chưa có hoạt động vận hành mới.</b><span>Dữ liệu lịch sử vẫn được giữ nguyên. Chọn preset “Lịch sử” để xem các Work Order đã nhập từ dữ liệu cũ.</span></section> : null}

      <section className="analytics-section">
        <header><div><p className="eyebrow">Trend</p><h3>Xu hướng theo {bucket === 'DAY' ? 'ngày' : bucket === 'WEEK' ? 'tuần' : 'tháng'}</h3></div><div className="analytics-tabs">{METRICS.map((item) => <button key={item.id} type="button" className={metric === item.id ? 'active' : ''} onClick={() => void chooseMetric(item.id)}>{item.label}</button>)}</div></header>
        {snapshot.trends.length ? <div className="analytics-trend-list">{snapshot.trends.map((row) => {
          const value = metricValue(row, metric)
          const width = value == null ? 0 : Math.max(2, Math.min(100, value / trendMax * 100))
          return <div className="analytics-trend-row" key={`${row.bucketStartAt}-${metric}`}>
            <time>{shortDate(row.bucketStartAt)}</time>
            <div className="analytics-trend-track"><span style={{ width: `${width}%` }} /></div>
            <b>{value == null ? '—' : `${numberText(value, 2)}${metricUnit(metric) ? ` ${metricUnit(metric)}` : ''}`}</b>
            <small>{metric === 'WORK_ORDER' ? `${row.workOrdersCompleted} hoàn thành` : metric === 'OEE' ? `A ${percentText(row.availabilityPercent)} · P ${percentText(row.performancePercent)} · Q ${percentText(row.qualityPercent)}` : metric === 'DOWNTIME' ? `${row.downtimeEvents} sự kiện` : 'Tổng chi phí WO trong kỳ'}</small>
          </div>
        })}</div> : <div className="analytics-empty">Không có bucket dữ liệu trong khoảng đã chọn.</div>}
      </section>

      <section className="analytics-section">
        <header><div><p className="eyebrow">Drill-down</p><h3>Chi tiết {METRICS.find((item) => item.id === metric)?.label}</h3></div><span className="analytics-count">{snapshot.drilldown.length} mục</span></header>
        {snapshot.drilldown.length ? <div className="analytics-table-wrap"><table><thead><tr><th>Thời điểm</th><th>Thiết bị</th><th>Trạng thái</th><th>Nội dung</th><th>Giá trị</th></tr></thead><tbody>{snapshot.drilldown.map((row) => <tr key={`${row.itemType}-${row.itemId}`}><td><b>{dateText(row.occurredAt)}</b><small>{row.itemId}</small></td><td><b>{row.equipmentName || row.equipmentId || '—'}</b><small>{row.equipmentId}{row.locationName ? ` · ${row.locationName}` : ''}</small></td><td><span className="analytics-status">{row.status || '—'}</span></td><td>{row.title || '—'}</td><td><b>{row.valueNumeric == null ? '—' : metric === 'OEE' ? percentText(row.valueNumeric) : numberText(row.valueNumeric, 2)}</b>{metric === 'DOWNTIME' ? <small>phút</small> : null}</td></tr>)}</tbody></table></div> : <div className="analytics-empty">Chưa có dữ liệu chi tiết cho metric này trong khoảng đã chọn.</div>}
      </section>
    </> : null}
  </div>
}
