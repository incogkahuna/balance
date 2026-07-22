import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext.jsx'
import { parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval, subDays, startOfWeek, formatDistanceToNow } from 'date-fns'
import { format } from '../lib/safeFormat.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, PRODUCTION_STATUS } from '../data/models.js'
import { isTaskDone, isTaskVerified } from '../features/tasks/taskStatusConfig.js'
import { Navigate } from 'react-router-dom'
import { listActivityEvents } from '../lib/data/activity.ts'

const CHART_COLORS = ['#3ba8e0', '#22c55e', '#f59e0b', '#55c9ef', '#ef4444']
const WINDOWS = [
  { days: 7,  label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
]

// Human sentence for one activity event — no fake data, just what happened.
function describeEvent(e) {
  const label = e.entityLabel ? `“${e.entityLabel}”` : `a ${e.entityType}`
  switch (e.verb) {
    case 'created':        return `created ${e.entityType} ${label}`
    case 'completed':      return `completed task ${label}`
    case 'status_changed': return e.meta?.auto
      ? `auto-advanced ${e.entityType} ${label} to ${e.meta?.to || '?'}`
      : `moved ${e.entityType} ${label} to ${e.meta?.to || '?'}`
    case 'assigned':       return `assigned ${label}${e.meta?.assigneeName ? ` to ${e.meta.assigneeName}` : ''}`
    case 'commented':      return `commented on ${label}`
    case 'deleted':        return `deleted ${e.entityType} ${label}`
    default:               return `${e.verb} ${label}`
  }
}

export function AnalyticsPage() {
  const { currentUser, productions, tasks, resolveUserName } = useApp()
  const { theme } = useTheme()

  // Chart colors that flip per theme
  const axisTickColor  = theme === 'dark' ? '#6e6f78' : '#6b7280'
  const cursorFillColor = theme === 'dark' ? '#27282e' : '#e5e7eb'
  const legendTextColor = theme === 'dark' ? '#6e6f78' : '#6b7280'

  // NOTE: the admin-only redirect lives BELOW the hooks (just before the JSX
  // return). An early return here would change the hook count when the role
  // changes mid-session — a Rules of Hooks violation that can crash React.

  // ─── Activity events (M1 — the real participation data) ──────────────────
  // Fetched once (90-day window), filtered client-side by the selector.
  // 'unavailable' = table missing (migration not run) or fetch failed — the
  // page renders honest empty states rather than fabricating numbers.
  const [events, setEvents] = useState([])
  const [eventsState, setEventsState] = useState('loading') // loading | ready | unavailable
  const [windowDays, setWindowDays] = useState(30)

  useEffect(() => {
    let cancelled = false
    listActivityEvents({ sinceDays: 90 })
      .then(rows => { if (!cancelled) { setEvents(rows); setEventsState('ready') } })
      .catch(() => { if (!cancelled) setEventsState('unavailable') })
    return () => { cancelled = true }
  }, [])

  const windowedEvents = useMemo(() => {
    const cutoff = subDays(new Date(), windowDays)
    return events.filter(e => new Date(e.createdAt) >= cutoff)
  }, [events, windowDays])

  // ─── Per-person participation (from real events) ──────────────────────────
  const participation = useMemo(() => {
    const byActor = new Map()
    for (const e of windowedEvents) {
      const key = e.actorId || e.actorName || 'unknown'
      if (!byActor.has(key)) {
        byActor.set(key, {
          name: e.actorName || resolveUserName(e.actorId) || 'Unknown',
          created: 0, completed: 0, comments: 0, moves: 0, total: 0,
        })
      }
      const row = byActor.get(key)
      row.total += 1
      if (e.verb === 'created') row.created += 1
      else if (e.verb === 'completed') row.completed += 1
      else if (e.verb === 'commented') row.comments += 1
      else if (e.verb === 'status_changed' || e.verb === 'assigned') row.moves += 1
    }
    return [...byActor.values()].sort((a, b) => b.total - a.total)
  }, [windowedEvents, resolveUserName])

  // ─── Task flow by week (assigned vs completed) ────────────────────────────
  const taskFlow = useMemo(() => {
    const weeks = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const start = startOfWeek(subDays(now, i * 7), { weekStartsOn: 1 })
      weeks.push({ start, label: format(start, 'MMM d'), assigned: 0, completed: 0 })
    }
    for (const e of events) {
      if (e.entityType !== 'task') continue
      const t = new Date(e.createdAt)
      const wk = weeks.findLast
        ? weeks.findLast(w => t >= w.start)
        : [...weeks].reverse().find(w => t >= w.start)
      if (!wk) continue
      if (e.verb === 'assigned') wk.assigned += 1
      if (e.verb === 'completed') wk.completed += 1
    }
    return weeks.map(({ label, assigned, completed }) => ({ label, assigned, completed }))
  }, [events])

  const hasFlowData = taskFlow.some(w => w.assigned > 0 || w.completed > 0)

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

  // ─── Task completion by person — REAL roster ──────────────────────────────
  // Derived from actual assignees on actual tasks (profiles, contractors,
  // legacy ids all resolve through resolveUserName) — not a hardcoded list.
  const tasksByPerson = useMemo(() => {
    const ids = [...new Set(tasks.map(t => t.assigneeId).filter(Boolean))]
    return ids
      .map(id => {
        const assigned = tasks.filter(t => t.assigneeId === id)
        const completed = assigned.filter(isTaskDone).length
        const rate = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0
        return {
          name: resolveUserName(id) || 'Unknown',
          completed, pending: assigned.length - completed, total: assigned.length, rate,
        }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [tasks, resolveUserName])

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
  const verifiedTasks = tasks.filter(isTaskVerified).length
  const avgRating = useMemo(() => {
    const rated = productions.filter(p => p.feedback?.rating)
    if (rated.length === 0) return null
    return (rated.reduce((sum, p) => sum + p.feedback.rating, 0) / rated.length).toFixed(1)
  }, [productions])

  const customTooltipStyle = {
    backgroundColor: 'var(--orbital-panel)',
    border: '1px solid var(--orbital-border)',
    borderRadius: 2,
    color: 'var(--orbital-text)',
    fontSize: 12,
  }

  // Admin only — after every hook has run (see note above).
  if (currentUser?.role !== ROLES.ADMIN) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="hud-label mb-1">STUDIO METRICS</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">Analytics</h1>
          </div>
          {/* Activity window selector */}
          <div className="flex border border-orbital-border">
            {WINDOWS.map(w => (
              <button
                key={w.days}
                onClick={() => setWindowDays(w.days)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={windowDays === w.days
                  ? { background: 'var(--accent-soft)', color: 'var(--accent-bright)' }
                  : { color: 'var(--orbital-subtle)' }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          <SummaryCard label="Total Productions" value={totalProductions} />
          <SummaryCard label="Completed" value={completedProductions} sub={`of ${totalProductions}`} />
          <SummaryCard label="Tasks Verified" value={verifiedTasks} sub={`of ${totalTasks}`} />
          <SummaryCard label="Avg Rating" value={avgRating ? `${avgRating}/5` : '—'} />
          <SummaryCard
            label={`Actions (${windowDays}d)`}
            value={eventsState === 'ready' ? windowedEvents.length : '—'}
          />
        </div>

        {/* ─── Team activity — the real who-did-what (M1 / #12) ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-1">Team Activity</h3>
            <p className="text-xs text-orbital-subtle mb-4">Logged actions in the last {windowDays} days</p>
            {eventsState === 'ready' && participation.length > 0 ? (
              <div className="space-y-4">
                {participation.map(p => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-orbital-text">{p.name}</span>
                      <span className="text-xs text-orbital-subtle">{p.total} actions</span>
                    </div>
                    <div className="flex h-2 w-full bg-orbital-muted rounded-full overflow-hidden">
                      {[
                        { n: p.created,   c: '#3ba8e0' },
                        { n: p.completed, c: '#22c55e' },
                        { n: p.comments,  c: '#f59e0b' },
                        { n: p.moves,     c: '#55c9ef' },
                      ].map((seg, i) => seg.n > 0 && (
                        <div key={i} style={{ width: `${(seg.n / p.total) * 100}%`, background: seg.c }} />
                      ))}
                    </div>
                    <p className="text-[11px] text-orbital-subtle mt-1">
                      {p.created} created · {p.completed} completed · {p.comments} comments · {p.moves} moves
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <ActivityEmptyState state={eventsState} />
            )}
          </div>

          {/* Activity feed */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-1">Recent Activity</h3>
            <p className="text-xs text-orbital-subtle mb-4">Newest first</p>
            {eventsState === 'ready' && windowedEvents.length > 0 ? (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {windowedEvents.slice(0, 40).map(e => (
                  <div key={e.id} className="flex items-baseline gap-2 text-sm border-b border-orbital-border pb-2 last:border-0">
                    <span className="text-orbital-text min-w-0">
                      <span className="font-medium">{e.actorName || 'Someone'}</span>
                      {' '}
                      <span className="text-orbital-subtle">{describeEvent(e)}</span>
                    </span>
                    <span className="text-[11px] text-orbital-dim whitespace-nowrap ml-auto">
                      {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <ActivityEmptyState state={eventsState} />
            )}
          </div>
        </div>

        {/* Task flow */}
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-orbital-text mb-1">Task Flow</h3>
          <p className="text-xs text-orbital-subtle mb-4">Assignments vs completions per week (last 8 weeks)</p>
          {eventsState === 'ready' && hasFlowData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={taskFlow} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: legendTextColor, fontSize: 12 }}>{v}</span>} />
                <Line type="monotone" dataKey="assigned" stroke="#3ba8e0" strokeWidth={2} dot={false} name="Assigned" />
                <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ActivityEmptyState state={eventsState} />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Productions per month */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-4">Productions per Month</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={productionsPerMonth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fill: axisTickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axisTickColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: cursorFillColor }} />
                <Bar dataKey="count" fill="#3ba8e0" radius={[4, 4, 0, 0]} name="Productions" />
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
                    formatter={(value) => <span style={{ color: legendTextColor, fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-orbital-subtle text-sm text-center py-8">No productions yet.</p>
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
              <p className="text-orbital-subtle text-sm text-center py-8">No tasks have assignees yet.</p>
            )}
          </div>

          {/* Top equipment */}
          <div className="card p-5">
            <h3 className="font-semibold text-orbital-text mb-4">Most Used Equipment</h3>
            {topEquipment.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topEquipment} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: cursorFillColor }} />
                  <Bar dataKey="count" fill="#55c9ef" radius={[0, 4, 4, 0]} name="Uses" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-orbital-subtle text-sm text-center py-8">No add-ons logged yet.</p>
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

// The honest empty state — says exactly why there's nothing, never fakes.
function ActivityEmptyState({ state }) {
  return (
    <p className="text-orbital-subtle text-sm text-center py-8">
      {state === 'loading' && 'Loading activity…'}
      {state === 'unavailable' && 'Activity tracking isn’t live yet — run the M1 migration to start counting.'}
      {state === 'ready' && 'No activity in this window yet. Actions count from the moment they happen.'}
    </p>
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
