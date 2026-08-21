import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

if (!isDemoMode && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in a .env file at the project root.'
  )
}

// In demo mode client.ts routes everything to demoClient.ts instead of this file,
// so this client is created but never actually called — the placeholder keeps
// createClient() from throwing on a missing/malformed URL.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key')
