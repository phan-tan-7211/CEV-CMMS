import { useEffect, useMemo, useRef, useState } from 'react'
import './DesktopSidebar.css'

type SidebarItem<T extends string> = { id: T; label: string }

type DesktopSidebarProps<T extends string> = {
  items: SidebarItem<T>[]
  currentView: T
  roleLabel: string
  email: string
  onNavigate: (view: T) => void
  onSignOut: () => void
}

type IconName = 'dashboard' | 'qr' | 'equipment' | 'inventory' | 'inspection' | 'maintenance' | 'spare' | 'tooling' | 'calibration' | 'print' | 'organization' | 'settings' | 'search' | 'collapse'

const GROUPS = [
  { label: 'Tổng quan', ids: ['dashboard', 'qr'] },
  { label: 'Công việc', ids: ['work-orders', 'maintenance', 'scheduler', 'requests'] },
  { label: 'Phân tích', ids: ['analytics'] },
  { label: 'Tài sản & quản lý', ids: ['meters', 'edge', 'equipment', 'locations', 'organization', 'inspection', 'files', 'import-export', 'inventory', 'spare', 'purchase-orders', 'customers', 'providers', 'people', 'tooling', 'calibration'] },
  { label: 'Hồ sơ & quản trị', ids: ['print', 'settings'] },
] as const

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><path d="M4 13h6V4H4z"/><path d="M14 20h6v-9h-6z"/><path d="M14 8h6V4h-6z"/><path d="M4 20h6v-3H4z"/></>,
    qr: <><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M15 15h1"/><path d="M19 15h1v2"/><path d="M14 19h2v1"/><path d="M19 20h1"/></>,
    equipment: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></>,
    inventory: <><path d="M4 7h16v13H4z"/><path d="M7 4h10l2 3H5z"/><path d="M9 11h6"/></>,
    inspection: <><path d="M8 4h8"/><path d="M9 3v3h6V3"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="m8 13 2 2 5-5"/></>,
    maintenance: <><path d="m14 7 3-3 3 3-3 3"/><path d="M16 8 8 16"/><path d="m5 15-2 2 4 4 2-2"/><circle cx="8" cy="8" r="3"/></>,
    spare: <><path d="M5 7 12 3l7 4-7 4z"/><path d="M5 7v10l7 4 7-4V7"/><path d="M12 11v10"/></>,
    tooling: <><path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-4-4z"/></>,
    calibration: <><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></>,
    print: <><path d="M7 9V3h10v6"/><rect x="5" y="9" width="14" height="9" rx="2"/><path d="M8 15h8v6H8z"/></>,
    organization: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M4 20a5 5 0 0 1 10 0M14 20a4 4 0 0 1 7 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1-2-4-2 1a7 7 0 0 0-2-1l-.3-2h-5L9 6a7 7 0 0 0-2 1L5 6l-2 4 2 1a7 7 0 0 0 0 2l-2 1 2 4 2-1a7 7 0 0 0 2 1l.5 2h5l.5-2a7 7 0 0 0 2-1l2 1 2-4-2-1a7 7 0 0 0 .1-1z"/></>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    collapse: <><path d="M15 6 9 12l6 6"/></>,
  }
  return <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function iconFor(id: string): IconName {
  const aliases: Record<string, IconName> = {
    dashboard: 'dashboard',
    qr: 'qr',
    equipment: 'equipment',
    inventory: 'inventory',
    inspection: 'inspection',
    maintenance: 'maintenance',
    spare: 'spare',
    tooling: 'tooling',
    calibration: 'calibration',
    print: 'print',
    organization: 'organization',
    settings: 'settings',
    work-orders: 'maintenance',
    scheduler: 'calibration',
    requests: 'inspection',
    analytics: 'dashboard',
    meters: 'calibration',
    edge: 'qr',
    locations: 'equipment',
    files: 'print',
    'import-export': 'inventory',
    'purchase-orders': 'print',
    customers: 'organization',
    providers: 'organization',
    people: 'organization',
  }
  return aliases[id] || 'dashboard'
}

export function DesktopSidebar<T extends string>({ items, currentView, roleLabel, email, onNavigate, onSignOut }: DesktopSidebarProps<T>) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cev-sidebar-collapsed') === '1')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem('cev-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (collapsed) setCollapsed(false)
        requestAnimationFrame(() => searchRef.current?.focus())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [collapsed])

  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filteredItems = useMemo(() => normalizedQuery ? items.filter((item) => item.label.toLocaleLowerCase('vi').includes(normalizedQuery)) : items, [items, normalizedQuery])

  return <aside className={`desktop-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Điều hướng trên máy tính">
    <span hidden>CEV CMMS</span>
    <div className="sidebar-brand-row">
      <div className="sidebar-brand" title={collapsed ? 'CEV CMMS' : undefined}>
        <span className="sidebar-brand-mark">CEV</span>
        <div className="sidebar-brand-copy"><strong>Equipment CMMS</strong><small>Maintenance & Asset Management</small></div>
      </div>
      <button className="sidebar-collapse" type="button" title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} onClick={() => setCollapsed((value) => !value)}><NavIcon name="collapse" /></button>
    </div>

    <div className="sidebar-search-wrap">
      <NavIcon name="search" />
      <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm chức năng…" aria-label="Tìm chức năng" />
      <kbd>Ctrl K</kbd>
    </div>

    <nav className="desktop-sidebar-nav">
      {GROUPS.map((group) => {
        const groupItems = filteredItems.filter((item) => group.ids.includes(item.id as never))
        if (!groupItems.length) return null
        return <section className="sidebar-nav-group" key={group.label} aria-label={group.label}>
          <div className="sidebar-group-label">{group.label}</div>
          {groupItems.map((item) => <button key={item.id} type="button" className={item.id === currentView ? 'active' : ''} aria-current={item.id === currentView ? 'page' : undefined} onClick={() => onNavigate(item.id)} title={collapsed ? item.label : undefined}>
            <NavIcon name={iconFor(item.id)} />
            <span>{item.label}</span>
          </button>)}
        </section>
      })}
      {!filteredItems.length && !collapsed ? <div className="sidebar-empty">Không tìm thấy chức năng</div> : null}
    </nav>

    <div className="desktop-sidebar-footer">
      <div className="sidebar-plant" title={collapsed ? 'CEV Vietnam · Supabase Live' : undefined}><span className="sidebar-status-dot"/><div><strong>CEV Vietnam</strong><small>Supabase Live</small></div></div>
      <div className="sidebar-account" title={collapsed ? `${roleLabel} · ${email}` : undefined}>
        <span className="sidebar-avatar">{roleLabel.trim().charAt(0).toUpperCase() || 'U'}</span>
        <div className="sidebar-account-copy"><strong>{roleLabel}</strong><span>{email || 'Xác thực Supabase'}</span></div>
        <button type="button" onClick={onSignOut}>Đăng xuất</button>
      </div>
    </div>
  </aside>
}
