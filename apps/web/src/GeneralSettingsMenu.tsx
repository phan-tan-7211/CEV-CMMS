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
      <button type="button" onClick={() => action(onOpenCompanyProfile)}><strong>Hồ sơ công ty</strong><small>Tên, địa chỉ, số điện thoại, website và logo</small></button>
      <button type="button" onClick={() => action(onOpenOrganization)}><strong>Người dùng & nhóm</strong><small>Quản lý thành viên và quyền truy cập</small></button>
      <button type="button" onClick={() => action(onOpenAudit)}><strong>Ngôn ngữ, tiền tệ & ngày giờ</strong><small>Thiết lập hiển thị chung cho công ty</small></button>
    </section> : null}
  </div>
}
