import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Film, Calendar, BarChart3, Users } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Home'     },
  { to: '/productions', icon: Film,             label: 'Jobs'     },
  { to: '/schedule',    icon: Calendar,         label: 'Schedule' },
  { to: '/contractors', icon: Users,            label: 'Crew',    adminOrSup: true },
  { to: '/analytics',   icon: BarChart3,        label: 'Data',    adminOnly: true  },
]

export function MobileNav() {
  const { currentUser } = useApp()

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly)  return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  })

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: '#111214',
        borderTop: '1px solid #22232a',
      }}
    >
      <div
        className="flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
            style={({ isActive }) => ({
              color: isActive ? '#d0d1d5' : '#52535c',
              borderTop: isActive ? '1px solid #3b82f6' : '1px solid transparent',
            })}
          >
            <Icon size={17} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
