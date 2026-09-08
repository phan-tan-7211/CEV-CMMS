import { useEffect, useRef, useState } from 'react'
import './GeneralSettingsMenu.css'

type GeneralSettingsMenuProps = {
  onOpenCompanyProfile: () => void
  onOpenOrganization: () => void
  onOpenAudit: () => void
}

export function GeneralSettingsMenu({ onOpenCompanyProfile, onOpenOrganization, onOpenAudit }: GeneralSettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const action = (callback: () => void) => { setOpen(false); callback() }
  return <div className="general-settings-menu" ref={root}>
    <button className="general-settings-trigger" type="button" aria-label="Cài đặt chung" aria-expanded={open} aria-controls="general-settings-panel" onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.5v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H7v-2.5h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L10 6.7l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1h2.5v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
    </button>
    {open ? <section id="general-settings-panel" className="general-settings-panel" role="dialog" aria-label="Cài đặt chung">
      <header><strong>Cài đặt</strong><span>Thiết lập CEV CMMS</span></header>
      <div className="general-settings-section"><small>CHUNG</small>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Cài đặt chung</strong><small>Ngôn ngữ, tiền tệ, ngày giờ và thiết lập công ty</small></button>
        <button type="button" onClick={() => action(onOpenCompanyProfile)}><strong>Hồ sơ công ty</strong><small>Tên, địa chỉ, số điện thoại, website và logo</small></button>
        <button type="button" onClick={() => action(onOpenOrganization)}><strong>Vai trò người dùng</strong><small>Quản lý thành viên và quyền truy cập</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Tự động hóa</strong><small>Quy tắc và thông báo tự động</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Gói dịch vụ & thanh toán</strong><small>Quản lý gói và giấy phép</small></button>
      </div>
      <div className="general-settings-section"><small>MODULE</small>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Trường tùy chỉnh tài sản</strong><small>Thêm trường dữ liệu cho thiết bị</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Phụ tùng & kho</strong><small>Thiết lập tồn kho và phụ tùng</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Yêu cầu</strong><small>Thiết lập cổng và quy tắc yêu cầu</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Lệnh công việc</strong><small>Thiết lập trạng thái và biểu mẫu</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Đơn đặt hàng</strong><small>Thiết lập quy trình mua hàng</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Đồng hồ đo</strong><small>Thiết lập loại số đo</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Thẻ</strong><small>Quản lý thẻ dùng chung</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Nhà cung cấp & tuân thủ</strong><small>Thiết lập nhà cung cấp và hồ sơ tuân thủ</small></button>
      </div>
      <div className="general-settings-section"><small>TÍCH HỢP</small>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>API & xác thực</strong><small>API, SSO và xác thực hệ thống</small></button>
        <button type="button" onClick={() => action(onOpenAudit)}><strong>Webhooks</strong><small>Kết nối sự kiện với hệ thống khác</small></button>
      </div>
    </section> : null}
  </div>
}
