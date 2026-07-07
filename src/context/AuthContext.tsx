import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Role = 'admin' | 'supervisor' | 'crew'

export interface Profile {
  id: string
  email: string
  name: string
  role: Role
  avatar_url: string | null
  color: string
  created_at: string
  updated_at: string
}

interface AuthContextValue {
  session: Session | null
  authUser: User | null
  profile: Profile | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const log = (...args: unknown[]) => console.log('[AuthContext]', ...args)
const warn = (...args: unknown[]) => console.warn('[AuthContext]', ...args)

// Capture the OAuth PKCE code at MODULE LOAD — the instant this file is first
// imported, which happens before ReactDOM renders anything. This is the only
// safe moment: React Router's catch-all redirect ("/" → "/dashboard",
// Navigate replace) fires DURING the first render, before any useEffect, and
// it rewrites the URL — stripping the ?code= that Supabase appended when it
// dropped us at the site root. Reading window.location inside the provider's
// effect was too late (that's why the loop persisted). We stash the string
// here and exchange it in the init effect below.
const CAPTURED_OAUTH_CODE =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('code')
    : null

async function fetchProfile(userId: string): Promise<Profile | null> {
  log('fetchProfile starting for', userId)
  try {
    const query = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    const { data, error } = await withTimeout(query, 5000, 'fetchProfile query')
    if (error) {
      warn('fetchProfile error:', error.message, error.code, error.details)
      return null
    }
    if (!data) {
      warn('fetchProfile returned no row — profile not yet created for', userId)
      return null
    }
    log('fetchProfile got', data.email, data.role)
    return data as Profile
  } catch (e) {
    warn('fetchProfile threw:', e instanceof Error ? e.message : e)
    return null
  }
}

// Synthesize a Profile from the session user when the profiles table can't be
// reached or returns no row. Lets the user keep using the app while we debug
// the underlying issue. Roles fall back to 'crew' as a safe default.
function profileFromSession(user: User): Profile {
  const meta = user.user_metadata || {}
  const fallbackName =
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split('@')[0] : 'User')
  return {
    id: user.id,
    email: user.email || '',
    name: fallbackName,
    role: 'crew',
    avatar_url: meta.avatar_url || null,
    color: '#6b7280',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// Wrap a promise with a timeout so the UI never gets stuck on a hung network
// call. If the supabase auth endpoint is unreachable we want a fast failure
// instead of "INITIALIZING" forever.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms: ${label}`))
    }, ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    log('initialising — checking for existing session')
    log('window.location.href =', window.location.href)

    ;(async () => {
      try {
        // ── Complete the OAuth PKCE exchange FIRST, if we just came back from
        //    Google. CAPTURED_OAUTH_CODE was grabbed at module load (before the
        //    router could strip it). The PKCE verifier lives in localStorage on
        //    this origin, so the exchange works regardless of which path
        //    Supabase landed us on (/ or /dashboard).
        log('captured OAuth code:', CAPTURED_OAUTH_CODE ? 'present' : 'none')
        if (CAPTURED_OAUTH_CODE) {
          log('exchanging OAuth code for a session')
          const { error: exchErr } = await withTimeout(
            supabase.auth.exchangeCodeForSession(CAPTURED_OAUTH_CODE),
            8000,
            'exchangeCodeForSession',
          )
          if (exchErr) {
            warn('exchangeCodeForSession failed:', exchErr.message)
            setError(exchErr.message)
          } else {
            log('code exchange succeeded')
          }
          // Clean any leftover auth params off the URL (best-effort; the
          // router may have already rewritten it).
          try {
            const u = new URL(window.location.href)
            u.searchParams.delete('code')
            u.searchParams.delete('error')
            u.searchParams.delete('error_description')
            window.history.replaceState({}, '', u.pathname + u.search + u.hash)
          } catch { /* noop */ }
        }

        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'supabase.auth.getSession()',
        )
        if (cancelled) return
        if (error) {
          warn('getSession error:', error.message)
          setError(error.message)
        }
        const initialSession = data?.session ?? null
        log('initial session:', initialSession ? `present (${initialSession.user.email})` : 'null')
        setSession(initialSession)
        if (initialSession?.user) {
          const p = await fetchProfile(initialSession.user.id)
          if (!cancelled) {
            // Fall back to a synthetic profile if the row doesn't exist yet
            // or the query failed. Lets the user into the app while we debug.
            setProfile(p || profileFromSession(initialSession.user))
          }
        }
      } catch (e) {
        warn('initialisation failed:', e)
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        // ALWAYS clear loading — without this the app gets stuck on the
        // INITIALIZING placeholder forever if anything goes wrong above.
        if (!cancelled) {
          log('initial load done — setLoading(false)')
          setLoading(false)
        }
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        log('onAuthStateChange:', event, nextSession ? `session for ${nextSession.user.email}` : 'no session')
        setSession(nextSession)
        if (nextSession?.user) {
          const p = await fetchProfile(nextSession.user.id)
          setProfile(p || profileFromSession(nextSession.user))
        } else {
          setProfile(null)
        }
        // If we somehow get here while still loading, unstick.
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    log('signInWithGoogle clicked')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      warn('signInWithOAuth error:', error.message)
      throw error
    }
  }

  async function signOut() {
    log('signOut')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        authUser: session?.user ?? null,
        profile,
        loading,
        error,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
