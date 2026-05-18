import { useState, useMemo } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  Mail, MapPin, Briefcase, CheckCircle2, Activity, Film,
  Clock, Target, AlertOctagon, Zap, ArrowRight,
} from 'lucide-react'
import { USERS, ROLES, PRODUCTION_STATUS, TASK_STATUS } from '../data/models.js'
import { useApp } from '../context/AppContext.jsx'
import { StatusBadge } from '../components/ui/StatusBadge.jsx'

// Map our role enum to user-facing labels and color accents
const ROLE_META = {
  [ROLES.ADMIN]:      { label: 'Administrator', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  [ROLES.SUPERVISOR]: { label: 'Supervisor',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
  [ROLES.CREW]:       { label: 'Crew',          color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)'  },
}

// Real emails confirmed for the two team members who've signed in so far;
// the rest use a synthesized placeholder until their real address lands.
const USER_EMAIL = {
  mark:   'mark@orbitalvs.com',
  danny:  'dhorgan@orbitalvs.com',
  aj:     'aj@orbitalvs.com',
  brian:  'brian@orbitalvs.com',
  wilder: 'wilder@orbitalvs.com',
}

export function TeamPage() {
  const [selectedId, setSelectedId] = useState(USERS[0].id)
  const selected = USERS.find(u => u.id === selectedId) || USERS[0]

  return (
    <div className="px-4 lg:px-6 py-5 max-w-7xl mx-auto">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.25em] mb-1">
            TEAM · ORBITAL STUDIOS
          </p>
          <h1 className="text-base font-semibold text-orbital-text">Salary Roster</h1>
        </div>
        <p className="font-telemetry text-[10px] text-orbital-dim tracking-wider">
          {USERS.length} ACTIVE
        </p>
      </div>

      {/* ── Sub-tab strip: one per team member ───────────────────────── */}
      <div
        className="flex items-center gap-0.5 p-0.5 mb-4 overflow-x-auto"
        style={{
          background: 'var(--orbital-bg)',
          border: '1px solid var(--orbital-border)',
        }}
      >
        {USERS.map(user => {
          const active = user.id === selectedId
          const roleMeta = ROLE_META[user.role]
          return (
            <button
              key={user.id}
              onClick={() => setSelectedId(user.id)}
              className="flex items-center gap-2 px-3 py-2 transition-colors whitespace-nowrap flex-1"
              style={{
                background: active ? 'var(--orbital-surface)' : 'transparent',
                border: active ? `1px solid ${user.color}55` : '1px solid transparent',
                color: active ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                style={{ background: user.color }}
              >
                {user.avatar}
              </span>
              <span className="text-sm font-medium">{user.name}</span>
              <span
                className="font-telemetry text-[9px] tracking-wider px-1.5 py-px hidden sm:inline-flex"
                style={{
                  background: roleMeta.bg,
                  border: `1px solid ${roleMeta.border}`,
                  color: roleMeta.color,
                }}
              >
                {roleMeta.label.toUpperCase()}
              </span>
            </button>
          )
        })}
      </div>

      <TeamMemberDetail user={selected} />
    </div>
  )
}

// ── Detail panel for the selected team member ─────────────────────────────────
function TeamMemberDetail({ user }) {
  const { productions, tasks } = useApp()
  const roleMeta = ROLE_META[user.role]

  // ── Productions ───────────────────────────────────────────────────────────
  const assignedProductions = useMemo(
    () => productions.filter(p =>
      p.assignedMembers?.some(m => m.userId === user.id)
    ),
    [productions, user.id]
  )
  const activeProds    = assignedProductions.filter(p => p.status === PRODUCTION_STATUS.ACTIVE).length
  const completedProds = assignedProductions.filter(p => p.status === PRODUCTION_STATUS.COMPLETED || p.status === PRODUCTION_STATUS.WRAP).length

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const myTasks = useMemo(
    () => tasks.filter(t => t.assigneeId === user.id),
    [tasks, user.id]
  )

  const isDone = (t) => t.status === TASK_STATUS.VERIFIED || t.status === TASK_STATUS.COMPLETE
  const isOpen = (t) => !isDone(t) && t.status !== TASK_STATUS.BLOCKED

  const openTasks      = myTasks.filter(isOpen)
  const completedTasks = myTasks.filter(isDone)
  const blockedTasks   = myTasks.filter(t => t.status === TASK_STATUS.BLOCKED)
  const inProgressTasks = myTasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length

  // ── Time-to-complete & on-time rate ──────────────────────────────────────
  // Turnaround = days between task creation and last update on completed tasks.
  // Caveat: updated_at gets bumped on any update, not strictly on completion.
  // For demo seed values this approximates "how long did it take to finish."
  // A future iteration could pull from task_status_history for exact transition times.
  const tasksWithTurnaround = completedTasks
    .map(t => {
      if (!t.createdAt || !t.updatedAt) return null
      const days = differenceInCalendarDays(parseISO(t.updatedAt), parseISO(t.createdAt))
      return { task: t, days: Math.max(0, days) }
    })
    .filter(Boolean)

  const avgTurnaround = tasksWithTurnaround.length > 0
    ? tasksWithTurnaround.reduce((sum, x) => sum + x.days, 0) / tasksWithTurnaround.length
    : null

  // On-time rate: of completed tasks with a due date, how many were updated on or before that date?
  const completedWithDue = completedTasks.filter(t => t.dueDate && t.updatedAt)
  const onTimeCount = completedWithDue.filter(t =>
    differenceInCalendarDays(parseISO(t.dueDate), parseISO(t.updatedAt)) >= 0
  ).length
  const onTimeRate = completedWithDue.length > 0
    ? Math.round((onTimeCount / completedWithDue.length) * 100)
    : null

  // ── Next up — first non-done, non-blocked task sorted by due date ─────────
  const nextUp = useMemo(() => {
    return [...openTasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return parseISO(a.dueDate) - parseISO(b.dueDate)
    })[0]
  }, [openTasks])

  // ── Recent completed (last 5, most-recent first) ─────────────────────────
  const recentlyCompleted = useMemo(() => {
    return [...tasksWithTurnaround]
      .sort((a, b) => parseISO(b.task.updatedAt) - parseISO(a.task.updatedAt))
      .slice(0, 5)
  }, [tasksWithTurnaround])

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* ── Hero card ─────────────────────────────────────────────────── */}
      <div
        className="lg:col-span-1 card-elevated p-5 self-start"
        style={{ borderLeft: `3px solid ${user.color}` }}
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: user.color, boxShadow: `0 0 24px ${user.color}55` }}
          >
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-orbital-text">{user.name}</h2>
            <p
              className="font-telemetry text-[10px] tracking-wider mt-1 inline-block px-2 py-0.5"
              style={{
                background: roleMeta.bg,
                border: `1px solid ${roleMeta.border}`,
                color: roleMeta.color,
              }}
            >
              {roleMeta.label.toUpperCase()}
            </p>
          </div>
        </div>

        <ContactRow icon={Mail}      label="EMAIL"   value={USER_EMAIL[user.id] || `${user.id}@orbitalvs.com`} />
        <ContactRow icon={Briefcase} label="ROLE"    value={`Salaried · ${roleMeta.label}`} />
        <ContactRow icon={MapPin}    label="STATION" value="Orbital Studios · Los Angeles" />
      </div>

      {/* ── Stats + assignment lists ────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Stat strip — 6 cells in 3 cols × 2 rows */}
        <div className="grid grid-cols-3 gap-2">
          <StatBlock icon={Film}         label="PRODUCTIONS" value={assignedProductions.length} sub={`${activeProds} ACTIVE · ${completedProds} WRAPPED`} accent={user.color} />
          <StatBlock icon={Activity}     label="OPEN TASKS"  value={openTasks.length} sub={`${inProgressTasks} IN PROGRESS`} accent="#fbbf24" />
          <StatBlock icon={CheckCircle2} label="COMPLETED"   value={completedTasks.length} sub="VERIFIED + DONE" accent="#34d399" />
          <StatBlock
            icon={Clock}
            label="AVG TURNAROUND"
            value={avgTurnaround !== null ? avgTurnaround.toFixed(1) : '—'}
            sub={avgTurnaround !== null ? `DAYS · ${tasksWithTurnaround.length} TASKS` : 'NO DATA YET'}
            accent="#60a5fa"
          />
          <StatBlock
            icon={Target}
            label="ON-TIME RATE"
            value={onTimeRate !== null ? `${onTimeRate}%` : '—'}
            sub={onTimeRate !== null ? `${onTimeCount} / ${completedWithDue.length} TASKS` : 'NO DATA YET'}
            accent={onTimeRate === null ? '#71717a' : onTimeRate >= 80 ? '#34d399' : onTimeRate >= 50 ? '#fbbf24' : '#ef4444'}
          />
          <StatBlock
            icon={AlertOctagon}
            label="BLOCKED"
            value={blockedTasks.length}
            sub={blockedTasks.length > 0 ? 'NEEDS ATTENTION' : 'ALL CLEAR'}
            accent={blockedTasks.length > 0 ? '#ef4444' : '#71717a'}
          />
        </div>

        {/* Next up callout */}
        {nextUp && (
          <div
            className="card-elevated px-4 py-3 flex items-center gap-4"
            style={{ borderLeft: `3px solid ${user.color}` }}
          >
            <Zap size={20} style={{ color: user.color }} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">NEXT UP</p>
              <p className="text-base text-orbital-text font-medium truncate mt-0.5">{nextUp.title}</p>
              <p className="text-xs text-orbital-subtle truncate mt-0.5">
                {productions.find(p => p.id === nextUp.productionId)?.name || 'Unknown production'}
                {nextUp.dueDate && ` · due ${format(parseISO(nextUp.dueDate), 'MMM d')}`}
                {' · '}{nextUp.status.toUpperCase()}
              </p>
            </div>
            <ArrowRight size={16} className="text-orbital-subtle flex-shrink-0" />
          </div>
        )}

        {/* Two-column section: productions + recent completions */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Productions list */}
          <div className="card-elevated">
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
              <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">
                ASSIGNED PRODUCTIONS · {assignedProductions.length}
              </p>
            </div>
            {assignedProductions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-orbital-dim text-center">
                Not currently assigned to any production.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
                {assignedProductions.map(prod => {
                  const myAssignment = prod.assignedMembers.find(m => m.userId === user.id)
                  return (
                    <div key={prod.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-orbital-panel transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-orbital-text truncate">{prod.name}</p>
                        <p className="text-xs text-orbital-subtle truncate mt-0.5">
                          {prod.client}
                          {myAssignment?.roleOnProduction && ` · ${myAssignment.roleOnProduction}`}
                        </p>
                      </div>
                      <StatusBadge status={prod.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent completions with turnaround */}
          <div className="card-elevated">
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
              <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">
                RECENTLY COMPLETED · {recentlyCompleted.length}
              </p>
            </div>
            {recentlyCompleted.length === 0 ? (
              <p className="px-4 py-6 text-sm text-orbital-dim text-center">
                No completed tasks yet.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
                {recentlyCompleted.map(({ task, days }) => {
                  const taskProd = productions.find(p => p.id === task.productionId)
                  return (
                    <div key={task.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-orbital-panel transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-orbital-text truncate">{task.title}</p>
                        {taskProd && (
                          <p className="text-[11px] text-orbital-subtle truncate mt-0.5">{taskProd.name}</p>
                        )}
                      </div>
                      <span
                        className="font-telemetry text-[10px] tracking-wider tabular-nums whitespace-nowrap px-1.5 py-0.5"
                        title="Turnaround: days from creation to completion"
                        style={{
                          background: 'rgba(96,165,250,0.1)',
                          border: '1px solid rgba(96,165,250,0.3)',
                          color: '#60a5fa',
                        }}
                      >
                        {days}D
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Full open tasks list */}
        <div className="card-elevated">
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
            <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">
              OPEN TASKS · {openTasks.length}
            </p>
          </div>
          {myTasks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-orbital-dim text-center">
              No tasks assigned.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
              {myTasks.slice(0, 8).map(task => {
                const taskProd = productions.find(p => p.id === task.productionId)
                return (
                  <div key={task.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-orbital-panel transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-orbital-text truncate">{task.title}</p>
                      {taskProd && (
                        <p className="text-[11px] text-orbital-subtle truncate mt-0.5">{taskProd.name}</p>
                      )}
                    </div>
                    <span
                      className="font-telemetry text-[9px] tracking-wider px-1.5 py-0.5 whitespace-nowrap"
                      style={{
                        color: 'var(--orbital-subtle)',
                        border: '1px solid var(--orbital-border)',
                      }}
                    >
                      {task.status.toUpperCase()}
                    </span>
                  </div>
                )
              })}
              {myTasks.length > 8 && (
                <p className="px-4 py-2 text-xs text-orbital-dim text-center">
                  + {myTasks.length - 8} more
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small reusable bits ───────────────────────────────────────────────────────
function ContactRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderTop: '1px solid var(--orbital-border)' }}>
      <Icon size={14} className="text-orbital-subtle mt-1 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-telemetry text-[9px] tracking-wider text-orbital-dim">{label}</p>
        <p className="text-sm text-orbital-text truncate">{value}</p>
      </div>
    </div>
  )
}

function StatBlock({ icon: Icon, label, value, sub, accent }) {
  return (
    <div
      className="card-elevated px-3 py-3"
      style={{ borderTop: `2px solid ${accent}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-telemetry text-[9px] tracking-wider text-orbital-subtle">{label}</p>
        <Icon size={12} style={{ color: accent }} />
      </div>
      <p className="font-telemetry text-2xl font-semibold text-orbital-text tabular-nums">
        {String(value).padStart(2, '0')}
      </p>
      <p className="font-telemetry text-[9px] tracking-wider text-orbital-dim mt-0.5">{sub}</p>
    </div>
  )
}
