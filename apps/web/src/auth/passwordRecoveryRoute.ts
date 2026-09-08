// This is only a UI route. Supabase validates the session and every password write.
export function wantsPasswordReset() {
  return new URL(window.location.href).searchParams.get('auth') === 'reset-password'
}
export function markPasswordReset() {
  const url = new URL(window.location.href)
  url.searchParams.set('auth', 'reset-password')
  window.history.replaceState({}, '', url)
}
export function clearPasswordReset() {
  const url = new URL(window.location.href)
  url.searchParams.delete('auth')
  url.searchParams.delete('auth_error')
  url.hash = ''
  window.history.replaceState({}, '', url)
}
export function preparePasswordCallback() {
  const url = new URL(window.location.href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (['recovery', 'invite'].includes(fragment.get('type') || '')) url.searchParams.set('auth', 'reset-password')
  if (fragment.has('error') || url.searchParams.has('error')) {
    url.searchParams.set('auth', 'reset-password')
    url.searchParams.set('auth_error', '1')
    url.hash = ''
    for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key)
  }
  window.history.replaceState({}, '', url)
}
