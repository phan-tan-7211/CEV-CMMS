import { useEffect, useMemo, useState } from 'react'
import './A4PrintCenter.css'
import './A4Bm02.css'
import { EquipmentQr } from './components/EquipmentQr'
import { EquipmentLabelPrintWorkspace } from './components/EquipmentLabelPrintWorkspace'
import { SmartAutocomplete } from './components/SmartAutocomplete'
import { fetchSourceRows } from './data/sourceRows'
import { getEquipmentPhotoPreview } from './data/supabaseEquipment'
import { loadEquipmentA4Relations, type EquipmentA4Relations } from './data/equipmentA4Data'

type Row = Record<string, unknown>
type DocType = 'equipment' | 'label' | 'bm02' | 'bm03' | 'bm05' | 'bm08' | 'bm06' | 'calibration'

const EMPTY_RELATIONS: EquipmentA4Relations = { spares: [], history: [], calibration: null }

const DOCS: Array<{ id: DocType; label: string; code: string; table: string; idKey: string; order: string }> = [
  { id: 'equipment', label: 'Lý lịch thiết bị', code: 'CEV-BM-TBSX-01', table: 'equipment_master', idKey: 'equipment_id', order: 'equipment_id' },
  { id: 'label', label: 'Tem quản lý thiết bị', code: 'TEM QUẢN LÝ', table: 'equipment_master', idKey: 'equipment_id', order: 'equipment_id' },
  { id: 'bm02', label: 'Danh mục quản lý thiết bị sản xuất', code: 'CEV-BM-TBSX-02', table: 'equipment_master', idKey: 'equipment_id', order: 'equipment_id' },
  { id: 'bm03', label: 'Kế hoạch bảo dưỡng máy', code: 'CEV-BM-TBSX-03', table: 'maintenance_plan', idKey: 'plan_id', order: 'created_at' },
  { id: 'bm05', label: 'Biên bản bàn giao trang thiết bị', code: 'CEV-BM-TBSX-05', table: 'equipment_handover', idKey: 'handover_id', order: 'created_at' },
  { id: 'bm08', label: 'Kết quả bảo dưỡng sửa chữa thiết bị', code: 'CEV-BM-TBSX-08', table: 'maintenance_execution', idKey: 'execution_id', order: 'created_at' },
  { id: 'bm06', label: 'Bảng theo dõi chỉ số dừng máy', code: 'CEV-BM-TBSX-06', table: 'downtime_event', idKey: 'downtime_id', order: 'started_at' },
  { id: 'calibration', label: 'Hồ sơ hiệu chuẩn', code: 'HỒ SƠ HIỆU CHUẨN', table: 'calibration_log', idKey: 'calibration_log_id', order: 'created_at' },
]

