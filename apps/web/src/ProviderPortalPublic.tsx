import { useEffect, useState } from 'react'
import './ProviderPortalPublic.css'
import { supabase } from './data/supabaseClient'

type ProviderPortalSnapshot = {
  shareId: string
  workOrderId: string
  providerName: string
  contactName: string
  shareStatus: string
  workOrderStatus: string
  equipmentId: string
  equipmentName: string
  reason: string
  priority: string
  expiresAt?: string | null
  activity: Array<{ action: string; note: string; actorLabel: string; createdAt: string }>
}

type ProviderAction = 'ACKNOWLEDGE' | 'START' | 'COMPLETE' | 'COMMENT'

export function ProviderPortalPublic({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<ProviderPortalSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [actorLabel, setActorLabel] = useState('Nhà thầu')
  const [note, setNote] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('rpc_cmms_provider_portal_snapshot', { p_token: token })
      if (rpcError) throw rpcError
      setSnapshot(data as ProviderPortalSnapshot)
    } catch (reason) {
      setSnapshot(null)
      setError(reason instanceof Error ? reason.message : 'Liên kết không hợp lệ hoặc đã hết hạn.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [token])

  async function submit(action: ProviderAction) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('rpc_cmms_provider_portal_action', {
        p_token: token,
        p_action: action,
        p_note: note.trim() || null,
        p_actor_label: actorLabel.trim() || 'Nhà thầu',
      })
      if (rpcError) throw rpcError
      setNote('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được tiến độ.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <main className="provider-portal-shell"><section className="provider-portal-card provider-portal-center"><div className="provider-spinner"/><p>Đang tải Work Order…</p></section></main>

  if (!snapshot) return <main className="provider-portal-shell"><section className="provider-portal-card provider-portal-center"><div className="provider-error-icon">!</div><h1>Không mở được Provider Portal</h1><p>{error || 'Liên kết không hợp lệ, đã hết hạn hoặc đã bị thu hồi.'}</p></section></main>

  return <main className="provider-portal-shell">
    <section className="provider-portal-card">
      <header className="provider-portal-header">
        <div><p className="provider-eyebrow">CEV CMMS · PROVIDER PORTAL</p><h1>{snapshot.providerName || 'Nhà cung cấp / Nhà thầu'}</h1><p className="provider-subtitle">Chỉ hiển thị Work Order đã được CEV chia sẻ.</p></div>
        <span className={`provider-status provider-status-${snapshot.shareStatus.toLowerCase()}`}>{snapshot.shareStatus}</span>
      </header>

      <div className="provider-grid">
        <div><span>Work Order</span><strong>{snapshot.workOrderId}</strong></div>
        <div><span>Trạng thái WO</span><strong>{snapshot.workOrderStatus}</strong></div>
        <div><span>Thiết bị</span><strong>{snapshot.equipmentName || snapshot.equipmentId || '—'}</strong></div>
        <div><span>Ưu tiên</span><strong>{snapshot.priority || '—'}</strong></div>
      </div>

      <section className="provider-section"><h2>Nội dung công việc</h2><p className="provider-reason">{snapshot.reason || 'Không có mô tả.'}</p></section>

      <section className="provider-section">
        <h2>Cập nhật tiến độ</h2>
        <label className="provider-field"><span>Tên người cập nhật</span><input value={actorLabel} onChange={(event) => setActorLabel(event.target.value)} placeholder="Tên kỹ thuật viên / nhà thầu" /></label>
        <label className="provider-field"><span>Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tiến độ, kết quả, vấn đề cần CEV hỗ trợ…" rows={4}/></label>
        {error ? <div className="provider-alert">{error}</div> : null}
        <div className="provider-actions">
          <button disabled={busy} onClick={() => void submit('ACKNOWLEDGE')}>Xác nhận nhận việc</button>
          <button disabled={busy} onClick={() => void submit('START')}>Bắt đầu</button>
          <button disabled={busy} className="secondary" onClick={() => void submit('COMMENT')}>Gửi cập nhật</button>
          <button disabled={busy} className="success" onClick={() => void submit('COMPLETE')}>Hoàn tất phía nhà thầu</button>
        </div>
      </section>

      <section className="provider-section"><h2>Lịch sử trao đổi</h2>{snapshot.activity.length ? <div className="provider-activity-list">{snapshot.activity.map((item, index) => <article key={`${item.createdAt}-${index}`}><div><strong>{item.action}</strong><span>{item.actorLabel || 'Provider'}</span></div><p>{item.note || 'Không ghi chú'}</p><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time></article>)}</div> : <p className="provider-muted">Chưa có cập nhật.</p>}</section>

      <footer className="provider-footer">Liên kết này không cung cấp quyền truy cập các module khác của CEV CMMS.{snapshot.expiresAt ? ` Hết hạn: ${new Date(snapshot.expiresAt).toLocaleString('vi-VN')}.` : ''}</footer>
    </section>
  </main>
}
