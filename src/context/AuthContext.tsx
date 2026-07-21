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
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'color' | 'avatar_url'>>) => Promise<void>
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

// ─── Domain allowlist + per-email grants ─────────────────────────────────────
// Balance is for Orbital Studios staff — plus specific outside accounts Danny
// explicitly grants. The server is the source of truth: handle_new_user
// (migration 20260720000000) only provisions a profile for @orbitalvs.com
// addresses OR emails pre-authorized in role_assignments; everything else is
// rejected at signup. The client-side gate mirrors that rule for sessions
// that already exist: orbital domain → in; outside domain → in ONLY if a
// profiles row exists (meaning the server approved it); otherwise sign out
// with a message. Granting an outside account is one SQL insert into
// role_assignments — no code change.
const ALLOWED_EMAIL_DOMAIN = '@orbitalvs.com'
function isAllowedEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)
}
const ACCESS_DENIED_MSG =
  'Access is restricted to Orbital Studios accounts. Sign in with your @orbitalvs.com email, or ask Danny to grant this address access.'

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

    // Sign out + clear any session that isn't an allowed Orbital account, and
    // surface the reason on the login screen. Signing out re-fires
    // onAuthStateChange with a null session, which the guards below ignore, so
    // there's no loop.
    const blockDisallowed = async (email?: string | null) => {
      warn('blocking non-orbital session:', email)
      try { await supabase.auth.signOut() } catch { /* best-effort */ }
      if (!cancelled) {
        setSession(null)
        setProfile(null)
        setError(ACCESS_DENIED_MSG)
        setLoading(false)
      }
    }

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
        if (initialSession?.user) {
          const allowedDomain = isAllowedEmail(initialSession.user.email)
          const p = await fetchProfile(initialSession.user.id)
          if (cancelled) return
          // Outside-domain sessions are admitted ONLY when their profile row
          // exists — that row is the server's proof the account was granted
          // (fail closed: no profile → no access, no synthetic fallback).
          if (!allowedDomain && !p) {
            await blockDisallowed(initialSession.user.email)
            return
          }
          setSession(initialSession)
          // Orbital accounts keep the synthetic-profile fallback so a flaky
          // profiles query never locks staff out while we debug.
          setProfile(p || profileFromSession(initialSession.user))
        } else {
          setSession(null)
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
        if (nextSession?.user) {
          // Same gate on every auth transition — catches the moment an
          // account completes Google OAuth. Outside domains need their
          // server-provisioned profile row to exist; no row → signed out.
          const allowedDomain = isAllowedEmail(nextSession.user.email)
          const p = await fetchProfile(nextSession.user.id)
          if (!allowedDomain && !p) {
            await blockDisallowed(nextSession.user.email)
            return
          }
          setSession(nextSession)
          setProfile(p || profileFromSession(nextSession.user))
        } else {
          setSession(nextSession)
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

  // Own-row edits only (name / color / avatar) — the profiles_update_own RLS
  // policy blocks role changes, so role is deliberately not in the patch type.
  async function updateProfile(patch: Partial<Pick<Profile, 'name' | 'color' | 'avatar_url'>>) {
    if (!session?.user) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data as Profile)
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
        updateProfile,
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
