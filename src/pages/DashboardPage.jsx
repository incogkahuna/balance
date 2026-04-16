import { Link, useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { Film, CheckSquare, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, PRODUCTION_STATUS, TASK_STATUS } from '../data/models.js'
import { StatusBadge, TaskStatusBadge, PriorityBadge, STATUS_COLOR } from '../components/ui/StatusBadge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import { UpcomingMilestones } from '../features/productions/roadmap/UpcomingMilestones.jsx'
import { TickerBanner } from '../components/ui/TickerBanner.jsx'

// ── Task status → accent colors ───────────────────────────────────────────────
const TASK_STATUS_COLOR = {
  [TASK_STATUS.NOT_STARTED]:  '#35363e',
  [TASK_STATUS.IN_PROGRESS]:  '#3b82f6',
  [TASK_STATUS.NEEDS_REVIEW]: '#f59e0b',
  [TASK_STATUS.COMPLETE]:     '#22c55e',
  [TASK_STATUS.VERIFIED]:     '#16a34a',
  [TASK_STATUS.BLOCKED]:      '#ef4444',
}

// ── Due date inline label ─────────────────────────────────────────────────────
function DueLabel({ date }) {
  if (!date) return null
  const d = parseISO(date)
  if (isToday(d))    return <span className="text-amber-400 text-xs">Today</span>
  if (isTomorrow(d)) return <span className="text-blue-400  text-xs">Tomorrow</span>
  if (isPast(d))     return <span className="text-red-400   text-xs font-medium">Overdue</span>
  return <span className="text-orbital-subtle text-xs">{format(d, 'MMM d')}</span>
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-0.5 h-3" style={{ background: '#3b82f6' }} />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-orbital-subtle"
          style={{ letterSpacing: '0.08em' }}>
          {label}
        </h2>
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
  const activeProds    = productions.filter(p => p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING)

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

      {/* ── Live feed ticker ── */}
      <div className="-mx-0">
        <TickerBanner />
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5">

        {/* ── Page header ── */}
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h1 className="text-base font-semibold text-orbital-text">{currentUser?.name}</h1>
            <p className="text-xs text-orbital-subtle mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* ── Stats strip — four connected blocks ── */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 mb-6"
          style={{
            border: '1px solid #27282e',
            borderRight: 'none',
          }}
        >
          {[
            { icon: Film,          label: 'Active',   value: totalActive,    color: '#22c55e', to: `/productions?status=${PRODUCTION_STATUS.ACTIVE}` },
            { icon: Clock,         label: 'Incoming', value: totalIncoming,  color: '#3b82f6', to: `/productions?status=${PRODUCTION_STATUS.INCOMING}` },
            { icon: CheckSquare,   label: 'My Tasks', value: myTasks.length, color: '#a78bfa', to: '/tasks?filter=mine' },
            { icon: AlertTriangle, label: 'Overdue',  value: totalOverdue,   color: totalOverdue > 0 ? '#ef4444' : '#52525b', to: '/tasks?filter=overdue' },
          ].map(({ icon: Icon, label, value, color, to }) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-orbital-panel"
              style={{
                background: '#1a1b1e',
                borderRight: '1px solid #27282e',
              }}
            >
              <Icon size={14} style={{ color, opacity: 0.8 }} className="flex-shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none font-mono" style={{ color }}>{value}</p>
                <p className="text-[11px] text-orbital-subtle mt-0.5">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Main content grid ── */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* My Tasks */}
          <section>
            <SectionHeader
              label="My Tasks"
              action={myPendingTasks.length > 3 && (
                <button onClick={() => navigate('/productions')}
                  className="flex items-center gap-0.5 text-[11px] text-orbital-subtle hover:text-orbital-text transition-colors">
                  View all <ChevronRight size={12} />
                </button>
              )}
            />
            {myPendingTasks.length === 0 ? (
              <div className="card px-4 py-5 text-center">
                <p className="text-xs text-orbital-subtle">No pending tasks.</p>
              </div>
            ) : (
              <div className="card divide-y" style={{ '--tw-divide-opacity': 1, borderColor: '#27282e' }}>
                {myPendingTasks.slice(0, 5).map(task => {
                  const prod        = productions.find(p => p.id === task.productionId)
                  const accentColor = TASK_STATUS_COLOR[task.status] || '#35363e'
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/productions/${task.productionId}`)}
                      className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-orbital-panel transition-colors"
                      style={{ borderLeft: `2px solid ${accentColor}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-orbital-text leading-snug truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-orbital-subtle truncate">{prod?.name}</span>
                          <DueLabel date={task.dueDate} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        <PriorityBadge priority={task.priority} />
                        <TaskStatusBadge task={task} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Active Productions */}
          <section>
            <SectionHeader
              label="Active Productions"
              action={isAdminOrSup && (
                <button onClick={() => navigate('/productions')}
                  className="flex items-center gap-0.5 text-[11px] text-orbital-subtle hover:text-orbital-text transition-colors">
                  View all <ChevronRight size={12} />
                </button>
              )}
            />
            {activeProds.length === 0 ? (
              <div className="card px-4 py-5 text-center">
                <p className="text-xs text-orbital-subtle">No active or incoming productions.</p>
              </div>
            ) : (
              <div className="card divide-y" style={{ borderColor: '#27282e' }}>
                {activeProds.slice(0, 5).map(prod => {
                  const prodTasks      = tasks.filter(t => t.productionId === prod.id)
                  const completedTasks = prodTasks.filter(t => t.status === TASK_STATUS.VERIFIED).length
                  const pct            = prodTasks.length > 0 ? (completedTasks / prodTasks.length) * 100 : 0
                  const accent         = STATUS_COLOR[prod.status] || '#52525b'
                  return (
                    <div
                      key={prod.id}
                      onClick={() => navigate(`/productions/${prod.id}`)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orbital-panel transition-colors"
                      style={{ borderLeft: `2px solid ${accent}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-orbital-text truncate">{prod.name}</p>
                        <p className="text-[11px] text-orbital-subtle mt-0.5 truncate">{prod.client}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {prodTasks.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-0.5" style={{ background: '#27282e' }}>
                              <div className="h-full" style={{ width: `${pct}%`, background: accent }} />
                            </div>
                            <span className="text-[11px] text-orbital-subtle font-mono">{completedTasks}/{prodTasks.length}</span>
                          </div>
                        )}
                        <StatusBadge status={prod.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Upcoming milestones */}
          <section className="lg:col-span-2">
            <UpcomingMilestones />
          </section>

          {/* Needs verification */}
          {isAdminOrSup && pendingVerification.length > 0 && (
            <section className="lg:col-span-2">
              <SectionHeader
                label="Needs Verification"
                action={
                  <span className="text-xs px-2 py-0.5"
                    style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    {pendingVerification.length}
                  </span>
                }
              />
              <div className="card divide-y" style={{ borderColor: '#27282e' }}>
                {pendingVerification.map(task => {
                  const prod = productions.find(p => p.id === task.productionId)
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/productions/${task.productionId}`)}
                      className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-orbital-panel transition-colors"
                      style={{ borderLeft: '2px solid rgba(245,158,11,0.5)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-orbital-text truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar userId={task.assigneeId} size="xs" />
                          <span className="text-[11px] text-orbital-subtle truncate">{prod?.name}</span>
                        </div>
                        {task.completionNote && (
                          <p className="text-[11px] text-orbital-subtle mt-1 line-clamp-1 italic opacity-70">
                            "{task.completionNote}"
                          </p>
                        )}
                      </div>
                      <TaskStatusBadge task={task} className="flex-shrink-0 mt-0.5" />
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
