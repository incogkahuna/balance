import { Link, useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { Film, CheckSquare, AlertTriangle, Clock } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, PRODUCTION_STATUS, TASK_STATUS } from '../data/models.js'
import { StatusBadge, TaskStatusBadge, PriorityBadge } from '../components/ui/StatusBadge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import { UpcomingMilestones } from '../features/productions/roadmap/UpcomingMilestones.jsx'
import { TickerBanner } from '../components/ui/TickerBanner.jsx'

// ── Status accent colors ──────────────────────────────────────────────────────
const TASK_BORDER = {
  [TASK_STATUS.NOT_STARTED]:  '#4d6a82',
  [TASK_STATUS.IN_PROGRESS]:  '#60a5fa',
  [TASK_STATUS.NEEDS_REVIEW]: '#fbbf24',
  [TASK_STATUS.COMPLETE]:     '#4ade80',
  [TASK_STATUS.VERIFIED]:     '#34d399',
  [TASK_STATUS.BLOCKED]:      '#f87171',
}

const PROD_BORDER = {
  [PRODUCTION_STATUS.ACTIVE]:    '#4ade80',
  [PRODUCTION_STATUS.INCOMING]:  '#60a5fa',
  [PRODUCTION_STATUS.WRAP]:      '#fbbf24',
  [PRODUCTION_STATUS.COMPLETED]: '#475569',
}

// ── Due-date label ────────────────────────────────────────────────────────────
function DueDateLabel({ date }) {
  if (!date) return null
  const d = parseISO(date)
  if (isToday(d))    return <span className="font-telemetry text-[8px] tracking-[0.1em] text-amber-400">DUE TODAY</span>
  if (isTomorrow(d)) return <span className="font-telemetry text-[8px] tracking-[0.1em] text-blue-400">TOMORROW</span>
  if (isPast(d))     return <span className="font-telemetry text-[8px] tracking-[0.1em] text-red-400">OVERDUE</span>
  return <span className="font-telemetry text-[8px] tracking-[0.08em] text-orbital-subtle">{format(d, 'MMM d').toUpperCase()}</span>
}

