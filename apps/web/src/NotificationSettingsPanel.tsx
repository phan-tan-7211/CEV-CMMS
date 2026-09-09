import { useState } from 'react'
import './NotificationSettingsPanel.css'

export function NotificationSettingsPanel() {
  const [inApp, setInApp] = useState(true)
  const [email, setEmail] = useState(false)
  return <section className="notification-settings-panel" aria-labelledby="notification-settings-title"><header><div><p className="eyebrow">CEV CMMS · Tài khoản</p><h2 id="notification-settings-title">Cài đặt thông báo</h2><p>Chọn các kênh nhận cập nhật về lệnh công việc và yêu cầu.</p></div></header><div className="notification-settings-list"><label><span><strong>Thông báo trong ứng dụng</strong><small>Hiển thị cập nhật trong trung tâm thông báo.</small></span><input type="checkbox" checked={inApp} onChange={e=>setInApp(e.target.checked)} /></label><label><span><strong>Thông báo email</strong><small>Gửi cập nhật đến email tài khoản.</small></span><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)} /></label></div></section>
}
