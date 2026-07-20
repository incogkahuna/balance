import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext.jsx'
import { USERS } from '../data/models.js'
import { BackgroundFX } from '../components/layout/BackgroundFX.jsx'
import { OrbitalMark } from '../components/brand/OrbitalLogo.jsx'

// ─── LoginPage — the airlock ─────────────────────────────────────────────────
// The entry to Balance is a brand moment: forced-dark cinematic scene, the
// official Orbital emblem, orbital-ring geometry, a stage-floor grid, and a
// single luminous action. Everything rises in on a stagger.

export function LoginPage() {
  const { session, loading, signInWithGoogle, error: authError } = useAuth()
  const { currentUser, setDevViewAs } = useApp()
  const navigate = useNavigate()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="dark">
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-orbital-bg">
          <OrbitalMark size={40} spin />
          <p className="font-telemetry text-[9px] tracking-[0.3em] text-orbital-subtle">
            INITIALIZING
          </p>
        </div>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  // DEV bypass — if a devViewAs impersonation is already set in localStorage,
  // currentUser will be non-null even without a real session.
  if (import.meta.env.DEV && currentUser) {
    return <Navigate to="/dashboard" replace />
  }

  const handleDevQuickPick = (userId: string) => {
    setDevViewAs(userId)
    navigate('/dashboard')
  }

  const handleSignIn = async () => {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setSigningIn(false)
    }
  }

  // Forced dark: the airlock is always cinematic, whatever theme the user
  // runs inside. Tailwind's `darkMode: 'class'` honors any ancestor `.dark`.
  return (
    <div className="dark">
      <div className="relative min-h-screen overflow-hidden bg-orbital-bg text-orbital-text">
        {/* Scene: orbital rings above, stage grid below — the LED volume. */}
        <BackgroundFX preset="orbit" />
        <div className="bgfx" aria-hidden="true">
          <div className="bgfx-horizon" />
          <div className="bgfx-grid" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-14">

          {/* Emblem + product */}
          <div className="animate-rise flex flex-col items-center" style={{ animationDelay: '0.05s' }}>
            <OrbitalMark size={84} />
            <h1
              className="mt-8 text-[34px] sm:text-[40px] font-bold leading-none text-orbital-text"
              style={{ letterSpacing: '0.34em', marginRight: '-0.34em' }}
            >
              BALANCE
            </h1>
            <p
              className="mt-3 font-telemetry text-[10px] text-orbital-subtle uppercase"
              style={{ letterSpacing: '0.42em', marginRight: '-0.42em' }}
            >
              Orbital Studios
            </p>
          </div>

          {/* Tagline */}
          <p
            className="animate-rise mt-6 text-sm text-orbital-subtle text-center max-w-sm"
            style={{ animationDelay: '0.18s' }}
          >
            Mission control for virtual production — stages, crews, and
            timelines in one instrument.
          </p>

          {/* Action */}
          <div className="animate-rise w-full max-w-sm mt-10" style={{ animationDelay: '0.3s' }}>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="group relative w-full flex items-center justify-center gap-3 px-4 py-4 transition-all active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(13,18,32,0.75)',
                border: '1px solid var(--accent-ring)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 32px rgba(59,168,224,0.12), inset 0 1px 0 rgba(133,178,255,0.08)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 48px rgba(59,168,224,0.28), inset 0 1px 0 rgba(133,178,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 32px rgba(59,168,224,0.12), inset 0 1px 0 rgba(133,178,255,0.08)' }}
            >
              <GoogleLogo />
              <span className="font-semibold text-orbital-text tracking-wide">
                {signingIn ? 'Redirecting…' : 'Continue with Google'}
              </span>
            </button>

            {(error || authError) && (
              <p className="mt-4 text-xs text-red-400 text-center">{error || authError}</p>
            )}

            <p className="mt-5 text-[11px] text-orbital-subtle/80 text-center leading-relaxed">
              Use your Orbital Studios Google account.
              <br />
              New here? Ask an admin to add you to the crew.
            </p>
          </div>

          {/* DEV-only quick login — never renders in production builds. */}
          {import.meta.env.DEV && (
            <div
              className="animate-rise w-full max-w-sm mt-10 p-4"
              style={{
                animationDelay: '0.42s',
                background: 'rgba(251,191,36,0.05)',
                border: '1px dashed rgba(251,191,36,0.4)',
              }}
            >
              <p className="font-telemetry text-[10px] tracking-[0.22em] text-amber-400 mb-2 text-center">
                DEV BYPASS — LOCALHOST ONLY
              </p>
              <p className="text-[11px] text-orbital-subtle mb-3 text-center">
                Pick a team member to enter as. Use the sidebar switcher to swap later.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {USERS.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleDevQuickPick(u.id)}
                    className="flex items-center gap-2 px-2.5 py-2 bg-orbital-surface border border-orbital-border hover:border-amber-500/50 transition-colors text-left"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-orbital-text truncate">{u.name}</p>
                      <p className="text-[10px] text-orbital-dim uppercase tracking-wider">{u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Telemetry footer */}
          <div
            className="animate-rise absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6 font-telemetry text-[9px] tracking-[0.25em] text-orbital-subtle/60 uppercase"
            style={{ animationDelay: '0.55s' }}
          >
            <span>34.05°N&thinsp;118.24°W</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-indicator-pulse" />
              Systems nominal
            </span>
            <span>Balance&thinsp;v1</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
