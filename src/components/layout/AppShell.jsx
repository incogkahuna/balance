import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { MobileNav } from './MobileNav.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../context/AuthContext.tsx'

export function AppShell() {
  const { currentUser } = useApp()
  const { session, loading } = useAuth()

  // While the auth state is still being initialised — including the moment a
  // user lands back on /dashboard after Google OAuth with `?code=` in the URL —
  // we MUST NOT redirect. A redirect here strips the code param, preventing
  // Supabase JS from completing the PKCE exchange. Show a placeholder instead.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orbital-bg">
        <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">
          INITIALIZING
        </p>
      </div>
    )
  }

  // Session exists but profile is still resolving — same hold-off treatment.
  if (session && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orbital-bg">
        <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">
          LOADING PROFILE
        </p>
      </div>
    )
  }

  if (!session || !currentUser) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-orbital-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
