import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Film, Calendar, BarChart3, Users, UserSquare2, Sparkles, Rocket, Monitor } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'
import { DevProfileSwitcher } from '../dev/DevProfileSwitcher.jsx'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/productions', icon: Film,             label: 'Productions' },
  { to: '/schedule',    icon: Calendar,         label: 'Schedule'    },
  { to: '/team',        icon: UserSquare2,      label: 'Team'        },
  { to: '/contractors', icon: Users,            label: 'Contractors', adminOrSup: true },
  { to: '/gear',        icon: Monitor,          label: 'Gear',        adminOrSup: true },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics',   adminOnly: true  },
  { to: '/coming-soon', icon: Rocket,         label: 'Coming Soon'  },
  { to: '/resources',           icon: Sparkles, label: 'Resources'   },
]

export function Sidebar() {
  const { currentUser } = useApp()

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly)  return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  })

  return (
    <aside
      className="hidden lg:flex flex-col w-52 h-screen sticky top-0 flex-shrink-0"
      style={{
        background: 'var(--orbital-sidebar-bg)',
        borderRight: '1px solid var(--orbital-sidebar-border)',
      }}
    >
      {/* ── App identity ── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--orbital-sidebar-border)' }}
      >
        <div>
          <span className="text-sm font-semibold tracking-tight text-orbital-text">
            Balance
          </span>
          <span className="text-xs text-orbital-subtle ml-1.5">
            / Orbital
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-indicator-pulse" />
          <span className="text-[10px] text-orbital-subtle">LIVE</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-1.5 overflow-y-auto">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-orbital-text bg-black/[0.06] dark:bg-white/[0.06]'
                  : 'text-orbital-subtle hover:text-orbital-text hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`
            }
            style={({ isActive }) => ({
              borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              paddingLeft: isActive ? 14 : 16,
            })}
          >
            <Icon size={14} className="flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Dev profile switcher (DEV ONLY) ── */}
      {/* Notifications + theme toggle + user panel + sign out moved to
          TopBar per Wilder's feedback — user profile + settings live
          top-right of the page on every viewport now. Sidebar's job is
          purely identity + nav. */}
      {import.meta.env.DEV && (
        <div
          className="px-3 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid var(--orbital-sidebar-border)' }}
        >
          <DevProfileSwitcher />
        </div>
      )}
    </aside>
  )
}
