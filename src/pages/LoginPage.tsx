import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { session, loading, signInWithGoogle } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orbital-bg">
        <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">
          INITIALIZING
        </p>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-orbital-bg px-6 py-12">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-orbital-text tracking-tight mb-1">Balance</h1>
        <p className="text-orbital-subtle text-sm font-medium">
          Virtual Production Management — Orbital Studios
        </p>
      </div>

      <div className="w-full max-w-md">
        <p className="section-title text-center mb-5">Sign in to continue</p>

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-orbital-surface border border-orbital-border hover:border-blue-500/50 hover:bg-orbital-muted transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleLogo />
          <span className="font-semibold text-orbital-text">
            {signingIn ? 'Redirecting…' : 'Continue with Google'}
          </span>
        </button>

        {error && (
          <p className="mt-4 text-xs text-red-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-orbital-muted text-center">
          Use your Orbital Studios Google account.
          <br />
          New here? Ask an admin to add you to the team.
        </p>
      </div>

      <p className="mt-12 text-xs text-orbital-muted text-center">
        Balance v1 — Built by Danny Horgan in partnership with Orbital Studios
      </p>
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