const LABELS: Record<string, string> = {
  itemName: 'Hạng mục', resultMark: 'Kết quả ○/△/×', periodicFrequency: 'Định kỳ kiểm tra', scheduledWindow: 'Khung thời gian',
  chairDepartment: 'Bộ phận chủ trì', meetingContent: 'Nội dung bàn giao', participants: 'Thành phần tham dự',
  handoverTitle: 'Chức vụ người giao', handoverDepartment: 'Bộ phận giao', receiverTitle: 'Chức vụ người nhận', receiverDepartment: 'Bộ phận nhận',
  handoverReason: 'Lý do bàn giao', attachedItems: 'Tài liệu / phụ kiện', handoverComment: 'Ý kiến bên giao', receiverComment: 'Ý kiến bên nhận',
  provider: 'Đơn vị hiệu chuẩn', certificatePath: 'Tệp chứng chỉ', recordedBy: 'Người ghi nhận',
  equipment_id: 'Mã thiết bị', equipment_type: 'Loại thiết bị', control_number: 'Số quản lý', qr_code: 'Mã QR', equipment_name: 'Tên thiết bị',
  model: 'Mẫu / Model', manufacturer: 'Nhà sản xuất', serial_number: 'Số sê-ri', department: 'Bộ phận', status: 'Trạng thái', active: 'Đang quản lý',
  plan_id: 'Mã kế hoạch', handover_id: 'Mã bàn giao', work_order_id: 'Mã lệnh bảo trì', accepted: 'Đã tiếp nhận', equipment_condition: 'Tình trạng thiết bị',
  execution_id: 'Mã thực hiện', downtime_id: 'Mã dừng máy', started_at: 'Bắt đầu dừng', ended_at: 'Khôi phục', calibration_log_id: 'Mã hiệu chuẩn',
  calibration_date: 'Ngày hiệu chuẩn', next_due_date: 'Ngày đến hạn tiếp theo', result: 'Kết quả', actor_email: 'Người ghi nhận', created_at: 'Ngày tạo', updated_at: 'Cập nhật',
  maintenanceType: 'Loại bảo dưỡng', frequency: 'Tần suất', plannedDate: 'Ngày dự kiến', plannedWindow: 'Khung thời gian', responsiblePerson: 'Người thực hiện', note: 'Ghi chú',
  item: 'Hạng mục', item_text: 'Hạng mục', standard: 'Tiêu chuẩn', standard_text: 'Tiêu chuẩn', method: 'Phương pháp', method_text: 'Phương pháp', executionDate: 'Ngày thực hiện', inspectionDepartment: 'Bộ phận kiểm tra', mark: 'Kết quả', result_text: 'Kết quả',
  repairContent: 'Nội dung sửa chữa', maintenanceContent: 'Nội dung bảo dưỡng', inspector: 'Người kiểm tra', handoverAt: 'Thời gian bàn giao', location: 'Địa điểm',
  handoverPerson: 'Người giao', receiverPerson: 'Người nhận', reason: 'Lý do bàn giao', documentsAccessories: 'Tài liệu / phụ kiện', otherAgreement: 'Thỏa thuận khác',
  cause: 'Nguyên nhân', detail: 'Mô tả', recoveryAction: 'Hành động khôi phục', recorder: 'Người ghi', handler: 'Người xử lý', reporter: 'Người báo cáo',
  evaluationResult: 'Đánh giá sau hiệu chuẩn', evaluationNote: 'Nhận xét đánh giá', evaluatedBy: 'Người đánh giá', evaluatedAt: 'Thời điểm đánh giá',
  accuracy: 'Độ chính xác', description: 'Mô tả', specification: 'Thông số kỹ thuật', classification: 'Phân loại',
  equipmentCategory: 'Nhóm / phân loại', currentArea: 'Khu vực', currentLine: 'Dây chuyền', managingDepartment: 'Bộ phận quản lý', usingDepartment: 'Bộ phận sử dụng', technicalSpecification: 'Thông số kỹ thuật', criticality: 'Cấp độ thiết bị',
}

const VALUE_LABELS: Record<string, string> = {
  MEASUREMENT: 'Thiết bị đo kiểm', PRODUCTION: 'Thiết bị sản xuất',
  RUNNING: 'Hoạt động', DOWN: 'Sự cố', MAINTENANCE: 'Bảo trì', STOPPED: 'Dừng', DISPOSED: 'Thanh lý', UNKNOWN: 'Chưa xác định',
  PASS: 'Đạt', FAIL: 'Không đạt', OK: 'Đạt', NG: 'Không đạt', OPEN: 'Đang mở', CLOSED: 'Đã đóng', COMPLETED: 'Hoàn thành',
  REQUIRED: 'Bắt buộc dự trữ', RECOMMENDED: 'Khuyến nghị dự trữ', NORMAL: 'Thông thường',
  '길이 측정기': 'Thiết bị đo chiều dài',
}

function dateTimeDisplay(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleString('vi-VN')
}

