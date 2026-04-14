import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Film, Calendar, BarChart3, Users,
  LogOut, Settings, ChevronDown
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/productions', icon: Film,             label: 'Productions' },
  { to: '/schedule',    icon: Calendar,         label: 'Schedule' },
  { to: '/contractors', icon: Users,            label: 'Contractors', adminOrSup: true },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics',   adminOnly: true },
]

export function Sidebar() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly) return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  })

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-orbital-surface border-r border-orbital-border h-screen sticky top-0 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-orbital-border">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-orbital-text tracking-tight">Balance</span>
          <span className="text-xs text-orbital-subtle font-medium">by Orbital</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-orbital-subtle hover:text-orbital-text hover:bg-orbital-muted'
            )}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-orbital-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0"
            style={{ backgroundColor: currentUser?.color }}
          >
            {currentUser?.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orbital-text truncate">{currentUser?.name}</p>
            <p className="text-xs text-orbital-subtle capitalize">{currentUser?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-orbital-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
