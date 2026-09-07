import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { mobileSupabaseConfigured, supabase } from '../../../lib/supabase/client'

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message || 'Không đọc được phiên đăng nhập.')
  return data.session
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  if (!mobileSupabaseConfigured) throw new Error('Chưa cấu hình Supabase cho mobile.')

  const normalizedEmail = email.trim()
  if (!normalizedEmail || !password) throw new Error('Nhập email và mật khẩu.')

  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
  if (error) throw new Error(error.message || 'Đăng nhập thất bại.')
  if (!data.session) throw new Error('Không tạo được phiên đăng nhập.')
  return data.session
}

export async function signOutCurrentSession() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message || 'Đăng xuất thất bại.')
}

export function subscribeAuthState(listener: (event: AuthChangeEvent, session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange(listener)
  return () => data.subscription.unsubscribe()
}
