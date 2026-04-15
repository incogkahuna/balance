import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { LayoutDashboard, Film, Calendar, BarChart3, Users } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'HOME'     },
  { to: '/productions', icon: Film,             label: 'JOBS'     },
  { to: '/schedule',    icon: Calendar,         label: 'SCHED'    },
  { to: '/contractors', icon: Users,            label: 'CREW',    adminOrSup: true },
  { to: '/analytics',   icon: BarChart3,        label: 'DATA',    adminOnly: true  },
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
        background: 'linear-gradient(180deg, #060e1a 0%, #04090f 100%)',
        borderTop: '1px solid #112235',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 -4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1 relative flex flex-col items-center justify-center py-3 gap-1.5 transition-all group"
            style={({ isActive }) => isActive ? {
              color: '#38bdf8',
            } : {
              color: '#3f5a75',
            }}
          >
            {({ isActive }) => (
              <>
                {/* Active top bar */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)' }} />
                )}

                <Icon size={19} />

                <span className="font-telemetry text-[8px] tracking-[0.15em]">
                  {label}
                </span>

                {/* Active glow dot */}
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-sky-400 animate-indicator-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
