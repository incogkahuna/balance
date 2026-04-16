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
