import { useEffect, useRef, useState } from 'react'
import './AccountMenu.css'

const ROLE_LABEL: Record<string,string> = {
  MAINTENANCE: 'Bảo trì',
  SUPERVISOR: 'Giám sát',
  QUALITY: 'Chất lượng',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị hệ thống',
  UNKNOWN: 'Chưa xác định',
}

export function AccountMenu({ email, role, signOut }: {
  email: string
  role: string
  signOut: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return <div className="account-menu" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <button ref={trigger} className="account-trigger" type="button" aria-label="Tài khoản"
      aria-expanded={open} aria-controls="account-details" onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
      </svg>
    </button>
    {open && <section id="account-details" className="account-details" aria-label="Thông tin tài khoản">
      <strong>{email}</strong><span>{ROLE_LABEL[role] || role}</span>
      <button className="signout-button" type="button" onClick={() => { setOpen(false); void signOut() }}>Đăng xuất</button>
    </section>}
  </div>
}
