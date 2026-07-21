import { useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { isPast, parseISO } from 'date-fns'
import {
  CheckSquare, AlertTriangle, Clock, CheckCheck, ListTodo,
  Search, Film, User, ArrowUpDown, Plus,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, TASK_STATUS, TASK_PRIORITY, TASK_VISIBILITY, createTask } from '../data/models.js'
import { TaskCard } from '../components/tasks/TaskCard.jsx'
import { TaskForm } from '../components/tasks/TaskForm.jsx'
import { QuickAdd } from '../components/tasks/QuickAdd.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import clsx from 'clsx'

// ─── Filter chip definitions ────────────────────────────────────────────────
const FILTERS = {
  all:       { label: 'All',                   icon: ListTodo },
  mine:      { label: 'Mine',                  icon: CheckSquare },
  overdue:   { label: 'Overdue',               icon: AlertTriangle },
  pending:   { label: 'Awaiting Verification', icon: Clock },
  verified:  { label: 'Verified',              icon: CheckCheck },
}

// Sort options driving the .sort callback below.
const SORT_OPTIONS = [
  { id: 'dueAsc',    label: 'Due date (soonest)' },
  { id: 'dueDesc',   label: 'Due date (latest)' },
  { id: 'priority',  label: 'Priority' },
  { id: 'status',    label: 'Status' },
  { id: 'title',     label: 'Title (A→Z)' },
]

const PRIORITY_RANK = {
  [TASK_PRIORITY.CRITICAL]: 0,
  [TASK_PRIORITY.HIGH]:     1,
  [TASK_PRIORITY.MEDIUM]:   2,
  [TASK_PRIORITY.LOW]:      3,
}

const STATUS_RANK = {
  [TASK_STATUS.BLOCKED]:      0,
  [TASK_STATUS.NEEDS_REVIEW]: 1,
  [TASK_STATUS.IN_PROGRESS]:  2,
  [TASK_STATUS.NOT_STARTED]:  3,
  [TASK_STATUS.COMPLETE]:     4,
  [TASK_STATUS.VERIFIED]:     5,
}

export function TasksPage() {
  const { currentUser, tasks, productions, tasksLoading, users, addTask } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const filter = searchParams.get('filter') || 'mine'
  // Distribution scope (the old Tasks/To-Dos split, now one page): a task is
  // 'production' work or 'internal' work based purely on whether it's
  // assigned to a production.
  const scope = searchParams.get('scope') || 'all'
  const setParams = (nextFilter, nextScope) => {
    const params = {}
    if (nextFilter !== 'mine') params.filter = nextFilter
    if (nextScope !== 'all') params.scope = nextScope
    setSearchParams(params)
  }
  const setFilter = (next) => setParams(next, scope)
  const setScope = (next) => setParams(filter, next)

  const isCrew    = currentUser?.role === ROLES.CREW
  const isAdmin   = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  // ── New page-level controls (not URL-backed; ephemeral session state) ──
  const [search, setSearch]           = useState('')
  const [productionId, setProductionId] = useState('all')   // 'all' or a production.id
  const [assigneeId, setAssigneeId]   = useState('all')   // 'all' or a user.id
  const [sortBy, setSortBy]           = useState('dueAsc')

  // ── New Task modal ──────────────────────────────────────────────────────
  // Opens the TaskForm directly — it defaults to "Internal use" with a
  // dropdown to attach a production (Danny's report). If the list is already
  // scoped to one production, that production is preselected.
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskProdId, setNewTaskProdId] = useState('')
  const openNewTask = () => {
    setNewTaskProdId(productionId !== 'all' ? productionId : '')
    setShowNewTask(true)
  }
  const closeNewTask = () => { setShowNewTask(false); setNewTaskProdId('') }

  // "Mine" must match BOTH identities: the legacy id ('danny') the app uses
  // day-to-day AND the auth-profile UUID — pickers backed by the merged
  // roster assign by profile UUID, so matching only one hid self-assigned
  // tasks (Danny's report: "assigned myself a task, can't see it").
  const isMine = useMemo(() => {
    const ids = new Set([currentUser?.id, currentUser?.profileId].filter(Boolean))
    return (t) => ids.has(t.assigneeId)
  }, [currentUser])

  // The base list everyone-on-this-account can see. Crew see only their own
  // tasks regardless of any later filter; admin/sup see everything. Internal
  // tasks (productionId null — the merged To-Dos) are first-class here.
  // Personal-visibility internal tasks are creator+assignee only — RLS
  // enforces it server-side; this mirrors it for dev/impersonation modes.
  const isMineOrCreated = useMemo(() => {
    const ids = new Set([currentUser?.id, currentUser?.profileId].filter(Boolean))
    return (t) => ids.has(t.assigneeId) || ids.has(t.createdBy)
  }, [currentUser])
  const baseList = useMemo(
    () => {
      const visible = tasks.filter(t =>
        t.productionId ||
        t.visibility !== TASK_VISIBILITY.PERSONAL ||
        isMineOrCreated(t)
      )
      return isCrew ? visible.filter(isMine) : visible
    },
    [tasks, isCrew, isMine, isMineOrCreated]
  )

  // Stats — computed from base list (not after filtering) so the numbers
  // mean something stable as the user tweaks chips.
  const stats = useMemo(() => {
    const overdue = baseList.filter(t =>
      t.dueDate && t.status !== TASK_STATUS.VERIFIED && isPast(parseISO(t.dueDate))
    ).length
    const mine = baseList.filter(t =>
      isMine(t) && t.status !== TASK_STATUS.VERIFIED
    ).length
    const verified = baseList.filter(t => t.status === TASK_STATUS.VERIFIED).length
    return { total: baseList.length, overdue, mine, verified }
  }, [baseList, isMine])

  // Apply chip + page-level controls
  const filtered = useMemo(() => {
    let list = baseList

    // Distribution scope: production-bound vs internal (no production).
    if (scope === 'production') list = list.filter(t => t.productionId)
    else if (scope === 'internal') list = list.filter(t => !t.productionId)

    switch (filter) {
      case 'mine':
        list = list.filter(t =>
          isMine(t) && t.status !== TASK_STATUS.VERIFIED
        )
        break
      case 'overdue':
        list = list.filter(t =>
          t.dueDate && t.status !== TASK_STATUS.VERIFIED && isPast(parseISO(t.dueDate))
        )
        break
      case 'pending':
        list = list.filter(t =>
          t.status === TASK_STATUS.COMPLETE || t.status === TASK_STATUS.NEEDS_REVIEW
        )
        break
      case 'verified':
        list = list.filter(t => t.status === TASK_STATUS.VERIFIED)
        break
      case 'all':
      default:
        break
    }

    // Search across title + description (case-insensitive)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      )
    }

    // Production scope
    if (productionId !== 'all') {
      list = list.filter(t => t.productionId === productionId)
    }
    // Assignee scope (admin/sup only — crew already filtered)
    if (isAdmin && assigneeId !== 'all') {
      list = list.filter(t => t.assigneeId === assigneeId)
    }

    // Sort. Open work ALWAYS stacks above completed/verified, whatever the
    // secondary sort — done items sink to the bottom (Danny's report).
    const doneRank = (t) =>
      (t.status === TASK_STATUS.COMPLETE || t.status === TASK_STATUS.VERIFIED) ? 1 : 0
    return list.slice().sort((a, b) => {
      const d = doneRank(a) - doneRank(b)
      if (d !== 0) return d
      switch (sortBy) {
        case 'dueAsc':
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate) - new Date(b.dueDate)
        case 'dueDesc':
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(b.dueDate) - new Date(a.dueDate)
        case 'priority':
          return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
        case 'status':
          return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        default:
          return 0
      }
    })
  }, [baseList, filter, scope, search, productionId, assigneeId, sortBy, isMine, isAdmin])

  // Production picker — only productions that actually have tasks (skip the
  // empty options so the dropdown isn't a wall of unrelated names).
  const productionsWithTasks = useMemo(() => {
    const ids = new Set(baseList.map(t => t.productionId))
    return productions
      .filter(p => ids.has(p.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [productions, baseList])

  // Assignee picker — only people who actually have tasks in the base list
  const assigneesWithTasks = useMemo(() => {
    const ids = new Set(baseList.map(t => t.assigneeId).filter(Boolean))
    return users.filter(u => ids.has(u.id))
  }, [baseList, users])

  // Crew cannot see the "pending verification" filter — it's an admin concern.
  const availableFilters = Object.entries(FILTERS).filter(([key]) => {
    if (isCrew && key === 'pending') return false
    return true
  })

  return (
    <div>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-8 py-5 lg:py-8">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="hud-label mb-1">PRODUCTION WORK</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">Tasks</h1>
          </div>
          <div className="flex items-center gap-3">
            {search || productionId !== 'all' || assigneeId !== 'all' ? (
              <button
                onClick={() => { setSearch(''); setProductionId('all'); setAssigneeId('all') }}
                className="text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
              >
                Clear filters
              </button>
            ) : null}
            {isAdmin && (
              <button onClick={openNewTask} className="btn-primary">
                <Plus size={15} /> New Task
              </button>
            )}
          </div>
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 mb-5"
          style={{ border: '1px solid var(--orbital-border)', borderRight: 'none' }}
        >
          <StatCell label="TOTAL"    value={stats.total}    icon={ListTodo}      color="var(--orbital-subtle)" />
          <StatCell label="OVERDUE"  value={stats.overdue}  icon={AlertTriangle} color={stats.overdue > 0 ? '#ef4444' : 'var(--orbital-subtle)'} />
          <StatCell label="MINE"     value={stats.mine}     icon={CheckSquare}   color="#a78bfa" />
          <StatCell label="VERIFIED" value={stats.verified} icon={CheckCheck}    color="#22c55e" />
        </div>

        {/* ── Quick add (the keeper from the To-Dos merge) — rapid internal
                entry; the full New Task modal handles production work. ── */}
        <div className="mb-3">
          <QuickAdd
            currentUser={currentUser}
            roster={users}
            onAdd={(payload) => addTask(createTask({
              ...payload,
              productionId: '',
              createdBy: currentUser?.profileId || currentUser?.id || '',
            }))}
          />
        </div>

        {/* ── Distribution scope: everything / production work / internal ── */}
        <div className="flex gap-2 mb-3">
          {[['all', 'All work'], ['production', 'Production'], ['internal', 'Internal']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              className={clsx(
                'px-3 py-2 lg:py-1.5 rounded-lg text-xs font-medium transition-colors',
                scope === key
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40'
                  : 'bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-orbital-text'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Search + scope controls ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle pointer-events-none" />
            <input
              className="input pl-9"
              placeholder="Search title or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {productionsWithTasks.length > 1 && (
              <ScopeSelect
                icon={Film}
                value={productionId}
                onChange={setProductionId}
                options={[
                  { value: 'all', label: 'All productions' },
                  ...productionsWithTasks.map(p => ({ value: p.id, label: p.name })),
                ]}
              />
            )}
            {isAdmin && assigneesWithTasks.length > 1 && (
              <ScopeSelect
                icon={User}
                value={assigneeId}
                onChange={setAssigneeId}
                options={[
                  { value: 'all', label: 'All assignees' },
                  ...assigneesWithTasks.map(u => ({ value: u.id, label: u.name })),
                ]}
              />
            )}
            <ScopeSelect
              icon={ArrowUpDown}
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS.map(s => ({ value: s.id, label: s.label }))}
            />
          </div>
        </div>

        {/* ── Filter chips ───────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-3 sm:-mx-4 px-3 sm:px-4 lg:mx-0 lg:px-0">
          {availableFilters.map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2.5 lg:py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors active:scale-[0.97]',
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-orbital-text'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ── List ────────────────────────────────────────────────────── */}
        {tasksLoading && filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-indicator-pulse" />
            <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">
              LOADING TASKS
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks to show"
            description={
              search             ? `Nothing matches "${search}".` :
              filter === 'mine'    ? 'You have no active tasks right now.' :
              filter === 'overdue' ? 'Nothing overdue — clean slate.' :
              filter === 'pending' ? 'No tasks awaiting verification.' :
              filter === 'verified'? 'No verified tasks yet.' :
              'No tasks in the system.'
            }
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-orbital-dim font-telemetry tracking-wider mb-2">
              SHOWING {filtered.length} OF {stats.total}
            </p>
            {filtered.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                productionId={task.productionId}
                showProduction
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Task modal — the form defaults to Internal; the "For"
              dropdown inside it switches to a production ──────────────────── */}
      <Modal open={showNewTask} onClose={closeNewTask} title="New Task" size="lg">
        {showNewTask && <TaskForm productionId={newTaskProdId} onClose={closeNewTask} />}
      </Modal>
    </div>
  )
}

// ── Small components ────────────────────────────────────────────────────────

function StatCell({ label, value, icon: Icon, color }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: 'var(--orbital-surface)', borderRight: '1px solid var(--orbital-border)' }}
    >
      <Icon size={14} style={{ color, opacity: 0.8 }} className="flex-shrink-0" />
      <div>
        <p className="text-xl font-bold leading-none font-mono" style={{ color }}>
          {String(value).padStart(2, '0')}
        </p>
        <p className="text-[11px] text-orbital-subtle mt-0.5 tracking-wider font-telemetry">{label}</p>
      </div>
    </div>
  )
}

function ScopeSelect({ icon: Icon, value, onChange, options }) {
  return (
    <div className="relative">
      <Icon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orbital-subtle pointer-events-none" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs pl-7 pr-3 py-2 bg-orbital-surface border border-orbital-border text-orbital-text rounded appearance-none cursor-pointer hover:border-orbital-chrome transition-colors"
        style={{ minWidth: 140 }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