function dateDisplay(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleDateString('vi-VN')
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'object') return '—'
  const raw = String(value)
  return VALUE_LABELS[raw] || raw
}

function sourceData(row: Row | null) {
  const value = row?.source_data
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function sourceText(row: Row | null, key: string) {
  const value = sourceData(row)[key]
  return value === null || value === undefined ? '' : String(value).trim()
}

function sourceFirst(row: Row, keys: string[]) {
  for (const key of keys) {
    const direct = row[key]
    if (direct !== null && direct !== undefined && String(direct).trim() !== '') return direct
    const nested = sourceData(row)[key]
    if (nested !== null && nested !== undefined && String(nested).trim() !== '') return nested
  }
  return ''
}

function printableFields(row: Row | null) {
  if (!row) return []
  return Object.entries(row)
    .filter(([key]) => key !== 'source_data')
    .concat(Object.entries(sourceData(row)))
    .filter(([key, value]) => Boolean(LABELS[key]) && value !== null && value !== undefined && value !== '' && typeof value !== 'object')
}

function safeTitlePart(value: unknown) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function recordOptionLabel(row: Row, idKey: string) {
  const id = String(row[idKey] || '').trim()
  const subject = String(row.equipment_id || row.equipment_name || '').trim()
  return [id, subject].filter(Boolean).join(' · ')
}

function DetailTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="a4-empty">Chưa có hạng mục chi tiết.</p>
  const normalized = rows.map((row) => ({ ...sourceData(row), ...row }))
  const preferred = ['itemName', 'resultMark', 'item_text', 'item', 'standard_text', 'standard', 'method_text', 'method', 'result_text', 'mark', 'repairContent', 'maintenanceContent', 'inspector']
  const columns = preferred.filter((key) => normalized.some((row) => row[key] !== undefined && row[key] !== null && row[key] !== ''))
  return <table className="a4-table"><thead><tr><th>STT</th>{columns.map((key) => <th key={key}>{LABELS[key]}</th>)}</tr></thead><tbody>{normalized.map((row, index) => <tr key={String(row.maintenance_plan_item_id || row.maintenance_result_item_id || index)}><td>{index + 1}</td>{columns.map((key) => <td key={key}>{display(row[key])}</td>)}</tr>)}</tbody></table>
}

