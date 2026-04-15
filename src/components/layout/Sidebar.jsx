import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Film, Calendar, BarChart3, Users, LogOut,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/productions', icon: Film,             label: 'Productions' },
  { to: '/schedule',    icon: Calendar,         label: 'Schedule'    },
  { to: '/contractors', icon: Users,            label: 'Contractors', adminOrSup: true },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics',   adminOnly: true  },
]

// ─── Role tag config ──────────────────────────────────────────────────────────
const ROLE_META = {
  admin:      { label: 'ADMIN',  color: 'text-sky-400',   dot: 'bg-sky-400'    },
  supervisor: { label: 'SUPVR',  color: 'text-amber-400', dot: 'bg-amber-400'  },
  crew:       { label: 'CREW',   color: 'text-green-400', dot: 'bg-green-400'  },
}

export function Sidebar() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly)   return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup)  return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  })

  const role = ROLE_META[currentUser?.role] || ROLE_META.crew

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 flex-shrink-0 scan-overlay"
      style={{
        background: 'linear-gradient(180deg, #060e1a 0%, #04090f 100%)',
        borderRight: '1px solid #112235',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.025), 4px 0 24px rgba(0,0,0,0.5)',
      }}
    >

      {/* ── Logo / System header ──────────────────────────────────────────── */}
      <div className="px-5 py-5 flex-shrink-0" style={{ borderBottom: '1px solid #112235' }}>
        {/* Corner accents */}
        <div className="absolute top-3 left-3 w-3 h-3 pointer-events-none"
          style={{ borderTop: '1px solid rgba(14,165,233,0.5)', borderLeft: '1px solid rgba(14,165,233,0.5)' }} />
        <div className="absolute top-3 right-3 w-3 h-3 pointer-events-none"
          style={{ borderTop: '1px solid rgba(14,165,233,0.3)', borderRight: '1px solid rgba(14,165,233,0.3)' }} />

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight"
                style={{ color: '#cdd8e8', letterSpacing: '-0.01em' }}>
                BALANCE
              </span>
            </div>
            <p className="font-telemetry text-[9px] tracking-[0.22em] mt-0.5"
               style={{ color: '#7090a8' }}>
              ORBITAL STUDIOS
            </p>
          </div>
          {/* System status indicator */}
          <div className="flex flex-col items-end gap-1 mt-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-indicator-pulse" />
              <span className="font-telemetry text-[8px] text-green-400 tracking-[0.15em]">ONLINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {/* Section label */}
        <p className="px-3 mb-2 font-telemetry text-[8px] tracking-[0.2em]"
           style={{ color: '#4d6a82' }}>
          NAVIGATION
        </p>

        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all group',
              isActive
                ? 'text-sky-300'
                : 'text-orbital-subtle hover:text-orbital-text'
            )}
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(90deg, rgba(14,165,233,0.1) 0%, transparent 100%)',
              borderLeft: '2px solid rgba(14,165,233,0.7)',
              boxShadow: 'inset 0 0 20px rgba(14,165,233,0.04)',
            } : {
              borderLeft: '2px solid transparent',
            }}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span style={{ letterSpacing: '0.02em' }}>{label}</span>

            {/* Hover right-edge gleam */}
            <span className="absolute right-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.04), transparent)' }} />
          </NavLink>
        ))}
      </nav>

      {/* ── User panel ───────────────────────────────────────────────────── */}
      <div className="px-2 py-3 flex-shrink-0" style={{ borderTop: '1px solid #112235' }}>
        {/* User chip */}
        <div className="px-3 py-2.5 mb-1"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
            border: '1px solid #1a3050',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar — chrome ring */}
            <div className="relative flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                style={{ backgroundColor: currentUser?.color, boxShadow: `0 0 0 1px ${currentUser?.color}44` }}
              >
                {currentUser?.avatar}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2"
                style={{ borderColor: '#060e1a' }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orbital-text truncate leading-tight">
                {currentUser?.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1 h-1 rounded-full ${role.dot}`} />
                <span className={`font-telemetry text-[9px] tracking-[0.15em] ${role.color}`}>
                  {role.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-all group"
          style={{ color: '#7090a8' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7090a8' }}
        >
          <LogOut size={14} />
          <span style={{ letterSpacing: '0.02em' }}>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
