import { createClient } from '@supabase/supabase-js'
import { preparePasswordCallback } from '../auth/passwordRecoveryRoute'

// Preserve recovery/invite intent before Supabase consumes the URL fragment.
if (typeof window !== 'undefined') preparePasswordCallback()

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export function getSupabaseConfigStatus() {
  return {
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    url: supabaseUrl,
  }
}

// Keep a concrete client type so production data modules compile without nullable
// checks. The config status above remains the source of truth for diagnostics.
// Missing env values intentionally point to a non-routable placeholder and will
// fail at runtime rather than silently falling back to another backend.
export const supabase = createClient(
  supabaseUrl || 'https://supabase-not-configured.invalid',
  supabaseAnonKey || 'supabase-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