function EquipmentManagementListA4({ rows }: { rows: Row[] }) {
  const productionRows = rows
    .filter((row) => String(row.equipment_type || '').toUpperCase() === 'PRODUCTION')
    .toSorted((a, b) => String(a.equipment_id || '').localeCompare(String(b.equipment_id || ''), 'vi'))
  const activeCount = productionRows.filter((row) => Boolean(row.active) && String(row.status || '').toUpperCase() === 'RUNNING').length
  return <>
    <div className="bm02-summary"><strong>Tổng số thiết bị: {productionRows.length}</strong><span>Đang hoạt động: {activeCount}</span><span>Phòng quản lý: Phòng Kỹ thuật</span></div>
    <table className="a4-table bm02-table">
      <colgroup>
        <col style={{ width: '3%' }}/><col style={{ width: '7%' }}/><col style={{ width: '9%' }}/><col style={{ width: '6%' }}/><col style={{ width: '7%' }}/><col style={{ width: '7%' }}/><col style={{ width: '4%' }}/><col style={{ width: '7%' }}/><col style={{ width: '7%' }}/><col style={{ width: '7%' }}/><col style={{ width: '9%' }}/><col style={{ width: '6%' }}/><col style={{ width: '6%' }}/><col style={{ width: '7%' }}/><col style={{ width: '6%' }}/><col style={{ width: '6%' }}/><col style={{ width: '6%' }}/>
      </colgroup>
      <thead><tr><th>STT</th><th>Mã thiết bị</th><th>Tên thiết bị</th><th>Loại thiết bị</th><th>Kiểu máy (Model)</th><th>Nhà SX/NCC</th><th>Năm SX</th><th>Ngày mua / đưa vào SD</th><th>Vị trí lắp đặt</th><th>Bộ phận quản lý / SD</th><th>Thông số KT chính</th><th>Chu kỳ BD</th><th>Tình trạng</th><th>Ngày cập nhật cuối</th><th>Giá trị ban đầu</th><th>Ghi chú</th><th>Tài liệu liên quan</th></tr></thead>
      <tbody>{productionRows.map((row, index) => {
        const manufactureYear = sourceFirst(row, ['manufactureYear', 'manufacture_year', 'yearOfManufacture'])
        const inServiceDate = sourceFirst(row, ['inServiceDate', 'purchaseDate', 'purchase_date', 'commissioningDate'])
        const location = sourceFirst(row, ['currentArea', 'location', 'installationLocation']) || sourceFirst(row, ['currentLine'])
        const department = row.department || sourceFirst(row, ['usingDepartment', 'managingDepartment'])
        const technical = sourceFirst(row, ['technicalSpecification', 'specification'])
        const cycle = sourceFirst(row, ['maintenanceCycle', 'maintenanceFrequency', 'pmFrequency'])
        const initialValue = sourceFirst(row, ['initialValue', 'purchaseValue', 'assetValue'])
        const note = sourceFirst(row, ['note', 'notes', 'description'])
        const docs = sourceFirst(row, ['relatedDocuments', 'documents', 'documentRef'])
        return <tr key={String(row.equipment_id || index)}>
          <td>{index + 1}</td><td>{display(row.equipment_id)}</td><td>{display(row.equipment_name)}</td><td>{display(row.equipment_type)}</td><td>{display(row.model)}</td><td>{display(row.manufacturer)}</td><td className={manufactureYear ? '' : 'bm02-missing'}>{display(manufactureYear)}</td><td className={inServiceDate ? '' : 'bm02-missing'}>{inServiceDate ? dateDisplay(inServiceDate) : '—'}</td><td className={location ? '' : 'bm02-missing'}>{display(location)}</td><td>{display(department)}</td><td>{display(technical)}</td><td>{display(cycle)}</td><td className={row.status ? '' : 'bm02-missing'}>{display(row.status)}</td><td>{dateDisplay(row.updated_at)}</td><td>{display(initialValue)}</td><td>{display(note)}</td><td>{display(docs)}</td>
        </tr>
      })}</tbody>
    </table>
    {!productionRows.length ? <p className="bm02-empty">Chưa có thiết bị sản xuất trong danh mục.</p> : null}
  </>
}

