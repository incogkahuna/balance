import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Film, Calendar, BarChart3, Users, UserSquare2, Sparkles, Rocket, Monitor, Bug, CheckSquare, Briefcase, BookUser, TrendingUp, Receipt } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { usePipeline } from '../../features/pipeline/PipelineContext.jsx'
import { ROLES } from '../../data/models.js'
import { DevProfileSwitcher } from '../dev/DevProfileSwitcher.jsx'
import { OrbitalMark } from '../brand/OrbitalLogo.jsx'

// Nav grouped into labelled sections — 12 flat items had become a wall.
// Sections render as a tiny telemetry header + their items. Role gates
// (adminOnly / adminOrSup) unchanged.
// NOTE: Tasks was previously missing from the desktop sidebar entirely
// (only reachable via mobile nav + dashboard stat links) — restored here.
// Exported: MobileNav's hamburger sheet renders the same sections with the
// same role gating, so the two navs can't drift apart.
export const NAV_SECTIONS = [
  {
    title: null,   // top block, no header
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
    ],
  },
  {
    title: 'Work',
    items: [
      { to: '/productions', icon: Film,        label: 'Productions' },
      // To-Dos merged into Tasks (internal scope) — one surface, the
      // distribution difference is just production vs no-production.
      { to: '/tasks',       icon: CheckSquare, label: 'Tasks'       },
      { to: '/schedule',    icon: Calendar,    label: 'Schedule'    },
      { to: '/resources',   icon: Sparkles,    label: 'Resources'   },
    ],
  },
  {
    // The job pipeline (#18) — visible only to the four pipeline roles;
    // clients/analytics render role-scoped data, rate card is admin-only.
    title: 'Pipeline',
    items: [
      { to: '/pipeline',           icon: Briefcase, label: 'Deals',        pipeline: true },
      { to: '/pipeline/clients',   icon: BookUser,  label: 'Clients',      pipeline: true },
      { to: '/pipeline/analytics', icon: TrendingUp, label: 'Deal Analytics', pipeline: true },
      { to: '/pipeline/ratecard',  icon: Receipt,   label: 'Rate Card',    pipelineAdmin: true },
    ],
  },
  {
    title: 'People & Gear',
    items: [
      { to: '/team',        icon: UserSquare2, label: 'Team'        },
      { to: '/contractors', icon: Users,       label: 'Contractors', adminOrSup: true },
      { to: '/gear',        icon: Monitor,     label: 'Gear',        adminOrSup: true },
    ],
  },
  {
    title: 'Studio',
    items: [
      { to: '/analytics',   icon: BarChart3,   label: 'Analytics',   adminOnly: true },
      { to: '/coming-soon', icon: Rocket,      label: 'Roadmap'      },
      { to: '/feedback',    icon: Bug,         label: 'Bugs & Ideas' },
    ],
  },
]

export function Sidebar() {
  const { currentUser } = useApp()
  const { pipelineRole, isAdmin: isPipelineAdmin } = usePipeline()

  const canSee = (item) => {
    if (item.pipelineAdmin) return isPipelineAdmin
    if (item.pipeline)      return pipelineRole != null
    if (item.adminOnly)  return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  }
  // Drop sections whose items are all role-gated away so crew don't see
  // orphaned headers.
  const visibleSections = NAV_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(canSee) }))
    .filter(s => s.items.length > 0)

  return (
    <aside
      className="hidden lg:flex flex-col w-52 h-screen sticky top-0 flex-shrink-0"
      style={{
        background: 'var(--orbital-sidebar-bg)',
        borderRight: '1px solid var(--orbital-sidebar-border)',
      }}
    >
      {/* ── App identity — the Orbital emblem anchors the whole chrome ── */}
      <div
        className="flex items-center justify-between pl-4 pr-3 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--orbital-sidebar-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <OrbitalMark size={22} />
          <div className="flex flex-col min-w-0">
            <span
              className="text-[13px] font-semibold text-orbital-text leading-none"
              style={{ letterSpacing: '0.24em', marginRight: '-0.24em' }}
            >
              BALANCE
            </span>
            <span
              className="text-[8px] text-orbital-subtle leading-none mt-1 font-telemetry"
              style={{ letterSpacing: '0.32em', marginRight: '-0.32em' }}
            >
              ORBITAL STUDIOS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-indicator-pulse" />
          <span className="text-[10px] text-orbital-subtle font-telemetry">LIVE</span>
        </div>
      </div>

      {/* ── Navigation — grouped sections with telemetry headers ── */}
      <nav className="flex-1 py-1.5 overflow-y-auto">
        {visibleSections.map((section, si) => (
          <div key={section.title || `s${si}`} className={si > 0 ? 'mt-3' : ''}>
            {section.title && (
              <p className="px-4 mb-1 font-telemetry text-[9px] tracking-[0.22em] text-orbital-dim uppercase select-none">
                {section.title}
              </p>
            )}
            {section.items.map(({ to, icon: Icon, label }) => (
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
          </div>
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
