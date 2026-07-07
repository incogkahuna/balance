import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // We exchange the OAuth code ourselves in AuthContext (see the explicit
    // exchangeCodeForSession call there) rather than relying on the client's
    // auto-detection. Auto-detection races React Router: the catch-all route
    // ("/" → "/dashboard") can strip the ?code= query param before the client
    // reads it, which produced an infinite login loop after the domain
    // migration. Doing it explicitly + first removes the race entirely.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})