function EquipmentA4({ row, photoUrl, relations }: { row: Row; photoUrl: string; relations: EquipmentA4Relations }) {
  const technical = sourceText(row, 'technicalSpecification') || sourceText(row, 'specification')
  const description = sourceText(row, 'description')
  const category = sourceText(row, 'equipmentCategory') || sourceText(row, 'classification')
  const area = sourceText(row, 'currentArea')
  const line = sourceText(row, 'currentLine')
  const managingDepartment = sourceText(row, 'managingDepartment')
  const usingDepartment = String(row.department || sourceText(row, 'usingDepartment') || '')
  const criticality = sourceText(row, 'criticality')
  const accuracy = sourceText(row, 'accuracy')
  const origin = sourceText(row, 'origin') || sourceText(row, 'countryOfOrigin')
  const manufactureDate = sourceText(row, 'manufactureDate')
  const inServiceDate = sourceText(row, 'inServiceDate') || sourceText(row, 'purchaseDate')
  const warrantyUntil = sourceText(row, 'warrantyUntil') || sourceText(row, 'warrantyPeriod')
  const warrantyContact = sourceText(row, 'warrantyContact')
  const showOriginWarranty = Boolean(origin || manufactureDate || inServiceDate || warrantyUntil || warrantyContact)
  const isMeasurement = String(row.equipment_type || '').toUpperCase() === 'MEASUREMENT'
  const qrValue = String(row.qr_code || row.equipment_id || '').trim()

  return <>
    <div className="a4-equipment-main">
      <section className="a4-equipment-photo a4-equipment-left">
        <div className="a4-section-title">Hình ảnh thiết bị</div>
        <div className="a4-equipment-photo-frame">{photoUrl ? <img src={photoUrl} alt="Hình ảnh thiết bị" /> : <span>Chưa có ảnh thiết bị</span>}</div>
        <div className="a4-section-title a4-management-title">Thông tin quản lý</div>
        <dl className="a4-equipment-fields a4-management-fields">
          <div><dt>Bộ phận sử dụng</dt><dd>{display(usingDepartment)}</dd></div>
          <div><dt>Bộ phận quản lý</dt><dd>{display(managingDepartment)}</dd></div>
          <div><dt>Khu vực</dt><dd>{display(area)}</dd></div>
          <div><dt>Dây chuyền</dt><dd>{display(line)}</dd></div>
          <div><dt>Trạng thái</dt><dd>{display(row.status)}</dd></div>
          <div><dt>Cấp độ thiết bị</dt><dd>{criticality ? `Cấp ${criticality}` : '—'}</dd></div>
          <div className="a4-qr-field"><dt>Mã QR</dt><dd><EquipmentQr value={qrValue} size={82} /></dd></div>
        </dl>
      </section>
      <section className="a4-equipment-info">
        <div className="a4-section-title">Thông tin thiết bị</div>
        <dl className="a4-equipment-fields">
          <div><dt>Mã thiết bị</dt><dd>{display(row.equipment_id)}</dd></div>
          <div><dt>Tên thiết bị</dt><dd>{display(row.equipment_name)}</dd></div>
          <div><dt>Loại thiết bị</dt><dd>{display(row.equipment_type)}</dd></div>
          <div><dt>Nhóm / phân loại</dt><dd>{display(category)}</dd></div>
          <div><dt>Nhà sản xuất</dt><dd>{display(row.manufacturer)}</dd></div>
          <div><dt>Mẫu / Model</dt><dd>{display(row.model)}</dd></div>
          <div><dt>Số sê-ri</dt><dd>{display(row.serial_number)}</dd></div>
          <div><dt>Độ chính xác</dt><dd>{display(accuracy)}</dd></div>
          <div><dt>Đang quản lý</dt><dd>{display(row.active)}</dd></div>
        </dl>
      </section>
    </div>

    <section className="a4-equipment-detail">
      <div className="a4-section-title">Thông số và mô tả</div>
      <dl>
        <div><dt>Thông số kỹ thuật</dt><dd>{display(technical)}</dd></div>
        <div><dt>Mô tả / chức năng chính</dt><dd>{display(description)}</dd></div>
      </dl>
    </section>

    {showOriginWarranty ? <section className="a4-compact-section">
      <div className="a4-section-title">Nguồn gốc và bảo hành</div>
      <div className="a4-inline-fields">
        {origin ? <div><span>Xuất xứ</span><strong>{origin}</strong></div> : null}
        {manufactureDate ? <div><span>Ngày sản xuất</span><strong>{dateDisplay(manufactureDate)}</strong></div> : null}
        {inServiceDate ? <div><span>Ngày đưa vào sử dụng</span><strong>{dateDisplay(inServiceDate)}</strong></div> : null}
        {warrantyUntil ? <div><span>Bảo hành</span><strong>{display(warrantyUntil)}</strong></div> : null}
        {warrantyContact ? <div><span>Liên hệ bảo hành</span><strong>{warrantyContact}</strong></div> : null}
      </div>
    </section> : null}

    <section className="a4-compact-section">
      <div className="a4-section-title">Phụ tùng quan trọng / cần dự trữ</div>
      {relations.spares.length ? <table className="a4-table a4-summary-table a4-spare-table">
        <thead><tr><th>STT</th><th>Mã</th><th>Tên phụ tùng</th><th>Part No</th><th>Hãng</th><th>Tồn / Min</th><th>Mức</th></tr></thead>
        <tbody>{relations.spares.map((part, index) => <tr key={part.partId}><td>{index + 1}</td><td>{part.partId}</td><td>{part.partName}</td><td>{display(part.partNumber)}</td><td>{display(part.maker)}</td><td>{part.stockQty} / {part.minQty}</td><td>{display(part.classification)}</td></tr>)}</tbody>
      </table> : <p className="a4-inline-empty">Chưa có phụ tùng được liên kết với thiết bị.</p>}
    </section>

    <section className="a4-compact-section">
      <div className="a4-section-title">Lịch sử thiết bị gần nhất</div>
      {relations.history.length ? <table className="a4-table a4-summary-table a4-history-table">
        <thead><tr><th>Ngày</th><th>Sự kiện</th><th>Nội dung chính</th><th>Mã lệnh</th><th>Người thực hiện</th></tr></thead>
        <tbody>{relations.history.map((event) => <tr key={`${event.type}-${event.id}`}><td>{dateDisplay(event.date)}</td><td>{event.type}</td><td>{display(event.content)}</td><td>{display(event.workOrderId)}</td><td>{display(event.actor)}</td></tr>)}</tbody>
      </table> : <p className="a4-inline-empty">Chưa có sự kiện đáng chú ý được ghi nhận.</p>}
    </section>

    {isMeasurement ? <section className="a4-compact-section">
      <div className="a4-section-title">Tình trạng hiệu chuẩn</div>
      {relations.calibration ? <div className="a4-calibration-row">
        <div><span>Hiệu chuẩn gần nhất</span><strong>{dateDisplay(relations.calibration.calibrationDate)}</strong></div>
        <div><span>Hạn tiếp theo</span><strong>{dateDisplay(relations.calibration.nextDueDate)}</strong></div>
        <div><span>Kết quả</span><strong>{display(relations.calibration.result)}</strong></div>
      </div> : <p className="a4-inline-empty">Chưa có hồ sơ hiệu chuẩn.</p>}
    </section> : null}

    <section className="a4-equipment-meta">
      <div><span>Ngày tạo</span><strong>{dateTimeDisplay(row.created_at)}</strong></div>
      <div><span>Cập nhật gần nhất</span><strong>{dateTimeDisplay(row.updated_at)}</strong></div>
    </section>
  </>
}

