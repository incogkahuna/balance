import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// NavHistoryContext — tracks the path the user actually took through Balance,
// not just URL hierarchy. Powers the breadcrumb strip at the top of every
// page so anyone can hop back to where they came from.
//
// Per Wilder's ask: "if you click dashboard then on a production in the top
// corner there is a page path that lets you select if you want to go back".
//
// Behaviour:
//   - On every route change, if the new path is already in the trail, we
//     truncate to it (user navigated backward via a crumb or back button).
//   - Otherwise we append. Capped at TRAIL_MAX so it doesn't grow forever.
//   - In-memory only. A hard refresh resets the trail — that's fine; the
//     visible crumbs are a UX aid, not state worth persisting through
//     reloads (it'd be misleading to show a stale trail anyway).
// ─────────────────────────────────────────────────────────────────────────────

const TRAIL_MAX = 5

const NavHistoryContext = createContext(null)

export function NavHistoryProvider({ children }) {
  // Each entry: just the pathname string. We resolve labels at render time
  // in the Breadcrumbs component (so a production's name updates if it's
  // renamed while we're sitting on it).
  const [trail, setTrail] = useState([])
  const location = useLocation()

  // Use a ref to compare against the prior path without making the effect
  // depend on trail state (which would cause re-runs).
  const lastPathRef = useRef(null)

  useEffect(() => {
    const path = location.pathname
    if (path === lastPathRef.current) return
    lastPathRef.current = path

    setTrail((prev) => {
      const existingIdx = prev.indexOf(path)
      if (existingIdx >= 0) {
        // User went back via a crumb / browser back. Truncate to that point.
        return prev.slice(0, existingIdx + 1)
      }
      // New page — append, capped at TRAIL_MAX (drop oldest).
      const next = [...prev, path]
      return next.length > TRAIL_MAX ? next.slice(next.length - TRAIL_MAX) : next
    })
  }, [location.pathname])

  return (
    <NavHistoryContext.Provider value={{ trail }}>
      {children}
    </NavHistoryContext.Provider>
  )
}

export function useNavHistory() {
  const ctx = useContext(NavHistoryContext)
  if (!ctx) throw new Error('useNavHistory must be used inside NavHistoryProvider')
  return ctx
}
