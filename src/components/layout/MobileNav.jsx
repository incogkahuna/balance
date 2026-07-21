import { useState, useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, X, User, Check, Settings2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { usePipeline } from '../../features/pipeline/PipelineContext.jsx'
import { ROLES } from '../../data/models.js'
import { NAV_SECTIONS } from './Sidebar.jsx'

// Mobile bottom nav: a horizontally SCROLLABLE bar of the user's chosen
// pages, with a pinned hamburger at the end opening a full menu of every
// page (same sections + role gating as the desktop sidebar). The bar is
// CUSTOMIZABLE (Danny's request): "Customize bar" in the More sheet lets
// each user tap pages in/out; the picks persist per browser.

// Short labels for bar real estate where the sidebar name is long.
const BAR_LABELS = {
  '/dashboard': 'Home',
  '/productions': 'Jobs',
  '/pipeline': 'Deals',
  '/pipeline/analytics': 'Analytics',
  '/pipeline/ratecard': 'Rates',
  '/coming-soon': 'Roadmap',
  '/feedback': 'Bugs',
}

const DEFAULT_BAR = ['/dashboard', '/tasks', '/productions', '/pipeline', '/schedule', '/todos', '/resources']
const BAR_KEY = 'balance_mobile_bar_v1'

export function MobileNav() {
  const { currentUser } = useApp()
  const { pipelineRole, isAdmin: isPipelineAdmin } = usePipeline()
  const [menuOpen, setMenuOpen] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const location = useLocation()

  // ── User's bar picks (ordered paths, persisted per browser) ────────────────
  const [barPaths, setBarPaths] = useState(() => {
    try {
      const raw = localStorage.getItem(BAR_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch { /* ignore */ }
    return DEFAULT_BAR
  })
  useEffect(() => {
    try { localStorage.setItem(BAR_KEY, JSON.stringify(barPaths)) } catch { /* quota */ }
  }, [barPaths])

  const toggleBarPath = (to) => setBarPaths(prev => {
    if (prev.includes(to)) {
      // Keep at least one page in the bar.
      return prev.length > 1 ? prev.filter(p => p !== to) : prev
    }
    return [...prev, to]
  })

  // Close the sheet (and customize mode) whenever navigation happens.
  useEffect(() => { setMenuOpen(false); setCustomizing(false) }, [location.pathname])

  const canSee = (item) => {
    if (item.pipelineAdmin) return isPipelineAdmin
    if (item.pipeline)      return pipelineRole != null
    if (item.adminOnly)  return currentUser?.role === ROLES.ADMIN
    if (item.adminOrSup) return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
    return true
  }

  // Master registry of every page (sidebar sections + Account), keyed by path.
  const registry = useMemo(() => {
    const map = new Map()
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) map.set(item.to, item)
    }
    map.set('/account', { to: '/account', icon: User, label: 'Account' })
    return map
  }, [])

  const barItems = barPaths
    .map(to => registry.get(to))
    .filter(Boolean)
    .filter(canSee)
    .map(item => ({ ...item, label: BAR_LABELS[item.to] || item.label }))

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
            onClick={() => { setMenuOpen(false); setCustomizing(false) }}
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
              <p className="hud-label">{customizing ? 'CUSTOMIZE BAR' : 'ALL PAGES'}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCustomizing(c => !c)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded transition-colors ${
                    customizing ? 'text-blue-400' : 'text-orbital-subtle hover:text-orbital-text'
                  }`}
                  aria-pressed={customizing}
                >
                  <Settings2 size={14} />
                  {customizing ? 'Done' : 'Customize bar'}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setCustomizing(false) }}
                  className="p-2 -mr-2 text-orbital-subtle hover:text-orbital-text"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {customizing && (
              <p className="text-[11px] text-orbital-subtle mb-2">
                Tap pages to add or remove them from your bottom bar. Order follows when you added them.
              </p>
            )}
            {menuSections.map((section, si) => (
              <div key={section.title || `s${si}`} className="mb-3">
                {section.title && (
                  <p className="mb-1.5 font-telemetry text-[9px] tracking-[0.22em] text-orbital-dim uppercase select-none">
                    {section.title}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map(({ to, icon: Icon, label }) => {
                    const inBar = barPaths.includes(to)
                    // Customize mode: tiles toggle bar membership instead of navigating.
                    if (customizing) {
                      return (
                        <button
                          key={to}
                          onClick={() => toggleBarPath(to)}
                          className="relative flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-lg border transition-colors text-center"
                          style={{
                            color: inBar ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
                            borderColor: inBar ? '#3b82f6' : 'var(--orbital-border)',
                            background: inBar ? 'rgba(59,130,246,0.1)' : 'var(--orbital-bg)',
                          }}
                          aria-pressed={inBar}
                        >
                          {inBar && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check size={11} className="text-white" />
                            </span>
                          )}
                          <Icon size={18} />
                          <span className="text-[11px] font-medium leading-tight">{label}</span>
                        </button>
                      )
                    }
                    return (
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
                    )
                  })}
                </div>
              </div>
            ))}
            {/* Account — lives in the TopBar menu on desktop; surfaced here */}
            <div className="mb-1">
              {customizing ? (
                <button
                  onClick={() => toggleBarPath('/account')}
                  className="relative w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[12px] font-medium"
                  style={{
                    color: barPaths.includes('/account') ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
                    borderColor: barPaths.includes('/account') ? '#3b82f6' : 'var(--orbital-border)',
                    background: barPaths.includes('/account') ? 'rgba(59,130,246,0.1)' : 'var(--orbital-bg)',
                  }}
                  aria-pressed={barPaths.includes('/account')}
                >
                  <User size={15} /> Account
                  {barPaths.includes('/account') && <Check size={13} className="text-blue-400" />}
                </button>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar — scrollable chosen items + pinned hamburger ── */}
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
