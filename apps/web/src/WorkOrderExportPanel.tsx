import { useState } from 'react'
import './WorkOrderExportPanel.css'

const FIELDS = ['Mã lệnh công việc', 'Tiêu đề', 'Trạng thái', 'Ưu tiên', 'Thiết bị', 'Người được phân công', 'Ngày tạo', 'Ngày đến hạn', 'Mô tả']

export function WorkOrderExportPanel() {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [selected, setSelected] = useState(FIELDS)
  const toggle = (field: string) => setSelected((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])
  return <section className="wo-export-panel" aria-labelledby="wo-export-title">
    <header><div><p className="eyebrow">CEV CMMS · Lệnh công việc</p><h2 id="wo-export-title">Xuất lệnh công việc</h2><p>Chọn định dạng và các trường muốn xuất từ danh sách lệnh công việc.</p></div></header>
    <div className="wo-export-card"><h3>Định dạng tệp</h3><div className="wo-export-format" role="radiogroup" aria-label="Định dạng tệp"><label className={format === 'xlsx' ? 'active' : ''}><input type="radio" name="format" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} /> Excel (.xlsx)</label><label className={format === 'csv' ? 'active' : ''}><input type="radio" name="format" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV (.csv)</label></div></div>
    <div className="wo-export-card"><div className="wo-export-fields-heading"><div><h3>Trường dữ liệu</h3><p>{selected.length}/{FIELDS.length} trường được chọn</p></div><button type="button" onClick={() => setSelected(selected.length === FIELDS.length ? [] : FIELDS)}>{selected.length === FIELDS.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button></div><div className="wo-export-fields">{FIELDS.map((field) => <label key={field}><input type="checkbox" checked={selected.includes(field)} onChange={() => toggle(field)} />{field}</label>)}</div></div>
    <button type="button" className="wo-export-primary" disabled={!selected.length} onClick={() => window.alert('Tệp xuất sẽ được tạo khi nối dữ liệu')}>Xuất {selected.length ? selected.length + ' trường' : 'dữ liệu'}</button>
  </section>
}
