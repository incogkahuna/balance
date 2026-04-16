import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Film, Calendar, BarChart3, Users, LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/productions', icon: Film,             label: 'Productions' },
  { to: '/schedule',    icon: Calendar,         label: 'Schedule'    },
  { to: '/contractors', icon: Users,            label: 'Contractors', adminOrSup: true },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics',   adminOnly: true  },
]

const ROLE_LABEL = {
  admin:      'Administrator',
  supervisor: 'Supervisor',
  crew:       'Crew Member',
}

export function Sidebar() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly)  return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  })

  return (
    <aside
      className="hidden lg:flex flex-col w-52 h-screen sticky top-0 flex-shrink-0"
      style={{
        background: '#111214',
        borderRight: '1px solid #22232a',
      }}
    >
      {/* ── App identity ── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #22232a' }}
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
                  ? 'text-white bg-white/[0.06]'
                  : 'text-orbital-subtle hover:text-orbital-text hover:bg-white/[0.03]'
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

      {/* ── User panel ── */}
      <div
        className="flex-shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid #22232a' }}
      >
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: currentUser?.color }}
          >
            {currentUser?.avatar}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-orbital-text truncate leading-tight">
              {currentUser?.name}
            </p>
            <p className="text-[10px] text-orbital-subtle leading-none mt-0.5">
              {ROLE_LABEL[currentUser?.role] || 'Crew'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="w-full flex items-center gap-2 px-1 py-1.5 text-xs text-orbital-subtle transition-colors hover:text-orbital-text"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
