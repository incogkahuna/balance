import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  Mail, MapPin, Briefcase, CheckCircle2, Activity, Film,
  Clock, Target, AlertOctagon, Zap, ArrowRight, Plus, X, Loader2,
  UserSquare2,
} from 'lucide-react'
import { USERS, ROLES, PRODUCTION_STATUS, TASK_STATUS } from '../data/models.js'
import { useApp } from '../context/AppContext.jsx'
import { StatusBadge } from '../components/ui/StatusBadge.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { listRoleAssignments, upsertRoleAssignment } from '../lib/data/roleAssignments.ts'

// Curated palette for new-member color selection — matches the existing USERS aesthetic
const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#a78bfa',
]

// Map our role enum to user-facing labels and color accents
const ROLE_META = {
  [ROLES.ADMIN]:      { label: 'Administrator', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  [ROLES.SUPERVISOR]: { label: 'Supervisor',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
  [ROLES.CREW]:       { label: 'Crew',          color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)'  },
}

// Email lives on each USERS entry now (see src/data/models.js). Kept as a
// thin helper so consumers can keep calling USER_EMAIL[id] without churning
// downstream code.
const USER_EMAIL = Object.fromEntries(USERS.map(u => [u.id, u.email]))

export function TeamPage() {
  const { currentUser } = useApp()
  const isAdmin = currentUser?.role === ROLES.ADMIN

  // Pre-authorized members from Supabase (admin-readable). For non-admins this
  // stays empty and we fall back to the hardcoded USERS list.
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    try {
      const rows = await listRoleAssignments()
      setAssignments(rows)
    } catch (e) {
      console.error('[TeamPage] failed to load role_assignments', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  // Merge USERS (legacy hardcoded — keeps the in-app id/avatar) with any
  // role_assignments that aren't already represented in USERS by email match.
  // The result is the canonical team list shown in the tab strip.
  const members = useMemo(() => buildMembers(assignments), [assignments])

  // Default to nothing selected per Wilder's feedback — the page should
  // open inviting the user to pick someone rather than auto-spotlighting
  // Mark every time.
  const [selectedId, setSelectedId] = useState(null)
  const selected = selectedId ? members.find(m => m.id === selectedId) : null

  const [showAdd, setShowAdd] = useState(false)
  const handleAdded = async () => {
    setShowAdd(false)
    await reload()
  }

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
        <div className="flex items-center gap-3">
          <p className="font-telemetry text-[10px] text-orbital-dim tracking-wider">
            {members.length} MEMBER{members.length === 1 ? '' : 'S'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Member grid — wraps to as many rows as needed so no name gets
              clipped no matter how big the roster grows. Selected card
              gets a coloured border in the member's accent + bright
              background; the rest stay quiet. */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 mb-4 p-1.5"
        style={{
          background: 'var(--orbital-bg)',
          border: '1px solid var(--orbital-border)',
        }}
      >
        {members.map(user => {
          const active = user.id === selectedId
          const roleMeta = ROLE_META[user.role]
          return (
            <button
              key={user.id}
              onClick={() => setSelectedId(user.id)}
              className="relative flex items-center gap-2 px-2.5 py-2 transition-colors text-left min-w-0"
              style={{
                background: active ? 'var(--orbital-surface)' : 'transparent',
                border: active ? `1px solid ${user.color}88` : '1px solid var(--orbital-border)',
                color: active ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
                opacity: user.isPending ? 0.78 : 1,
                boxShadow: active ? `0 0 0 1px ${user.color}33, inset 0 0 16px ${user.color}10` : 'none',
              }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                style={{ background: user.color }}
              >
                {user.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate leading-tight">{user.name}</p>
                <p
                  className="font-telemetry text-[9px] tracking-wider mt-0.5"
                  style={{ color: active ? roleMeta.color : 'var(--orbital-dim)' }}
                >
                  {roleMeta.label.toUpperCase()}
                  {user.isPending && (
                    <span className="ml-1.5" style={{ color: '#fbbf24' }}>
                      · PENDING
                    </span>
                  )}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {selected ? (
        <TeamMemberDetail user={selected} />
      ) : (
        <div
          className="card-elevated px-6 py-10 text-center"
          style={{ borderStyle: 'dashed' }}
        >
          <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-full"
            style={{ background: 'var(--orbital-muted)', border: '1px solid var(--orbital-border)' }}
          >
            <UserSquare2 size={20} className="text-orbital-subtle" />
          </div>
          <p className="text-sm text-orbital-text font-medium mb-1">
            Pick a team member to see their stats
          </p>
          <p className="text-xs text-orbital-subtle">
            Tap any card above to view assigned productions, task completion, and activity.
          </p>
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Team Member"
        size="md"
      >
        <AddMemberForm onAdded={handleAdded} onCancel={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}

// Merge the legacy USERS list with any role_assignments not already represented.
// Members from role_assignments who don't have a profile yet (no legacy USERS
// row by email match AND not yet signed in) are flagged isPending so the UI
// can show an "awaiting first sign-in" badge.
function buildMembers(assignments) {
  const known = USERS.map(u => ({ ...u, email: USER_EMAIL[u.id] || null }))
  const knownEmails = new Set(known.map(u => u.email).filter(Boolean))

  const extras = assignments
    .filter(a => !knownEmails.has(a.email))
    .map(a => ({
      id: a.email,                                            // stable per-email id
      name: a.displayName || a.email.split('@')[0],
      role: a.role,
      avatar: (a.displayName || a.email).charAt(0).toUpperCase(),
      color: a.displayColor || '#6b7280',
      email: a.email,
      isPending: true,
    }))

  return [...known, ...extras]
}

// ── Add Team Member modal form ────────────────────────────────────────────────
function AddMemberForm({ onAdded, onCancel }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState(ROLES.CREW)
  const [color, setColor] = useState(COLOR_PALETTE[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await upsertRoleAssignment({
        email: email.trim(),
        role,
        displayName: name.trim() || undefined,
        displayColor: color,
      })
      onAdded()
    } catch (err) {
      setError(err?.message || 'Failed to save.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-orbital-subtle leading-relaxed">
        Pre-authorize a new team member. They'll be auto-promoted to the role
        below when they sign in with this email for the first time at
        balance-six-gamma.vercel.app.
      </p>

      <div>
        <label className="label">Work email *</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="name@orbitalvs.com"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="label">Display name</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="(optional — defaults to the local-part of the email)"
        />
      </div>

      <div>
        <label className="label">Role</label>
        <select className="select" value={role} onChange={e => setRole(e.target.value)}>
          <option value={ROLES.CREW}>Crew — view assignments, log add-ons, complete tasks</option>
          <option value={ROLES.SUPERVISOR}>Supervisor — create and manage productions</option>
          <option value={ROLES.ADMIN}>Admin — full access</option>
        </select>
      </div>

      <div>
        <label className="label">Avatar color</label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-8 h-8 transition-transform"
              style={{
                background: c,
                border: color === c ? '2px solid var(--orbital-text)' : '1px solid var(--orbital-border)',
                transform: color === c ? 'scale(1.1)' : 'scale(1)',
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-2 py-1.5"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={submitting}>Cancel</button>
        <button type="submit" className="btn-primary flex-1 inline-flex items-center justify-center gap-2" disabled={submitting}>
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Saving…' : 'Pre-authorize'}
        </button>
      </div>
    </form>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
