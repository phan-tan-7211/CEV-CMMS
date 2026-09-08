/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn() }))
vi.mock('../data/supabaseClient', () => ({ supabase: { auth: mocks } }))
import { PasswordRecovery } from './PasswordRecovery'
import { preparePasswordCallback } from './passwordRecoveryRoute'
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/?auth=reset-password')
  mocks.getSession.mockResolvedValue({ data: { session: { user: { email: 'test@example.com' } } } })
  mocks.updateUser.mockResolvedValue({ error: null })
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })
it('preserves recovery intent before the SDK removes the hash', () => {
  window.history.replaceState({}, '', '/#type=recovery&access_token=fixture')
  preparePasswordCallback()
  expect(window.location.search).toBe('?auth=reset-password')
  expect(window.location.hash).toContain('access_token=fixture')
})
it('rejects an expired callback even with another existing session', async () => {
  window.history.replaceState({}, '', '/#error=access_denied&error_code=otp_expired')
  preparePasswordCallback()
  render(<PasswordRecovery onClose={vi.fn()}/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Link không hợp lệ')
  expect(screen.queryByLabelText('Mật khẩu mới')).not.toBeInTheDocument()
  expect(mocks.updateUser).not.toHaveBeenCalled()
})
it('requires a session and offers a fresh email instead', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  render(<PasswordRecovery onClose={vi.fn()}/>)
  expect(await screen.findByRole('button', { name: 'Gửi link đặt mật khẩu' })).toBeVisible()
  expect(mocks.updateUser).not.toHaveBeenCalled()
})
it('validates confirmation then saves the password through Supabase', async () => {
  render(<PasswordRecovery onClose={vi.fn()}/>)
  fireEvent.change(await screen.findByLabelText('Mật khẩu mới'), { target: { value: 'New-password-123' } })
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'Different-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('chưa trùng nhau')
  expect(mocks.updateUser).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'New-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu mật khẩu mới')
  expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'New-password-123' })
  expect(screen.queryByLabelText('Mật khẩu mới')).not.toBeInTheDocument()
})
it('keeps the form on server rejection without claiming success', async () => {
  mocks.updateUser.mockResolvedValue({ error: { code: 'weak_password' } })
  render(<PasswordRecovery onClose={vi.fn()}/>)
  fireEvent.change(await screen.findByLabelText('Mật khẩu mới'), { target: { value: 'weak-password' } })
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'weak-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa lưu được')
  expect(screen.queryByText(/Đã lưu mật khẩu mới/)).not.toBeInTheDocument()
})
it('requests an email with the current site root as redirect and neutral confirmation', async () => {
  window.history.replaceState({}, '', '/')
  render(<PasswordRecovery onClose={vi.fn()}/>)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi link đặt mật khẩu' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Nếu email có tài khoản')
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', { redirectTo: window.location.origin + '/' })
})
