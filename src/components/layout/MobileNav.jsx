import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { LayoutDashboard, Film, Calendar, BarChart3 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/productions', icon: Film, label: 'Productions' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', adminOnly: true },
]

export function MobileNav() {
  const { currentUser } = useApp()

  const visibleItems = navItems.filter(item =>
    !item.adminOnly || currentUser?.role === ROLES.ADMIN
  )

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-orbital-surface border-t border-orbital-border safe-area-pb">
      <div className="flex items-center">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isActive ? 'text-blue-400' : 'text-orbital-subtle'
            )}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
