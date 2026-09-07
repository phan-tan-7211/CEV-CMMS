import { supabase } from '../../../lib/supabase/client'

export async function updateOwnProfile(displayName: string, phone: string) {
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: displayName.trim(),
      phone: phone.trim(),
    },
  })
  if (error) throw new Error(error.message || 'Không lưu được hồ sơ.')
}

export async function updateOwnPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message || 'Không đổi được mật khẩu.')
}
