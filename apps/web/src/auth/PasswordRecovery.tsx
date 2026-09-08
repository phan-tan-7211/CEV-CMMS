import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../data/supabaseClient'
import { wantsPasswordReset } from './passwordRecoveryRoute'

type Phase = 'checking' | 'request' | 'password' | 'success'
export function PasswordRecovery({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(() => wantsPasswordReset() ? 'checking' : 'request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!wantsPasswordReset()) return
    let active = true
    async function check() {
      try {
        if (new URL(window.location.href).searchParams.has('auth_error')) throw new Error('INVALID_LINK')
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !data.session) throw new Error('NO_SESSION')
        if (active) { setEmail(data.session.user.email || ''); setPhase('password') }
      } catch {
        if (active) { setPhase('request'); setError('Link không hợp lệ, đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu email mới bên dưới.') }
      }
    }
    void check()
    return () => { active = false }
  }, [])

  async function requestEmail(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (requestError) throw requestError
      setNotice('Nếu email có tài khoản, bạn sẽ nhận được link đặt mật khẩu. Kiểm tra cả thư rác và chỉ dùng email mới nhất.')
    } catch { setError('Chưa gửi được email. Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên.') }
    finally { setBusy(false) }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return }
    if (password !== confirmation) { setError('Hai mật khẩu chưa trùng nhau.'); return }
    setBusy(true)
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !data.session) { setPhase('request'); throw new Error('SESSION_EXPIRED') }
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        if (['session_not_found', 'refresh_token_not_found', 'bad_jwt'].includes(updateError.code || '') || updateError.status === 401) setPhase('request')
        setError(updateError.code === 'same_password' ? 'Mật khẩu mới phải khác mật khẩu cũ.' : 'Chưa lưu được mật khẩu. Kiểm tra yêu cầu độ mạnh mật khẩu hoặc yêu cầu link mới nếu phiên đã hết hạn.')
        return
      }
      setPassword(''); setConfirmation(''); setPhase('success')
    } catch { setError('Phiên không còn hợp lệ hoặc kết nối bị gián đoạn. Vui lòng thử lại hoặc yêu cầu email mới.') }
    finally { setBusy(false) }
  }

  return <main className="auth-page"><section className="auth-card" aria-label="Đặt mật khẩu"><p className="eyebrow">CEV Equipment · IATF 16949</p>
    <h1>{phase === 'request' ? 'Quên / chưa có mật khẩu' : 'Đặt mật khẩu mới'}</h1>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {phase === 'checking' && <p role="status">Đang xác nhận link…</p>}
    {phase === 'request' && <form onSubmit={requestEmail}><p>Nhập email tài khoản để nhận link đặt mật khẩu riêng cho ứng dụng.</p><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/></label><button disabled={busy} type="submit">{busy ? 'Đang gửi…' : 'Gửi link đặt mật khẩu'}</button></form>}
    {phase === 'password' && <form onSubmit={savePassword}><p>{email}</p><label>Mật khẩu mới<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label><label>Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy}/></label><p className="auth-help">Ít nhất 8 ký tự. Dùng mật khẩu riêng cho ứng dụng.</p><button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button></form>}
    {phase === 'success' && <p role="status">Đã lưu mật khẩu mới. Từ lần sau bạn có thể đăng nhập bằng email và mật khẩu này.</p>}
    <button type="button" className="auth-secondary" disabled={busy || phase === 'checking'} onClick={onClose}>{phase === 'success' ? 'Tiếp tục vào ứng dụng' : 'Quay lại'}</button>
  </section></main>
}
