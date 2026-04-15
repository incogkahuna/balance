import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import { AppShell } from './components/layout/AppShell.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { ProductionsPage } from './pages/ProductionsPage.jsx'
import { ProductionDetailPage } from './pages/ProductionDetailPage.jsx'
import { SchedulePage } from './pages/SchedulePage.jsx'
import { AnalyticsPage } from './pages/AnalyticsPage.jsx'
import { TasksPage } from './pages/TasksPage.jsx'
import { ContractorsPage } from './features/contractors/ContractorsPage.jsx'
import { IntakePage } from './pages/IntakePage.jsx'

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
  return <PageBoundary>{el}</PageBoundary>
}

export default function App() {
  return (
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
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
