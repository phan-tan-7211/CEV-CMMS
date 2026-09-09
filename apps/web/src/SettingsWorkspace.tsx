import { useState } from 'react'
import './SettingsWorkspace.css'

type SettingsSection = {
  id: string
  group: string
  title: string
  description: string
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'general', group: 'TỔ CHỨC', title: 'Chung', description: 'Tên công ty, múi giờ, tiền tệ và định dạng hiển thị.' },
  { id: 'automation', group: 'TỔ CHỨC', title: 'Tự động hóa', description: 'Các quy tắc tự động cho công việc và yêu cầu.' },
  { id: 'user-roles', group: 'TỔ CHỨC', title: 'Vai trò người dùng', description: 'Vai trò, quyền truy cập và phạm vi dữ liệu.' },
  { id: 'billing', group: 'TỔ CHỨC', title: 'Gói & thanh toán', description: 'Thông tin gói dịch vụ và thanh toán của tổ chức.' },
  { id: 'asset-fields', group: 'THIẾT BỊ', title: 'Trường thiết bị', description: 'Tùy chỉnh các trường hiển thị trong hồ sơ thiết bị.' },
  { id: 'parts-inventory', group: 'KHO & PHỤ TÙNG', title: 'Phụ tùng & kho', description: 'Thiết lập danh mục, tồn kho và quy tắc phụ tùng.' },
  { id: 'requests', group: 'NGHIỆP VỤ', title: 'Yêu cầu', description: 'Thiết lập biểu mẫu và quy trình yêu cầu nội bộ.' },
  { id: 'work-orders', group: 'NGHIỆP VỤ', title: 'Lệnh công việc', description: 'Thiết lập trạng thái, biểu mẫu và quy tắc lệnh công việc.' },
  { id: 'purchase-orders', group: 'NGHIỆP VỤ', title: 'Đơn đặt hàng', description: 'Thiết lập quy trình đơn đặt hàng.' },
  { id: 'meters', group: 'DỮ LIỆU & PHÂN TÍCH', title: 'Đồng hồ đo', description: 'Thiết lập loại đồng hồ và cách ghi nhận số đo.' },
  { id: 'tags', group: 'DỮ LIỆU & PHÂN TÍCH', title: 'Thẻ', description: 'Quản lý thẻ dùng để phân loại dữ liệu.' },
  { id: 'providers', group: 'DỮ LIỆU & PHÂN TÍCH', title: 'Nhà cung cấp & tuân thủ', description: 'Thông tin nhà cung cấp và hồ sơ tuân thủ.' },
  { id: 'fleet', group: 'TÍCH HỢP', title: 'Đội xe & tích hợp', description: 'Thiết lập đội xe và các kết nối liên quan.' },
  { id: 'api', group: 'TÍCH HỢP', title: 'API', description: 'Khóa API và tích hợp hệ thống.' },
  { id: 'authentication', group: 'TÍCH HỢP', title: 'Xác thực', description: 'SSO và các tùy chọn xác thực tổ chức.' },
  { id: 'webhooks', group: 'TÍCH HỢP', title: 'Webhooks', description: 'Sự kiện gửi đến hệ thống bên ngoài.' },
]

export function SettingsWorkspace({ initialSection = 'general', onClose }: { initialSection?: string; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState(initialSection)
  const selected = SETTINGS_SECTIONS.find((item) => item.id === selectedId) ?? SETTINGS_SECTIONS[0]
  const groups = [...new Set(SETTINGS_SECTIONS.map((item) => item.group))]

  return <div className="settings-workspace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="settings-workspace" role="dialog" aria-modal="true" aria-labelledby="settings-workspace-title">
      <header className="settings-workspace-header">
        <div><p className="eyebrow">CEV CMMS · Cài đặt</p><h2 id="settings-workspace-title">Cài đặt tổ chức</h2></div>
        <button className="settings-workspace-close" type="button" aria-label="Đóng cài đặt" onClick={onClose}>×</button>
      </header>
      <div className="settings-workspace-body">
        <aside className="settings-workspace-sidebar" aria-label="Danh mục cài đặt">
          {groups.map((group) => <div className="settings-group" key={group}><p>{group}</p>{SETTINGS_SECTIONS.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" className={item.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>{item.title}</button>)}</div>)}
        </aside>
        <main className="settings-workspace-content">
          <p className="eyebrow">Cài đặt / {selected.title}</p>
          <h3>{selected.title}</h3>
          <p className="settings-description">{selected.description}</p>
          <div className="settings-empty-state">
            <div className="settings-empty-icon" aria-hidden="true">⚙</div>
            <strong>Khung cài đặt đã sẵn sàng</strong>
            <span>Giao diện và điều hướng đã được chuẩn hóa theo danh mục UpKeep. Dữ liệu và thao tác của mục này sẽ nối theo từng module.</span>
          </div>
        </main>
      </div>
    </section>
  </div>
}
