import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'
// Only ONE of the two set is a real misconfiguration worth failing loudly on —
// NEITHER set just means "no Supabase config given", which client.ts already
// treats as demo mode (see IS_DEMO_MODE in client.ts), so don't throw for that.
const partiallyConfigured = (!!supabaseUrl) !== (!!supabaseAnonKey)

if (!isDemoMode && partiallyConfigured) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in a .env file at the project root.'
  )
}

// In demo mode (explicit or no-config fallback) client.ts routes everything to
// demoClient.ts instead of this file, so this client is created but never
// actually called — the placeholder keeps createClient() from throwing.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key')
