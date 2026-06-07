import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useNavHistory } from '../../context/NavHistoryContext.jsx'
import { useApp } from '../../context/AppContext.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumbs — page-path strip rendered above every page's content.
//
// Reads the actual navigation trail (not URL hierarchy) so the path matches
// where the user came from. Last crumb = current page (not clickable).
// Hidden when there's only one entry — a single non-clickable label is just
// noise.
// ─────────────────────────────────────────────────────────────────────────────

// Labels for known static routes. Anything not in here falls back to a
// title-cased URL segment (e.g. /coming-soon → "Coming Soon").
const STATIC_LABELS = {
  '/dashboard':       'Home',
  '/productions':     'Productions',
  '/productions/new': 'New Production',
  '/tasks':           'Tasks',
  '/schedule':        'Schedule',
  '/team':            'Team',
  '/contractors':     'Contractors',
  '/analytics':       'Analytics',
  '/coming-soon':     'Coming Soon',
  '/resources':       'Resources',
  '/gear':            'Gear',
}

function titleCase(s) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function deriveLabel(path, { productions }) {
  // Exact match on static map first.
  if (STATIC_LABELS[path]) return STATIC_LABELS[path]

  // Production detail: /productions/<uuid> → that production's name
  const prodMatch = path.match(/^\/productions\/([0-9a-f-]{8,})$/i)
  if (prodMatch) {
    const prod = productions?.find?.((p) => p.id === prodMatch[1])
    return prod?.name || 'Production'
  }

  // Generic fallback — last segment, prettified.
  const last = path.split('/').filter(Boolean).pop() || 'Home'
  return titleCase(last)
}

export function Breadcrumbs() {
  const { trail } = useNavHistory()
  const { productions } = useApp()

  // Single-entry trail = just the current page, no crumb to show
  if (!trail || trail.length < 2) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="px-3 sm:px-6 py-1.5 flex items-center gap-1 overflow-x-auto text-xs"
      style={{
        background: 'var(--orbital-bg)',
        borderBottom: '1px solid var(--orbital-border)',
      }}
    >
      {trail.map((path, i) => {
        const isLast = i === trail.length - 1
        const label  = deriveLabel(path, { productions })
        const isHome = path === '/dashboard'

        return (
          <span key={`${path}-${i}`} className="flex items-center gap-1 whitespace-nowrap">
            {i > 0 && (
              <ChevronRight size={11} className="text-orbital-dim flex-shrink-0" />
            )}
            {isLast ? (
              <span className="text-orbital-text font-medium inline-flex items-center gap-1">
                {isHome && <Home size={11} className="text-orbital-subtle" />}
                {label}
              </span>
            ) : (
              <Link
                to={path}
                className="text-orbital-subtle hover:text-orbital-text transition-colors inline-flex items-center gap-1"
              >
                {isHome && <Home size={11} />}
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
