import { Component, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppProvider } from './context/AppContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AppShell } from './components/layout/AppShell.jsx'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { ProductionsPage } from './pages/ProductionsPage.jsx'
import { ProductionDetailPage } from './pages/ProductionDetailPage.jsx'
import { TasksPage } from './pages/TasksPage.jsx'
import { ContractorsPage } from './features/contractors/ContractorsPage.jsx'

// Stale-chunk recovery: when we deploy a new build to Vercel, the chunk
// filenames change (Vite hashes them for cache-busting). A user with the
// previous HTML still loaded will try to fetch a chunk filename that no
// longer exists; Vercel falls back to index.html, and the browser refuses
// to execute HTML as a module → `Failed to fetch dynamically imported module`.
//
// This wrapper catches that specific failure, sets a one-shot sessionStorage
// flag, and forces a hard reload so the user lands on the new HTML with
// fresh chunk names. The flag prevents an infinite reload loop if reload
// somehow doesn't fix the problem.
const RELOAD_FLAG = 'balance_chunk_reload_at'
function lazyWithRetry(loader) {
  return lazy(() => loader().catch((err) => {
    const msg = err?.message || ''
    const looksLikeStaleChunk =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed')
    if (!looksLikeStaleChunk) throw err

    const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) || 0)
    const now = Date.now()
    // Only auto-reload once every 30s — otherwise an unrelated network blip
    // could trap the user in a refresh loop.
    if (now - lastReload < 30_000) throw err

    sessionStorage.setItem(RELOAD_FLAG, String(now))
    window.location.reload()
    // Return a never-resolving promise so React keeps the Suspense boundary
    // open while the reload completes.
    return new Promise(() => {})
  }))
}

// Heavy + role-gated routes lazy-loaded so they're not in the initial bundle:
//  - AnalyticsPage pulls in Recharts (~150kB gzipped, admin-only)
//  - SchedulePage pulls in the Gantt rendering paths (admin-flavoured)
//  - IntakePage will eventually pull in Whisper/Claude clients
//  - PrototypePage carries the Constellation/River SVG experiments
const AnalyticsPage  = lazyWithRetry(() => import('./pages/AnalyticsPage.jsx').then(m => ({ default: m.AnalyticsPage })))
const SchedulePage   = lazyWithRetry(() => import('./pages/SchedulePage.jsx').then(m => ({ default: m.SchedulePage })))
const IntakePage     = lazyWithRetry(() => import('./pages/IntakePage.jsx').then(m => ({ default: m.IntakePage })))
const PrototypePage  = lazyWithRetry(() => import('./pages/PrototypePage.jsx').then(m => ({ default: m.PrototypePage })))

// ── Per-page error boundary — keeps sidebar alive if one page crashes ─────────
class PageBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) {
    console.error('[PageBoundary] Caught render error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8">
          <p className="font-telemetry text-[9px] tracking-[0.2em] text-red-400">
            SYSTEM FAULT
          </p>
          <p className="text-orbital-subtle text-sm text-center max-w-md">
            This page encountered an unexpected error. The rest of the app is unaffected.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-secondary text-xs"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function wrap(el) {
  return (
    <PageBoundary>
      <Suspense fallback={<RouteLoading />}>{el}</Suspense>
    </PageBoundary>
  )
}

function RouteLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">
        LOADING
      </p>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard"         element={wrap(<DashboardPage />)} />
            <Route path="/productions"       element={wrap(<ProductionsPage />)} />
            <Route path="/productions/new"   element={wrap(<IntakePage />)} />
            <Route path="/productions/:id"   element={wrap(<ProductionDetailPage />)} />
            <Route path="/tasks"             element={wrap(<TasksPage />)} />
            <Route path="/schedule"          element={wrap(<SchedulePage />)} />
            <Route path="/analytics"         element={wrap(<AnalyticsPage />)} />
            <Route path="/contractors"       element={wrap(<ContractorsPage />)} />
            <Route path="/prototype/resources" element={wrap(<PrototypePage />)} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
