import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { MobileNav } from './MobileNav.jsx'
import { useApp } from '../../context/AppContext.jsx'

export function AppShell() {
  const { currentUser } = useApp()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#03070d' }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Subtle vertical chrome divider highlight on the right edge of sidebar */}
        <div
          className="hidden lg:block absolute left-0 top-0 bottom-0 w-px pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(14,165,233,0.08) 30%, rgba(14,165,233,0.08) 70%, transparent)', zIndex: 5 }}
        />

        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
