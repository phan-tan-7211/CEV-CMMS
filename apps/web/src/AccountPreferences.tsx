import { useEffect, useState } from 'react'
import './AccountPreferences.css'

type PreferencesMode = 'cookie' | 'notifications' | null

export function AccountPreferences({ mode, onClose }: { mode: PreferencesMode; onClose: () => void }) {
  const [push, setPush] = useState(() => localStorage.getItem('cev-notification-push') !== 'off')
  const [email, setEmail] = useState(() => localStorage.getItem('cev-notification-email') === 'on')
  useEffect(() => { if (mode) document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [mode])
  if (!mode) return null
  const notificationMode = mode === 'notifications'
  return <div className="preferences-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="preferences-title">
      <header><div><p className="eyebrow">CEV CMMS</p><h2 id="preferences-title">{notificationMode ? 'Cài đặt thông báo' : 'Cài đặt cookie'}</h2></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header>
      {notificationMode ? <div className="preferences-body"><p>Chọn cách CEV CMMS gửi cập nhật về lệnh công việc và yêu cầu.</p><label><span><strong>Thông báo trong ứng dụng</strong><small>Hiển thị cập nhật trong trung tâm thông báo.</small></span><input type="checkbox" checked={push} onChange={(event) => { setPush(event.target.checked); localStorage.setItem('cev-notification-push', event.target.checked ? 'on' : 'off') }} /></label><label><span><strong>Thông báo email</strong><small>Gửi bản tóm tắt cập nhật đến email tài khoản.</small></span><input type="checkbox" checked={email} onChange={(event) => { setEmail(event.target.checked); localStorage.setItem('cev-notification-email', event.target.checked ? 'on' : 'off') }} /></label></div> : <div className="preferences-body"><p>Quản lý cookie dùng cho giao diện và phiên làm việc trên trình duyệt này.</p><label><span><strong>Cookie cần thiết</strong><small>Luôn bật để đăng nhập và lưu cài đặt giao diện.</small></span><input type="checkbox" checked readOnly /></label><label><span><strong>Cookie phân tích</strong><small>Cho phép đo lường việc sử dụng để cải thiện sản phẩm.</small></span><input type="checkbox" /></label></div>}
      <footer><button className="secondary-action" type="button" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>
}
