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

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/productions" element={<ProductionsPage />} />
            <Route path="/productions/:id" element={<ProductionDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
