import { Link, useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { Film, CheckSquare, AlertTriangle, Clock } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, PRODUCTION_STATUS } from '../data/models.js'
import { StatusBadge, TaskStatusBadge, PriorityBadge } from '../components/ui/StatusBadge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'

function DueDateLabel({ date }) {
  if (!date) return null
  const d = parseISO(date)
  if (isToday(d)) return <span className="text-amber-400 text-xs font-medium">Due today</span>
  if (isTomorrow(d)) return <span className="text-blue-400 text-xs font-medium">Due tomorrow</span>
  if (isPast(d)) return <span className="text-red-400 text-xs font-medium">Overdue</span>
  return <span className="text-orbital-subtle text-xs">{format(d, 'MMM d')}</span>
}

export function DashboardPage() {
  const { currentUser, productions, tasks, users } = useApp()
  const navigate = useNavigate()

  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  // My tasks — all active (not-yet-verified) tasks assigned to current user
  const myTasks = tasks.filter(t => t.assigneeId === currentUser?.id && !t.verifiedComplete)
  const myPendingTasks = myTasks.filter(t => !t.reportedComplete)

  // Active productions (visible list — includes incoming for glanceable context)
  const activeProductions = productions.filter(p =>
    p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING
  )

  // Admin/sup: tasks needing verification
  const pendingVerification = isAdminOrSup
    ? tasks.filter(t => t.reportedComplete && !t.verifiedComplete)
    : []

  // Stat counts. Overdue is role-scoped: crew only sees their own, so the
  // count on their card matches what they'll see after tapping through.
  const totalActive = productions.filter(p => p.status === PRODUCTION_STATUS.ACTIVE).length
  const totalIncoming = productions.filter(p => p.status === PRODUCTION_STATUS.INCOMING).length
  const overdueScope = isAdminOrSup
    ? tasks
    : tasks.filter(t => t.assigneeId === currentUser?.id)
  const totalOverdue = overdueScope.filter(t =>
    t.dueDate && isPast(parseISO(t.dueDate)) && !t.verifiedComplete
  ).length

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-orbital-text">
            Hey, {currentUser?.name}
          </h1>
          <p className="text-orbital-subtle mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Stats row — each card is a shortcut into its respective filtered view */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            icon={Film}
            label="Active"
            value={totalActive}
            color="text-green-400"
            bg="bg-green-500/10"
            to={`/productions?status=${encodeURIComponent(PRODUCTION_STATUS.ACTIVE)}`}
          />
          <StatCard
            icon={Clock}
            label="Incoming"
            value={totalIncoming}
            color="text-blue-400"
            bg="bg-blue-500/10"
            to={`/productions?status=${encodeURIComponent(PRODUCTION_STATUS.INCOMING)}`}
          />
          <StatCard
            icon={CheckSquare}
            label="My Tasks"
            value={myTasks.length}
            color="text-purple-400"
            bg="bg-purple-500/10"
            to="/tasks?filter=mine"
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue"
            value={totalOverdue}
            color="text-red-400"
            bg="bg-red-500/10"
            alert={totalOverdue > 0}
            to="/tasks?filter=overdue"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Tasks */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-orbital-text">My Tasks</h2>
              {myPendingTasks.length > 3 && (
                <button
                  onClick={() => navigate('/productions')}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  View all
                </button>
              )}
            </div>
            {myPendingTasks.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-orbital-subtle text-sm">All caught up — no pending tasks.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myPendingTasks.slice(0, 5).map(task => {
                  const production = productions.find(p => p.id === task.productionId)
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/productions/${task.productionId}`)}
                      className="card p-4 cursor-pointer hover:border-orbital-muted transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-orbital-text leading-snug">{task.title}</p>
                        <TaskStatusBadge task={task} className="flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-orbital-subtle truncate">{production?.name}</span>
                        <DueDateLabel date={task.dueDate} />
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Active Productions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-orbital-text">Active Productions</h2>
              {isAdminOrSup && (
                <button
                  onClick={() => navigate('/productions')}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  View all
                </button>
              )}
            </div>
            {activeProductions.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-orbital-subtle text-sm">No active or incoming productions.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeProductions.slice(0, 5).map(prod => {
                  const prodTasks = tasks.filter(t => t.productionId === prod.id)
                  const completedTasks = prodTasks.filter(t => t.verifiedComplete).length
                  return (
                    <div
                      key={prod.id}
                      onClick={() => navigate(`/productions/${prod.id}`)}
                      className="card p-4 cursor-pointer hover:border-orbital-muted transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-sm font-medium text-orbital-text">{prod.name}</p>
                          <p className="text-xs text-orbital-subtle mt-0.5">{prod.client}</p>
                        </div>
                        <StatusBadge status={prod.status} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {prod.startDate && (
                            <span className="text-xs text-orbital-subtle">
                              {format(parseISO(prod.startDate), 'MMM d')}
                              {prod.endDate && ` – ${format(parseISO(prod.endDate), 'MMM d')}`}
                            </span>
                          )}
                        </div>
                        {prodTasks.length > 0 && (
                          <span className="text-xs text-orbital-subtle">
                            {completedTasks}/{prodTasks.length} tasks
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Pending Verification (admin/sup) */}
          {isAdminOrSup && pendingVerification.length > 0 && (
            <section className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-orbital-text">Needs Your Verification</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                  {pendingVerification.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {pendingVerification.map(task => {
                  const production = productions.find(p => p.id === task.productionId)
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/productions/${task.productionId}`)}
                      className="card p-4 cursor-pointer hover:border-amber-500/30 transition-colors border-amber-500/20 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-orbital-text">{task.title}</p>
                        <TaskStatusBadge task={task} className="flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar userId={task.assigneeId} size="xs" />
                        <span className="text-xs text-orbital-subtle">{production?.name}</span>
                      </div>
                      {task.completionNote && (
                        <p className="text-xs text-orbital-subtle mt-2 line-clamp-2 italic">
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

// StatCard renders as an interactive Link when `to` is provided, otherwise
// as a static div — keeps the component usable for display-only contexts.
function StatCard({ icon: Icon, label, value, color, bg, alert, to }) {
  const content = (
    <>
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={color} />
      </div>
      <p className="text-2xl font-bold text-orbital-text">{value}</p>
      <p className="text-xs text-orbital-subtle mt-0.5">{label}</p>
    </>
  )

  const baseClass = `card p-4 text-left ${alert ? 'border-red-500/30' : ''}`

  if (to) {
    return (
      <Link
        to={to}
        className={`${baseClass} block transition-all hover:border-orbital-muted hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
      >
        {content}
      </Link>
    )
  }

  return <div className={baseClass}>{content}</div>
}
