import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Film, Calendar, CheckSquare, Sparkles, ListChecks,
  Briefcase, Menu, X, User,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { usePipeline } from '../../features/pipeline/PipelineContext.jsx'
import { ROLES } from '../../data/models.js'
import { NAV_SECTIONS } from './Sidebar.jsx'

// Mobile bottom nav (Danny's mobile rework, step 1): a horizontally
// SCROLLABLE bar of the most-used pages, with a pinned hamburger at the end
// that opens a full menu of every page (same sections + role gating as the
// desktop sidebar, so nothing is desktop-only anymore).
const BAR_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Home'      },
  { to: '/tasks',       icon: CheckSquare,     label: 'Tasks'     },
  { to: '/productions', icon: Film,            label: 'Jobs'      },
  { to: '/pipeline',    icon: Briefcase,       label: 'Deals',    pipeline: true },
  { to: '/schedule',    icon: Calendar,        label: 'Schedule'  },
  { to: '/todos',       icon: ListChecks,      label: 'To-Dos'    },
  { to: '/resources',   icon: Sparkles,        label: 'Resources' },
]

export function MobileNav() {
  const { currentUser } = useApp()
  const { pipelineRole, isAdmin: isPipelineAdmin } = usePipeline()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the sheet whenever navigation happens.
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const canSee = (item) => {
    if (item.pipelineAdmin) return isPipelineAdmin
    if (item.pipeline)      return pipelineRole != null
    if (item.adminOnly)  return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  }

  const barItems = BAR_ITEMS.filter(canSee)
  const menuSections = NAV_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(canSee) }))
    .filter(s => s.items.length > 0)

  return (
    <>
      {/* ── Full menu sheet — every page, role-aware ── */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <button
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <div
            className="relative mt-auto max-h-[80vh] overflow-y-auto rounded-t-2xl px-4 pt-4"
            style={{
              background: 'var(--orbital-surface)',
              borderTop: '1px solid var(--orbital-border)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="hud-label">ALL PAGES</p>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 -mr-2 text-orbital-subtle hover:text-orbital-text"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {menuSections.map((section, si) => (
              <div key={section.title || `s${si}`} className="mb-3">
                {section.title && (
                  <p className="mb-1.5 font-telemetry text-[9px] tracking-[0.22em] text-orbital-dim uppercase select-none">
                    {section.title}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-lg border transition-colors text-center"
                      style={({ isActive }) => ({
                        color: isActive ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
                        borderColor: isActive ? '#3b82f6' : 'var(--orbital-border)',
                        background: isActive ? 'rgba(59,130,246,0.08)' : 'var(--orbital-bg)',
                      })}
                    >
                      <Icon size={18} />
                      <span className="text-[11px] font-medium leading-tight">{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            {/* Account — lives in the TopBar menu on desktop; surfaced here */}
            <div className="mb-1">
              <NavLink
                to="/account"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[12px] font-medium"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
                  borderColor: 'var(--orbital-border)',
                  background: 'var(--orbital-bg)',
                })}
              >
                <User size={15} /> Account
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar — scrollable items + pinned hamburger ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'var(--orbital-sidebar-bg)',
          borderTop: '1px solid var(--orbital-sidebar-border)',
        }}
      >
        <div
          className="flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex-1 flex items-stretch overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {barItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center justify-center py-3 gap-1 transition-colors flex-shrink-0"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
                  borderTop: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  minWidth: 72,
                })}
              >
                <Icon size={19} />
                <span className="text-[11px] font-medium whitespace-nowrap px-1">{label}</span>
              </NavLink>
            ))}
          </div>
          {/* Hamburger — pinned at the end, opens the everything-menu */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex flex-col items-center justify-center py-3 gap-1 flex-shrink-0"
            style={{
              color: menuOpen ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
              borderTop: '2px solid transparent',
              borderLeft: '1px solid var(--orbital-sidebar-border)',
              minWidth: 64,
            }}
            aria-label="All pages"
            aria-expanded={menuOpen}
          >
            <Menu size={19} />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
