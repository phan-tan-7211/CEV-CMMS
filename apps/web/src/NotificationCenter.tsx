import { useEffect, useRef, useState } from 'react'
import './NotificationCenter.css'

type NotificationItem = {
  id: string
  title: string
  actor: string
  time: string
  unread?: boolean
}

const PREVIEW_NOTIFICATIONS: NotificationItem[] = [
  { id: 'assignment', title: 'Bạn được phân công một lệnh công việc', actor: 'CEV CMMS', time: 'Hôm nay', unread: true },
  { id: 'status', title: 'Lệnh công việc đã được cập nhật', actor: 'CEV CMMS', time: 'Hôm qua' },
]

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(PREVIEW_NOTIFICATIONS)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const unread = items.filter((item) => item.unread).length
  return <div className="notification-center" ref={root}>
    <button ref={trigger} className="notification-trigger" type="button" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      {unread ? <span className="notification-dot" aria-label={`${unread} chưa đọc`}>{unread}</span> : null}
    </button>
    {open ? <section id="notification-panel" className="notification-panel" role="dialog" aria-label="Thông báo">
      <header><h2>Thông báo</h2><button type="button" onClick={() => setItems((current) => current.map((item) => ({ ...item, unread: false })))}>Đánh dấu đã đọc</button></header>
      <div className="notification-list">{items.map((item) => <button key={item.id} type="button" className={item.unread ? 'is-unread' : ''} onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))}><span className="notification-avatar">C</span><span><strong>{item.title}</strong><small>{item.actor}</small><small>{item.time}</small></span></button>)}</div>
      <footer>Thông báo được sắp xếp theo thời gian</footer>
    </section> : null}
  </div>
}
