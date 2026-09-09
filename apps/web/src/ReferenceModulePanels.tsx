import { useState } from 'react'
import './ReferenceModulePanels.css'

type PanelKind = 'imports' | 'inventory' | 'files' | 'checklists' | 'teams' | 'people' | 'locations' | 'locations-map'
const CONFIG: Record<PanelKind, { title: string; eyebrow: string; description: string; action: string; columns: string[] }> = {
  imports: { title: 'Nhập work order', eyebrow: 'CEV CMMS · Nhập & Xuất', description: 'Nhập lệnh công việc từ tệp dữ liệu.', action: '＋ Nhập work order', columns: ['Tên tệp', 'Ngày nhập', 'Trạng thái', 'Số dòng'] },
  inventory: { title: 'Kho & phụ tùng', eyebrow: 'CEV CMMS · Kho', description: 'Theo dõi phụ tùng, số lượng tồn và vị trí lưu kho.', action: '＋ Thêm phụ tùng', columns: ['Mã phụ tùng', 'Tên phụ tùng', 'Tồn kho', 'Vị trí'] },
  files: { title: 'Quản lý tệp', eyebrow: 'CEV CMMS · Tệp', description: 'Tập trung các tệp và tài liệu liên quan đến vận hành.', action: '＋ Tải tệp lên', columns: ['Tên tệp', 'Loại', 'Kích thước', 'Ngày cập nhật'] },
  checklists: { title: 'Danh sách kiểm tra', eyebrow: 'CEV CMMS · Bảo trì', description: 'Tạo và quản lý các checklist dùng trong công việc.', action: '＋ Tạo checklist', columns: ['Tên checklist', 'Mô tả', 'Số mục', 'Ngày cập nhật'] },
  teams: { title: 'Nhóm', eyebrow: 'CEV CMMS · Tổ chức', description: 'Quản lý các nhóm thực hiện công việc bảo trì.', action: '＋ Tạo nhóm', columns: ['Tên nhóm', 'Số thành viên', 'Người quản lý', 'Ngày tạo'] },
  people: { title: 'Nhân sự', eyebrow: 'CEV CMMS · Tổ chức', description: 'Quản lý người dùng, vai trò và thông tin liên hệ.', action: '＋ Thêm người', columns: ['Tên', 'Vai trò', 'Email', 'Trạng thái'] },
  locations: { title: 'Địa điểm', eyebrow: 'CEV CMMS · Địa điểm', description: 'Quản lý các khu vực và vị trí đặt thiết bị.', action: '＋ Thêm địa điểm', columns: ['Tên địa điểm', 'Địa chỉ', 'Số thiết bị', 'Ngày tạo'] },
  'locations-map': { title: 'Bản đồ địa điểm', eyebrow: 'CEV CMMS · Địa điểm', description: 'Xem các địa điểm trên bản đồ.', action: '＋ Thêm địa điểm', columns: ['Tên địa điểm', 'Địa chỉ', 'Số thiết bị', 'Tọa độ'] },
}
const LABELS: Record<PanelKind, string> = { imports: 'nhập work order', inventory: 'phụ tùng', files: 'tệp', checklists: 'checklist', teams: 'nhóm', people: 'người', locations: 'địa điểm', 'locations-map': 'địa điểm' }

export function ReferenceModulePanel({ kind }: { kind: PanelKind }) {
  const config = CONFIG[kind]
  const [query, setQuery] = useState('')
  return <section className="reference-module-panel" aria-labelledby="reference-module-title">
    <header className="reference-module-header"><div><p className="eyebrow">{config.eyebrow}</p><h2 id="reference-module-title">{config.title}</h2><p>{config.description}</p></div><button type="button" className="reference-module-primary" onClick={() => window.alert('Biểu mẫu ' + LABELS[kind] + ' sẽ được nối dữ liệu ở bước tiếp theo.')}>{config.action}</button></header>
    <div className="reference-module-toolbar"><span>0 kết quả</span><label htmlFor="reference-module-search">Tìm kiếm</label><input id="reference-module-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm" /><button type="button">Bộ lọc</button></div>
    {kind === 'locations-map' ? <div className="reference-map-placeholder"><strong>Bản đồ địa điểm</strong><span>Chưa có tọa độ địa điểm để hiển thị marker.</span></div> : <div className="reference-table-wrap"><table><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody><tr><td colSpan={config.columns.length} className="reference-empty">{query ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu'}</td></tr></tbody></table></div>}
  </section>
}
