import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { USERS, ROLES, PRODUCTION_STATUS } from '../data/models.js'
import { TopBar } from '../components/layout/TopBar.jsx'
import { Navigate } from 'react-router-dom'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']

export function AnalyticsPage() {
  const { currentUser, productions, tasks } = useApp()
  const navigate = useNavigate()

  // Admin only
  if (currentUser?.role !== ROLES.ADMIN) {
    return <Navigate to="/dashboard" replace />
  }

  // ─── Productions per month (last 6 months) ───────────────────────────────
  const productionsPerMonth = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i))
    return months.map(month => {
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const count = productions.filter(p => {
        if (!p.startDate) return false
        const d = parseISO(p.startDate)
        return isWithinInterval(d, { start, end })
      }).length
      return { month: format(month, 'MMM'), count }
    })
  }, [productions])

  // ─── Task completion by person ────────────────────────────────────────────
  const tasksByPerson = useMemo(() => {
    return USERS.map(user => {
      const assigned = tasks.filter(t => t.assigneeId === user.id)
      const completed = assigned.filter(t => t.verifiedComplete).length
      const pending = assigned.filter(t => !t.verifiedComplete).length
      const rate = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0
      return { name: user.name, completed, pending, total: assigned.length, rate }
    }).filter(p => p.total > 0)
  }, [tasks])

  // ─── Production status breakdown ─────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const counts = {}
    productions.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1
    })
    return Object.entries(counts).map(([status, count]) => ({ status, count }))
  }, [productions])

  // ─── Top equipment (add-ons) ──────────────────────────────────────────────
  const topEquipment = useMemo(() => {
    const counts = {}
    productions.forEach(p => {
      (p.addons || []).forEach(a => {
        const key = a.equipment
        counts[key] = (counts[key] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))
  }, [productions])

  // ─── Damage incidents ─────────────────────────────────────────────────────
  const damageIncidents = useMemo(() => {
    return productions.flatMap(p =>
      (p.addons || [])
        .filter(a => a.damaged)
        .map(a => ({ ...a, productionName: p.name }))
    )
  }, [productions])

  // ─── Summary stats ────────────────────────────────────────────────────────
  const totalProductions = productions.length
  const completedProductions = productions.filter(p => p.status === PRODUCTION_STATUS.COMPLETED).length
  const totalTasks = tasks.length
  const verifiedTasks = tasks.filter(t => t.verifiedComplete).length
  const avgRating = useMemo(() => {
    const rated = productions.filter(p => p.feedback?.rating)
    if (rated.length === 0) return null
    return (rated.reduce((sum, p) => sum + p.feedback.rating, 0) / rated.length).toFixed(1)
  }, [productions])

  const customTooltipStyle = {
    backgroundColor: '#161a1f',
    border: '1px solid #232830',
    borderRadius: 8,
    color: '#e8eaf0',
    fontSize: 12,
  }

  return (
    <div>
      <TopBar />
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <h1 className="text-xl font-bold text-orbital-text mb-6">Analytics</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <SummaryCard label="Total Productions" value={totalProductions} />
          <SummaryCard label="Completed" value={completedProductions} sub={`of ${totalProductions}`} />
          <SummaryCard label="Tasks Verified" value={verifiedTasks} sub={`of ${totalTasks}`} />
          <SummaryCard label="Avg Rating" value={avgRating ? `${avgRating}/5` : '—'} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Productions per month */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-4">Productions per Month</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={productionsPerMonth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fill: '#8b92a4', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b92a4', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: '#232830' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Productions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status breakdown */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-4">Production Status</h3>
            {statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                  >
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={entry.status} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend
                    formatter={(value) => <span style={{ color: '#8b92a4', fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-orbital-subtle text-sm text-center py-8">No data.</p>
            )}
          </div>

          {/* Task completion by person */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-4">Task Completion by Person</h3>
            {tasksByPerson.length > 0 ? (
              <div className="space-y-3">
                {tasksByPerson.map(person => (
                  <div key={person.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-orbital-text">{person.name}</span>
                      <span className="text-xs text-orbital-subtle">{person.completed}/{person.total} ({person.rate}%)</span>
                    </div>
                    <div className="w-full h-2 bg-orbital-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${person.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-orbital-subtle text-sm text-center py-8">No task data.</p>
            )}
          </div>

          {/* Top equipment */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-4">Most Used Equipment</h3>
            {topEquipment.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topEquipment} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#8b92a4', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8b92a4', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: '#232830' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Uses" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-orbital-subtle text-sm text-center py-8">No equipment data.</p>
            )}
          </div>
        </div>

        {/* Damage incidents */}
        {damageIncidents.length > 0 && (
          <div className="card p-5 mt-6">
            <h3 className="font-semibold text-orbital-text mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Damage Incidents ({damageIncidents.length})
            </h3>
            <div className="space-y-2">
              {damageIncidents.map(incident => (
                <div key={incident.id} className="flex items-center justify-between py-2 border-b border-orbital-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-orbital-text">{incident.equipment}</p>
                    <p className="text-xs text-orbital-subtle">{incident.productionName}</p>
                  </div>
                  <div className="text-right">
                    {incident.cost && <p className="text-xs text-red-400">${incident.cost}</p>}
                    <p className="text-xs text-orbital-subtle">{format(parseISO(incident.loggedAt), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-orbital-text">{value}</p>
      {sub && <p className="text-xs text-orbital-subtle">{sub}</p>}
      <p className="text-xs text-orbital-subtle mt-1">{label}</p>
    </div>
  )
}
