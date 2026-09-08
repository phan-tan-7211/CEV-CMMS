/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), loadLiveSession: vi.fn(),
  callback: (_event: string) => {}, unsubscribe: vi.fn(),
}))
vi.mock('../data/supabaseClient', () => ({ supabase: { auth: {
  getSession: mocks.getSession, signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut,
  onAuthStateChange: (callback: (event: string) => void) => { mocks.callback = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } },
} } }))
vi.mock('../data/liveAudit', () => ({ loadLiveSession: mocks.loadLiveSession }))
import { AuthGate } from './AuthGate'
function mount() { return render(<AuthGate>{(session, signOut) => <><h2>Workspace {session.role}</h2><button onClick={() => void signOut()}>Quit</button></>}</AuthGate>) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.loadLiveSession.mockResolvedValue({ role: 'ADMIN', email: 'test@example.com' })
  mocks.signOut.mockImplementation(async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.callback('SIGNED_OUT')
    return { error: null }
  })
})
afterEach(cleanup)
describe('Supabase authentication boundary', () => {
  it('shows login without fetching protected role or mounting workspaces', async () => {
    mount()
    expect(await screen.findByLabelText('Mật khẩu')).toHaveAttribute('type', 'password')
    expect(mocks.loadLiveSession).not.toHaveBeenCalled()
    expect(screen.queryByText(/Workspace/)).not.toBeInTheDocument()
  })
  it('reports invalid credentials and stays signed out', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } })
    mount()
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng')
    expect(screen.queryByText(/Workspace/)).not.toBeInTheDocument()
  })
  it('signs in, resolves database role, and unmounts private data on logout', async () => {
    mocks.signInWithPassword.mockImplementation(async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })
      mocks.callback('SIGNED_IN')
      return { error: null }
    })
    mount()
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByText('Workspace ADMIN')).toBeInTheDocument()
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'test-password' })
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    expect(await screen.findByLabelText('Mật khẩu')).toHaveValue('')
    expect(screen.queryByText('Workspace ADMIN')).not.toBeInTheDocument()
  })
  it('blocks an authenticated account without an assigned database role', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })
    mocks.loadLiveSession.mockRejectedValue(new Error('missing role'))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Không xác nhận được quyền')
    expect(screen.queryByText(/Workspace/)).not.toBeInTheDocument()
  })
  it('discards an in-flight role response after session sign-out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })
    let finish!: (value: { role: string }) => void
    mocks.loadLiveSession.mockReturnValue(new Promise(resolve => { finish = resolve }))
    mount()
    await waitFor(() => expect(mocks.loadLiveSession).toHaveBeenCalled())
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    act(() => mocks.callback('SIGNED_OUT'))
    await act(async () => finish({ role: 'ADMIN' }))
    expect(await screen.findByLabelText('Mật khẩu')).toBeInTheDocument()
    expect(screen.queryByText(/Workspace/)).not.toBeInTheDocument()
  })
})
