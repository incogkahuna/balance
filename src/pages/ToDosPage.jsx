import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import {
  Check, Circle, Plus, Send, X, Trash2, Users as UsersIcon, Lock,
  Calendar as CalIcon, AlertTriangle, CheckCircle2, Edit3,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  USERS, TODO_STATUS, TODO_VISIBILITY, createToDo,
} from '../data/models.js'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import clsx from 'clsx'

// ─────────────────────────────────────────────────────────────────────────────
// ToDosPage — daily-scoped work items, separate from production-bound Tasks.
// Anyone can create. Shared by default (whole salary roster sees them); flip
// to Direct to make a private item only the creator + assignee can see.
// ─────────────────────────────────────────────────────────────────────────────

export function ToDosPage() {
  const { currentUser, todos, addToDo, updateToDo, deleteToDo } = useApp()

  // ── Filter chip (Mine / Created by me / Shared / All) ──
  const [scopeFilter, setScopeFilter] = useState('mine')

  // ── Visibility-aware base list ──
  // Anyone with a profile sees SHARED todos. DIRECT todos are visible only to
  // the creator + assignee. This mirrors what Supabase RLS would do once
  // todos move off localStorage.
  const visible = useMemo(() => {
    if (!currentUser) return []
    return todos.filter(t => {
      if (t.visibility === TODO_VISIBILITY.SHARED) return true
      return t.createdBy === currentUser.id || t.assigneeId === currentUser.id
    })
  }, [todos, currentUser])

  // Scope filter on top of visibility
  const scoped = useMemo(() => {
    switch (scopeFilter) {
      case 'mine':       return visible.filter(t => t.assigneeId === currentUser?.id)
      case 'created':    return visible.filter(t => t.createdBy   === currentUser?.id)
      case 'shared':     return visible.filter(t => t.visibility  === TODO_VISIBILITY.SHARED)
      case 'all':
      default:           return visible
    }
  }, [visible, scopeFilter, currentUser])

  // ── Bucketise into Overdue / Today / Tomorrow / Later / No date / Done ──
  const buckets = useMemo(() => {
    const out = { overdue: [], today: [], tomorrow: [], later: [], nodate: [], done: [] }
    for (const t of scoped) {
      if (t.status === TODO_STATUS.DONE || t.status === TODO_STATUS.CANCELLED) {
        out.done.push(t); continue
      }
      if (!t.dueDate) { out.nodate.push(t); continue }
      const d = parseISO(t.dueDate)
      if (isPast(d) && !isToday(d))   out.overdue.push(t)
      else if (isToday(d))            out.today.push(t)
      else if (isTomorrow(d))         out.tomorrow.push(t)
      else                            out.later.push(t)
    }
    // Sort each bucket by due date asc, then createdAt desc
    const sortFn = (a, b) => {
      const dateCmp = (a.dueDate || '').localeCompare(b.dueDate || '')
      if (dateCmp !== 0) return dateCmp
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    }
    Object.keys(out).forEach(k => out[k].sort(sortFn))
    return out
  }, [scoped])

  // ── Stats strip (computed from VISIBLE — not scoped, so the numbers stay
  // stable as the user tweaks chips). ──
  const stats = useMemo(() => {
    const mine     = visible.filter(t => t.assigneeId === currentUser?.id && t.status === TODO_STATUS.OPEN)
    const overdue  = mine.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)))
    const today    = mine.filter(t => t.dueDate && isToday(parseISO(t.dueDate)))
    const doneToday = visible.filter(t => {
      if (t.status !== TODO_STATUS.DONE) return false
      if (!t.completedAt) return false
      try { return isToday(parseISO(t.completedAt)) } catch { return false }
    })
    return {
      mineTotal: mine.length,
      overdue:   overdue.length,
      today:     today.length,
      doneToday: doneToday.length,
    }
  }, [visible, currentUser])

  // ── Inline quick-add bar ──
  const handleQuickAdd = (payload) => {
    addToDo(createToDo({
      ...payload,
      createdBy: currentUser?.id || '',
    }))
  }

  // ── Done toggle ──
  const toggleDone = (todo) => {
    if (todo.status === TODO_STATUS.DONE) {
      updateToDo(todo.id, { status: TODO_STATUS.OPEN, completedAt: '' })
    } else {
      updateToDo(todo.id, { status: TODO_STATUS.DONE, completedAt: new Date().toISOString() })
    }
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
        {/* Header */}
        <div className="mb-4">
          <p className="hud-label mb-1">DAILY OPS</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">
            To-Dos
          </h1>
          <p className="text-sm text-orbital-subtle mt-0.5">
            Daily work that isn&apos;t tied to a production. Shared with the team by default — flip to <em>Direct</em> for a private item only you and one teammate see.
          </p>
        </div>

        {/* Stats strip */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 mb-4"
          style={{ border: '1px solid var(--orbital-border)', borderRight: 'none' }}
        >
          <StatCell label="MINE OPEN"  value={stats.mineTotal} color="var(--orbital-subtle)" />
          <StatCell label="OVERDUE"    value={stats.overdue}   color={stats.overdue > 0 ? '#ef4444' : 'var(--orbital-subtle)'} />
          <StatCell label="TODAY"      value={stats.today}     color="#a78bfa" />
          <StatCell label="DONE TODAY" value={stats.doneToday} color="#22c55e" />
        </div>

        {/* Quick-add */}
        <QuickAdd onAdd={handleQuickAdd} currentUser={currentUser} />

        {/* Scope chips */}
        <div className="flex gap-1 mt-4 mb-4 flex-wrap">
          {[
            { id: 'mine',    label: 'Mine' },
            { id: 'created', label: 'Created by me' },
            { id: 'shared',  label: 'Shared' },
            { id: 'all',     label: 'All' },
          ].map(s => {
            const active = scopeFilter === s.id
            return (
              <button
                key={s.id}
                onClick={() => setScopeFilter(s.id)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium border transition-colors',
                  active
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/45'
                    : 'text-orbital-subtle hover:text-orbital-text border-orbital-border hover:bg-orbital-muted'
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Buckets */}
        {scoped.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <CheckCircle2 size={28} className="mx-auto text-orbital-dim mb-2" />
            <p className="text-sm text-orbital-text font-medium">Nothing in this view.</p>
            <p className="text-xs text-orbital-subtle mt-1">Drop something in the quick-add above.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {buckets.overdue.length > 0 && (
              <Bucket label="Overdue" accent="#ef4444" todos={buckets.overdue} onToggle={toggleDone} onUpdate={updateToDo} onDelete={deleteToDo} currentUser={currentUser} />
            )}
            {buckets.today.length > 0 && (
              <Bucket label="Today" accent="#60a5fa" todos={buckets.today} onToggle={toggleDone} onUpdate={updateToDo} onDelete={deleteToDo} currentUser={currentUser} />
            )}
            {buckets.tomorrow.length > 0 && (
              <Bucket label="Tomorrow" accent="#a78bfa" todos={buckets.tomorrow} onToggle={toggleDone} onUpdate={updateToDo} onDelete={deleteToDo} currentUser={currentUser} />
            )}
            {buckets.later.length > 0 && (
              <Bucket label="Later" accent="var(--orbital-subtle)" todos={buckets.later} onToggle={toggleDone} onUpdate={updateToDo} onDelete={deleteToDo} currentUser={currentUser} />
            )}
            {buckets.nodate.length > 0 && (
              <Bucket label="No date" accent="var(--orbital-dim)" todos={buckets.nodate} onToggle={toggleDone} onUpdate={updateToDo} onDelete={deleteToDo} currentUser={currentUser} />
            )}
            {buckets.done.length > 0 && (
              <Bucket label="Done" accent="#22c55e" todos={buckets.done} onToggle={toggleDone} onUpdate={updateToDo} onDelete={deleteToDo} currentUser={currentUser} collapsible defaultCollapsed />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── StatCell ────────────────────────────────────────────────────────────────
function StatCell({ label, value, color }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: 'var(--orbital-surface)', borderRight: '1px solid var(--orbital-border)' }}
    >
      <div>
        <p className="text-xl font-bold leading-none font-mono" style={{ color }}>
          {String(value).padStart(2, '0')}
        </p>
        <p className="text-[11px] text-orbital-subtle mt-0.5 tracking-wider font-telemetry">{label}</p>
      </div>
    </div>
  )
}

// ── QuickAdd — single-line input with assignee + due-date + visibility ─────
function QuickAdd({ onAdd, currentUser }) {
  const [title, setTitle]           = useState('')
  const [dueDate, setDueDate]       = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [assigneeId, setAssigneeId] = useState(currentUser?.id || '')
  const [visibility, setVisibility] = useState(TODO_VISIBILITY.SHARED)
  const [expanded, setExpanded]     = useState(false)

  const canAdd = title.trim().length > 0

  const submit = () => {
    if (!canAdd) return
    onAdd({
      title:      title.trim(),
      dueDate,
      assigneeId,
      visibility,
    })
    // Reset for the next entry — keep date + assignee + visibility sticky
    // so rapid-fire entry feels natural ("add five things for today")
    setTitle('')
  }

  return (
    <div
      className="card-elevated p-3"
      style={{ border: '1px solid var(--orbital-border)' }}
    >
      <div className="flex gap-2 items-center">
        <input
          className="input flex-1"
          placeholder="What needs to happen? (e.g. Grab lunch for crew, Drop off truck)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          onFocus={() => setExpanded(true)}
        />
        <button
          onClick={submit}
          disabled={!canAdd}
          className="btn-primary"
          title={canAdd ? 'Add to-do (Enter)' : 'Type a title'}
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* Quick-add options — date / assignee / visibility. Shown by default
          when the input has focus so the user knows the defaults; collapsible
          via the chevron if it's noisy. */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
          <label className="text-[10px] text-orbital-dim font-telemetry tracking-wider">DUE</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="text-xs px-2 py-1 bg-orbital-surface border border-orbital-border text-orbital-text rounded"
          />
          <button
            type="button"
            onClick={() => setDueDate('')}
            className="text-[11px] text-orbital-subtle hover:text-orbital-text"
            title="Clear due date"
          >
            no date
          </button>

          <span className="mx-1 text-orbital-dim">·</span>

          <label className="text-[10px] text-orbital-dim font-telemetry tracking-wider">FOR</label>
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className="text-xs px-2 py-1 bg-orbital-surface border border-orbital-border text-orbital-text rounded"
          >
            {USERS.map(u => (
              <option key={u.id} value={u.id}>
                {u.id === currentUser?.id ? `${u.name} (me)` : u.name}
              </option>
            ))}
          </select>

          <span className="mx-1 text-orbital-dim">·</span>

          <div className="inline-flex">
            <button
              type="button"
              onClick={() => setVisibility(TODO_VISIBILITY.SHARED)}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 text-[11px] border-y border-l',
                visibility === TODO_VISIBILITY.SHARED
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/45'
                  : 'text-orbital-subtle border-orbital-border hover:text-orbital-text'
              )}
            >
              <UsersIcon size={10} /> Shared
            </button>
            <button
              type="button"
              onClick={() => setVisibility(TODO_VISIBILITY.DIRECT)}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 text-[11px] border',
                visibility === TODO_VISIBILITY.DIRECT
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/45'
                  : 'text-orbital-subtle border-orbital-border hover:text-orbital-text'
              )}
            >
              <Lock size={10} /> Direct
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-auto text-[11px] text-orbital-dim hover:text-orbital-subtle"
          >
            hide options
          </button>
        </div>
      )}
    </div>
  )
}

