import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { MobileNav } from './MobileNav.jsx'
import { TopBar } from './TopBar.jsx'
import { Breadcrumbs } from './Breadcrumbs.jsx'
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
        {/* pb on mobile clears the fixed bottom MobileNav (~64px after the
            mobile-pass sizing bump) plus the iPhone home-indicator safe
            area inset, otherwise the last list row is hidden under the
            nav. lg:pb-0 because the sidebar replaces the bottom nav at
            desktop widths. */}
        <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">
          {/* TopBar — sticky top of the content area on every viewport.
              Holds the user cluster (avatar / theme / sign out / bell)
              per Wilder's feedback. On mobile it also shows the Balance
              brand on the left since there's no sidebar. */}
          <TopBar />
          {/* Breadcrumbs — shows the navigation path so users can hop back
              to where they came from. Hidden when there's only one entry
              in the trail (i.e. you just landed somewhere). */}
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