export function A4PrintCenter() {
  const [docType, setDocType] = useState<DocType>('equipment')
  const [records, setRecords] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedQuery, setSelectedQuery] = useState('')
  const [details, setDetails] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [detailsFor, setDetailsFor] = useState('')
  const [error, setError] = useState('')
  const [equipmentPhotoUrl, setEquipmentPhotoUrl] = useState('')
  const [equipmentRelations, setEquipmentRelations] = useState<EquipmentA4Relations>(EMPTY_RELATIONS)
  const [relationsFor, setRelationsFor] = useState('')
  const config = DOCS.find((item) => item.id === docType) || DOCS[0]

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await fetchSourceRows(config.table)
        if (!active) return
        setRecords(next)
        const first = next[0]
        setSelectedId(first ? String(first[config.idKey] || '') : '')
        setSelectedQuery(first ? recordOptionLabel(first, config.idKey) : '')
        setError('')
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [config])

  const selected = useMemo(() => records.find((row) => String(row[config.idKey] || '') === selectedId) || null, [records, selectedId, config.idKey])
  const recordOptions = useMemo(() => records.map((row) => recordOptionLabel(row, config.idKey)), [records, config.idKey])
  const relationKey = docType === 'equipment' && selected?.equipment_id ? String(selected.equipment_id) : ''
  const displayedPhotoUrl = relationKey && relationsFor === relationKey ? equipmentPhotoUrl : ''
  const displayedRelations = relationKey && relationsFor === relationKey ? equipmentRelations : EMPTY_RELATIONS
  const expectedDetailsFor = selected ? `${docType}:${selectedId}` : ''
  const displayedDetails = expectedDetailsFor && detailsFor === expectedDetailsFor ? details : []

  function selectRecord(value: string) {
    setSelectedQuery(value)
    setError('')
    const normalized = value.trim().toLocaleLowerCase('vi-VN')
    const match = records.find((row) => recordOptionLabel(row, config.idKey).toLocaleLowerCase('vi-VN') === normalized || String(row[config.idKey] || '').toLocaleLowerCase('vi-VN') === normalized)
    if (!match) {
      setSelectedId('')
      return
    }
    setSelectedId(String(match[config.idKey] || ''))
    setSelectedQuery(recordOptionLabel(match, config.idKey))
  }

  function changeDocType(nextDocType: DocType) {
    setLoading(true)
    setError('')
    setSelectedId('')
    setSelectedQuery('')
    setRecords([])
    setDetails([])
    setDetailsFor('')
    setEquipmentPhotoUrl('')
    setEquipmentRelations(EMPTY_RELATIONS)
    setRelationsFor('')
    setDocType(nextDocType)
  }

  useEffect(() => {
    if (!relationKey) return
    let active = true
    const equipmentId = relationKey
    const run = async () => {
      const [preview, relations] = await Promise.all([
        getEquipmentPhotoPreview(equipmentId),
        loadEquipmentA4Relations(equipmentId),
      ])
      if (!active) return
      setEquipmentPhotoUrl(preview.exists ? preview.signedUrl : '')
      setEquipmentRelations(relations)
      setRelationsFor(equipmentId)
    }
    void run().catch((cause: unknown) => {
      if (!active) return
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu liên quan của thiết bị')
    })
    return () => { active = false }
  }, [relationKey])

  useEffect(() => {
    if (docType === 'label' || docType === 'bm02' || docType === 'bm06' || !selected) return
    let active = true
    const run = async () => {
      const table = docType === 'bm03' ? 'maintenance_plan_item' : docType === 'bm08' ? 'maintenance_result_item' : null
      const data = table ? await fetchSourceRows(table, { column: docType === 'bm03' ? 'plan_id' : 'execution_id', value: selected[config.idKey] }) : []
      if (active) {
        setDetails(data.toSorted((a, b) => Number(sourceData(a).sequence || 0) - Number(sourceData(b).sequence || 0)))
        setDetailsFor(`${docType}:${selectedId}`)
        setError('')
      }
    }
    void run().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết') })
    return () => { active = false }
  }, [docType, selected, selectedId, config.idKey])

  const bm06Rows = docType === 'bm06' ? records.map((row) => ({ ...sourceData(row), ...row })) : []
  const equipmentRelationsReady = docType !== 'equipment' || !selected || relationsFor === relationKey
  const aggregateDoc = docType === 'bm02' || docType === 'bm06'

  function printA4() {
    const previousTitle = document.title
    const equipmentId = safeTitlePart(selected?.equipment_id)
    const equipmentName = safeTitlePart(selected?.equipment_name)
    document.title = docType === 'equipment' && selected
      ? ['CEV Equipment', equipmentId, equipmentName].filter(Boolean).join(' · ')
      : ['CEV Equipment', safeTitlePart(config.code)].filter(Boolean).join(' · ')

    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle, { once: true })
    window.print()
  }

  return <div className="print-center">
    <section className="print-toolbar no-print">
      <div><h2>Hồ sơ / Tem quản lý</h2><p>{docType === 'label' ? 'Chọn nhiều thiết bị, chọn khổ tem và in hàng loạt.' : 'Chọn biểu mẫu và hồ sơ cần in.'}</p></div>
      <div className="print-controls">
        <label>Biểu mẫu<select aria-label="Biểu mẫu" value={docType} onChange={(event) => changeDocType(event.target.value as DocType)}>{DOCS.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.label}</option>)}</select></label>
        {docType !== 'label' && !aggregateDoc ? <label>Hồ sơ<SmartAutocomplete aria-label="Hồ sơ" value={selectedQuery} options={recordOptions} onChange={selectRecord} disabled={!records.length} placeholder="Nhập mã hoặc tên để tìm nhanh" maxOptions={40} /></label> : null}
        {docType !== 'label' ? <button type="button" disabled={loading || Boolean(error) || !equipmentRelationsReady || (aggregateDoc ? !records.length : !selected || detailsFor !== `${docType}:${selectedId}`)} onClick={printA4}>In / Xuất PDF A4</button> : null}
      </div>
      {loading ? <p>Đang tải hồ sơ…</p> : null}{error ? <p className="print-error">{error}</p> : null}
    </section>

    {docType === 'label'
      ? <EquipmentLabelPrintWorkspace records={records}/>
      : <article className={`a4-document${docType === 'bm02' || docType === 'bm06' ? ' landscape' : ''}${docType === 'bm02' ? ' bm02-sheet' : ''}${docType === 'equipment' ? ' equipment-sheet' : ''}`}>
        <header className="a4-header"><div><b>CORE ELECTRONICS VIETNAM</b></div><div><strong>{config.code}</strong></div></header><h1>{config.label.toUpperCase()}</h1>
        {docType === 'bm02' ? <EquipmentManagementListA4 rows={records}/>
        : docType === 'bm06' ? <>
          <div className="a4-meta"><span>Số sự kiện: {bm06Rows.length}</span></div>
          <table className="a4-table"><thead><tr><th>STT</th><th>Thiết bị</th><th>Bắt đầu</th><th>Khôi phục</th><th>Nguyên nhân</th><th>Mô tả / hành động</th></tr></thead><tbody>{bm06Rows.map((row, index) => <tr key={String(row.downtime_id)}><td>{index + 1}</td><td>{display(row.equipment_id)}</td><td>{dateTimeDisplay(row.started_at)}</td><td>{dateTimeDisplay(row.ended_at)}</td><td>{display(row.causeCategory || row.cause)}</td><td>{display(row.detail)} / {display(row.actionTaken || row.recoveryAction)}</td></tr>)}</tbody></table>
        </> : selected ? <>
          {docType !== 'equipment' ? <div className="a4-meta"><span>Mã hồ sơ: {display(selected[config.idKey])}</span></div> : null}
          {docType === 'equipment'
            ? <EquipmentA4 row={selected} photoUrl={displayedPhotoUrl} relations={displayedRelations} />
            : <section className="a4-fields">{printableFields(selected).map(([key, value], index) => <div key={`${key}-${index}`}><span>{LABELS[key]}</span><strong>{key.includes('date') || key.endsWith('_at') || key.endsWith('At') ? dateDisplay(value) : display(value)}</strong></div>)}</section>}
          {(docType === 'bm03' || docType === 'bm08') ? <section className="a4-detail"><h2>Chi tiết hạng mục</h2>{docType === 'bm08' ? <p>○ Tốt · △ Cảnh báo · × Sửa chữa</p> : null}<DetailTable rows={displayedDetails} /></section> : null}
          {docType !== 'equipment' ? <footer className="a4-signatures"><div><span>Người lập / thực hiện</span><b>Ký, ghi rõ họ tên</b></div><div><span>Người kiểm tra / xác nhận</span><b>Ký, ghi rõ họ tên</b></div><div><span>Phê duyệt</span><b>Ký, ghi rõ họ tên</b></div></footer> : null}
        </> : <p className="a4-empty">Chưa có hồ sơ cho biểu mẫu này.</p>}
      </article>}
  </div>
}
