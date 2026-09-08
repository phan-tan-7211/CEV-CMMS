import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../data/supabaseClient'
import { loadLiveSession, type LiveSession } from '../data/liveAudit'
import './AuthGate.css'
import { PasswordRecovery } from './PasswordRecovery'
import { clearPasswordReset, markPasswordReset, wantsPasswordReset } from './passwordRecoveryRoute'

type State = { status: 'loading' | 'signedOut' | 'denied' | 'ready' | 'recovery'; session?: LiveSession }
const roles = ['ADMIN', 'MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER']

export function AuthGate({ children }: { children: (session: LiveSession, signOut: () => Promise<void>) => ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    let resolving = 0

    async function resolveSession(showLoading: boolean) {
      const version = ++resolving
      if (showLoading) setState((current) => current.status === 'ready' ? current : { status: 'loading' })
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!active || version !== resolving) return
        if (wantsPasswordReset()) { setState({ status: 'recovery' }); return }
        if (!data.session) { setState({ status: 'signedOut' }); return }
        try {
          const session = await loadLiveSession()
          if (!active || version !== resolving) return
          if (!roles.includes(session.role)) throw new Error('ROLE_REQUIRED')
          setError('')
          setState({ status: 'ready', session })
        } catch {
          if (active && version === resolving) {
            setState({ status: 'denied' })
            setError('Không xác nhận được quyền tài khoản. Hãy thử lại hoặc liên hệ quản trị viên để kiểm tra quyền truy cập.')
          }
        }
      } catch {
        if (active && version === resolving) {
          setState((current) => current.status === 'ready' ? current : { status: 'signedOut' })
          setError('Không đọc được phiên đăng nhập. Vui lòng kiểm tra kết nối rồi thử lại.')
        }
      }
    }

    void resolveSession(retry >= 0)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordReset()
        ++resolving
        setState({ status: 'recovery' })
        return
      }
      if (event === 'SIGNED_OUT') {
        ++resolving
        setState({ status: 'signedOut' })
        return
      }
      if (event === 'TOKEN_REFRESHED') {
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void resolveSession(false)
      }
    })
    return () => { active = false; ++resolving; subscription.unsubscribe() }
  }, [retry])

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
      setState({ status: 'signedOut' })
      setPassword('')
    } catch { setError('Đăng xuất chưa thành công. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) {
        setError(signInError.code === 'invalid_credentials' ? 'Email hoặc mật khẩu không đúng.' : 'Không đăng nhập được. Kiểm tra kết nối, thông tin tài khoản và trạng thái xác nhận email.')
        return
      }
      setPassword('')
      setRetry(value => value + 1)
    } catch { setError('Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  if (state.status === 'recovery') return <PasswordRecovery onClose={() => { clearPasswordReset(); setError(''); setState({ status: 'loading' }); setRetry(value => value + 1) }}/>

  if (state.status === 'ready' && state.session) return <>{error && <p className="auth-notice" role="alert">{error}</p>}{children(state.session, signOut)}</>
  return <main className="auth-page"><section className="auth-card" aria-label="Đăng nhập CEV CMMS"><p className="eyebrow">CEV CMMS</p><h1>Đăng nhập</h1>
    {state.status === 'loading' ? <p role="status">Đang xác nhận phiên đăng nhập…</p> : <>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {state.status === 'denied' ? <div className="auth-actions"><button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button><button type="button" disabled={busy} onClick={() => void signOut()}>Đăng xuất</button></div> : <form onSubmit={signIn}>
        <p>Dùng tài khoản đã được quản trị viên cấp quyền.</p>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
        <button type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <button type="button" className="auth-secondary" disabled={busy} onClick={() => { setError(''); setState({ status: 'recovery' }) }}>Quên / chưa có mật khẩu?</button>
      </form>}
    </>}
  </section></main>
}