// ── Bucket ──────────────────────────────────────────────────────────────────
function Bucket({ label, accent, todos, onToggle, onUpdate, onDelete, currentUser, collapsible = false, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-3" style={{ background: accent }} />
        <h2 className="hud-label">{label}</h2>
        <span className="text-[10px] text-orbital-dim font-mono tabular-nums">{todos.length}</span>
        {collapsible && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-[11px] text-orbital-dim hover:text-orbital-subtle"
          >
            {collapsed ? 'show' : 'hide'}
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="space-y-1.5">
          {todos.map(t => (
            <ToDoRow
              key={t.id}
              todo={t}
              currentUser={currentUser}
              onToggle={() => onToggle(t)}
              onUpdate={(patch) => onUpdate(t.id, patch)}
              onDelete={() => onDelete(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ToDoRow ─────────────────────────────────────────────────────────────────
function ToDoRow({ todo, currentUser, onToggle, onUpdate, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isDone     = todo.status === TODO_STATUS.DONE
  const isOverdue  = !isDone && todo.dueDate && isPast(parseISO(todo.dueDate)) && !isToday(parseISO(todo.dueDate))
  const assignee   = USERS.find(u => u.id === todo.assigneeId)
  const creator    = USERS.find(u => u.id === todo.createdBy)
  const isCreator  = todo.createdBy === currentUser?.id
  const isAssignee = todo.assigneeId === currentUser?.id
  const canModify  = isCreator || isAssignee   // either side can mark done
  const canDelete  = isCreator                  // only creator can delete

  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(todo.title)

  const saveTitle = () => {
    setEditingTitle(false)
    if (draftTitle.trim() && draftTitle.trim() !== todo.title) {
      onUpdate({ title: draftTitle.trim() })
    } else {
      setDraftTitle(todo.title)
    }
  }

  return (
    <div
      className="card-elevated px-3 py-2 flex items-center gap-3"
      style={{
        borderLeft: isOverdue ? '3px solid #ef4444' : '3px solid transparent',
        opacity: isDone ? 0.55 : 1,
      }}
    >
      {/* Done toggle */}
      <button
        onClick={onToggle}
        disabled={!canModify}
        className="flex-shrink-0 transition-colors"
        style={{ color: isDone ? '#22c55e' : 'var(--orbital-subtle)' }}
        title={isDone ? 'Mark as open' : 'Mark as done'}
      >
        {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            className="input text-sm py-0.5"
            value={draftTitle}
            autoFocus
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter')  saveTitle()
              if (e.key === 'Escape') { setEditingTitle(false); setDraftTitle(todo.title) }
            }}
          />
        ) : (
          <button
            onClick={() => isCreator && setEditingTitle(true)}
            disabled={!isCreator}
            className={clsx(
              'text-sm text-left truncate w-full',
              isDone ? 'line-through text-orbital-subtle' : 'text-orbital-text',
              isCreator ? 'cursor-text hover:text-blue-400' : 'cursor-default'
            )}
            title={isCreator ? 'Click to rename' : undefined}
          >
            {todo.title}
          </button>
        )}
        <div className="flex items-center gap-2 text-[11px] text-orbital-subtle mt-0.5 flex-wrap">
          {assignee && (
            <span className="inline-flex items-center gap-1">
              <span
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: assignee.color }}
              >
                {assignee.avatar}
              </span>
              {assignee.name}
            </span>
          )}
          {todo.dueDate && (
            <span className={clsx('font-mono', isOverdue && 'text-red-400')}>
              {isToday(parseISO(todo.dueDate))    ? 'today'    :
               isTomorrow(parseISO(todo.dueDate)) ? 'tomorrow' :
               format(parseISO(todo.dueDate), 'MMM d')}
              {isOverdue && ' · overdue'}
            </span>
          )}
          {todo.visibility === TODO_VISIBILITY.DIRECT && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <Lock size={9} /> direct
            </span>
          )}
          {!isCreator && creator && (
            <span className="text-orbital-dim">from {creator.name}</span>
          )}
        </div>
      </div>

      {/* Quick edit due date (creator only) */}
      {isCreator && !isDone && (
        <input
          type="date"
          value={todo.dueDate || ''}
          onChange={e => onUpdate({ dueDate: e.target.value })}
          className="text-[11px] px-1.5 py-0.5 bg-orbital-surface border border-orbital-border text-orbital-subtle rounded flex-shrink-0"
          title="Change due date"
        />
      )}

      {/* Delete (creator only) */}
      {canDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1 rounded text-orbital-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Delete to-do"
        message={`Delete "${todo.title}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