// ── Instrument panel section header ──────────────────────────────────────────
function HudHeader({ label, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-0.5 h-3.5 flex-shrink-0" style={{ background: 'rgba(14,165,233,0.65)' }} />
        <span className="font-telemetry text-[9px] tracking-[0.2em]" style={{ color: '#7090a8' }}>
          {label}
        </span>
        <div className="h-px w-10"
          style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.07), transparent)' }} />
      </div>
      {action}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { currentUser, productions, tasks } = useApp()
  const navigate = useNavigate()

  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const myTasks        = tasks.filter(t => t.assigneeId === currentUser?.id && t.status !== TASK_STATUS.VERIFIED)
  const myPendingTasks = myTasks.filter(t => t.status !== TASK_STATUS.COMPLETE && t.status !== TASK_STATUS.VERIFIED)

  const activeProductions = productions.filter(p =>
    p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING
  )

  const pendingVerification = isAdminOrSup
    ? tasks.filter(t => t.status === TASK_STATUS.COMPLETE || t.status === TASK_STATUS.NEEDS_REVIEW)
    : []

  const totalActive   = productions.filter(p => p.status === PRODUCTION_STATUS.ACTIVE).length
  const totalIncoming = productions.filter(p => p.status === PRODUCTION_STATUS.INCOMING).length
  const overdueScope  = isAdminOrSup ? tasks : tasks.filter(t => t.assigneeId === currentUser?.id)
  const totalOverdue  = overdueScope.filter(t =>
    t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== TASK_STATUS.VERIFIED
  ).length

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">

        {/* ── Operator console header ── */}
        <div className="mb-8">
          <p className="font-telemetry text-[8px] tracking-[0.28em] mb-2" style={{ color: '#4d6a82' }}>
            OPERATOR CONSOLE
          </p>
          <h1 className="text-2xl font-bold text-orbital-text">{currentUser?.name}</h1>
          <p className="font-telemetry text-[9px] tracking-[0.14em] mt-1.5" style={{ color: '#5a7a92' }}>
            {format(new Date(), 'EEEE · MMMM d · yyyy').toUpperCase()}
          </p>
        </div>

        {/* ── Live task feed ── */}
        <div className="-mx-4 lg:-mx-8 mb-8">
          <TickerBanner />
        </div>

        {/* ── Telemetry stat row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            icon={Film}          label="Active"   value={totalActive}
            color="text-green-400"
            to={`/productions?status=${encodeURIComponent(PRODUCTION_STATUS.ACTIVE)}`}
          />
          <StatCard
            icon={Clock}         label="Incoming" value={totalIncoming}
            color="text-blue-400"
            to={`/productions?status=${encodeURIComponent(PRODUCTION_STATUS.INCOMING)}`}
          />
          <StatCard
            icon={CheckSquare}   label="My Tasks" value={myTasks.length}
            color="text-purple-400"
            to="/tasks?filter=mine"
          />
          <StatCard
            icon={AlertTriangle} label="Overdue"  value={totalOverdue}
            color="text-red-400"
            alert={totalOverdue > 0}
            to="/tasks?filter=overdue"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── My Tasks ── */}
          <section>
            <HudHeader
              label="MY TASKS"
              action={myPendingTasks.length > 3 && (
                <button
                  onClick={() => navigate('/productions')}
                  className="font-telemetry text-[8px] tracking-[0.1em] transition-colors"
                  style={{ color: '#4d6a82' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#4d6a82' }}
                >
                  VIEW ALL ›
                </button>
              )}
            />
            {myPendingTasks.length === 0 ? (
              <div className="card p-5 text-center">
                <p className="font-telemetry text-[9px] tracking-[0.18em]" style={{ color: '#4ade80' }}>
                  ALL SYSTEMS NOMINAL
                </p>
                <p className="text-xs text-orbital-subtle mt-1 opacity-60">No pending tasks.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {myPendingTasks.slice(0, 5).map(task => {
                  const production  = productions.find(p => p.id === task.productionId)
                  const borderColor = TASK_BORDER[task.status] || '#4d6a82'
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/productions/${task.productionId}`)}
                      className="card p-3 cursor-pointer transition-all active:scale-[0.99]"
                      style={{ borderLeft: `2px solid ${borderColor}` }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium text-orbital-text leading-snug">{task.title}</p>
                        <TaskStatusBadge task={task} className="flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-telemetry text-[8px] tracking-[0.08em] text-orbital-subtle truncate">
                          {production?.name?.toUpperCase()}
                        </span>
                        <DueDateLabel date={task.dueDate} />
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Active Productions ── */}
          <section>
            <HudHeader
              label="ACTIVE PRODUCTIONS"
              action={isAdminOrSup && (
                <button
                  onClick={() => navigate('/productions')}
                  className="font-telemetry text-[8px] tracking-[0.1em] transition-colors"
                  style={{ color: '#4d6a82' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#4d6a82' }}
                >
                  VIEW ALL ›
                </button>
              )}
            />
            {activeProductions.length === 0 ? (
              <div className="card p-5 text-center">
                <p className="font-telemetry text-[9px] tracking-[0.18em] text-orbital-subtle">
                  NO ACTIVE UNITS
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeProductions.slice(0, 5).map(prod => {
                  const prodTasks      = tasks.filter(t => t.productionId === prod.id)
                  const completedTasks = prodTasks.filter(t => t.status === TASK_STATUS.VERIFIED).length
                  const borderColor    = PROD_BORDER[prod.status] || '#475569'
                  const pct            = prodTasks.length > 0 ? (completedTasks / prodTasks.length) * 100 : 0
                  return (
                    <div
                      key={prod.id}
                      onClick={() => navigate(`/productions/${prod.id}`)}
                      className="card p-3 cursor-pointer transition-all active:scale-[0.99]"
                      style={{ borderLeft: `2px solid ${borderColor}` }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-medium text-orbital-text">{prod.name}</p>
                          <p className="font-telemetry text-[8px] tracking-[0.1em] mt-0.5" style={{ color: '#5a7a92' }}>
                            {prod.client?.toUpperCase()}
                          </p>
                        </div>
                        <StatusBadge status={prod.status} />
                      </div>
                      <div className="flex items-center justify-between">
                        {prod.startDate && (
                          <span className="font-telemetry text-[8px] tracking-[0.08em] text-orbital-subtle">
                            {format(parseISO(prod.startDate), 'MMM d').toUpperCase()}
                            {prod.endDate && ` → ${format(parseISO(prod.endDate), 'MMM d').toUpperCase()}`}
                          </span>
                        )}
                        {prodTasks.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-0.5 bg-orbital-muted overflow-hidden">
                              <div className="h-full" style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${borderColor}, ${borderColor}99)`,
                              }} />
                            </div>
                            <span className="font-telemetry text-[8px]" style={{ color: '#5a7a92' }}>
                              {completedTasks}/{prodTasks.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Upcoming Milestones ── */}
          <section className="lg:col-span-2">
            <UpcomingMilestones />
          </section>

          {/* ── Needs Verification (admin/sup) ── */}
          {isAdminOrSup && pendingVerification.length > 0 && (
            <section className="lg:col-span-2">
              <HudHeader
                label="NEEDS VERIFICATION"
                action={
                  <span
                    className="font-telemetry text-[9px] tracking-[0.1em] px-2 py-0.5"
                    style={{
                      color: '#fbbf24',
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.35)',
                    }}
                  >
                    {pendingVerification.length}
                  </span>
                }
              />
              <div className="grid sm:grid-cols-2 gap-1.5">
                {pendingVerification.map(task => {
                  const production = productions.find(p => p.id === task.productionId)
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/productions/${task.productionId}`)}
                      className="card p-3 cursor-pointer transition-all active:scale-[0.99]"
                      style={{ borderLeft: '2px solid rgba(245,158,11,0.6)' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-orbital-text">{task.title}</p>
                        <TaskStatusBadge task={task} className="flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Avatar userId={task.assigneeId} size="xs" />
                        <span className="font-telemetry text-[8px] tracking-[0.08em] text-orbital-subtle">
                          {production?.name?.toUpperCase()}
                        </span>
                      </div>
                      {task.completionNote && (
                        <p className="text-xs text-orbital-subtle mt-2 line-clamp-2 italic opacity-70">
                          "{task.completionNote}"
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Telemetry stat card ───────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, alert, to }) {
  const colorHex = {
    'text-green-400':  '#4ade80',
    'text-blue-400':   '#60a5fa',
    'text-purple-400': '#c084fc',
    'text-red-400':    '#f87171',
  }[color] || '#60a5fa'

  const cardStyle = alert && value > 0 ? { borderColor: `${colorHex}40` } : {}

  const content = (
    <div className="relative p-4">
      {/* Corner L-brackets */}
      <div className="absolute top-0 left-0 w-3.5 h-3.5 pointer-events-none"
        style={{ borderTop: `1px solid ${colorHex}60`, borderLeft: `1px solid ${colorHex}60` }} />
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none"
        style={{ borderBottom: `1px solid ${colorHex}35`, borderRight: `1px solid ${colorHex}35` }} />

      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-telemetry text-[8px] tracking-[0.2em]" style={{ color: '#5a7a92' }}>
          {label.toUpperCase()}
        </span>
        <Icon size={11} style={{ color: colorHex, opacity: 0.6 }} />
      </div>

      {/* Readout */}
      <p className="font-mono font-bold tabular-nums leading-none" style={{ fontSize: 28, color: colorHex }}>
        {String(value).padStart(2, '0')}
      </p>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${colorHex}50 0%, transparent 65%)` }} />
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="card block transition-all hover:-translate-y-px active:scale-[0.97] focus:outline-none"
        style={cardStyle}
      >
        {content}
      </Link>
    )
  }
  return <div className="card" style={cardStyle}>{content}</div>
}
