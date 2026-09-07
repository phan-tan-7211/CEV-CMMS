// Shared infrastructure boundary for Supabase access.
// The client initialization remains in the legacy module temporarily so this
// migration can be incremental without changing auth/session behavior.
export { mobileSupabaseConfigured, supabase } from '../../supabase'
