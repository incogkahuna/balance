import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Users as UsersIcon, Lock } from 'lucide-react'
import { TASK_VISIBILITY } from '../../data/models.js'
import clsx from 'clsx'

// ── QuickAdd — single-line rapid entry for internal tasks ────────────────────
// The keeper feature from the old To-Dos page (tasks/to-dos merge): type,
// Enter, done. Creates a freestanding task (no production); date/assignee/
// visibility stay sticky between adds so "add five things for today" flows.
export function QuickAdd({ onAdd, currentUser, roster }) {
  const [title, setTitle]           = useState('')
  const [dueDate, setDueDate]       = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [assigneeId, setAssigneeId] = useState(currentUser?.id || '')
  const [visibility, setVisibility] = useState(TASK_VISIBILITY.TEAM)
  const [expanded, setExpanded]     = useState(false)

  // Assignee roster: the app's merged roster (real profiles deduped against
  // the legacy list), so each person appears once.
  const meId = roster.some(r => r.id === currentUser?.profileId)
    ? currentUser?.profileId
    : currentUser?.id

  const canAdd = title.trim().length > 0

  const submit = () => {
    if (!canAdd) return
    onAdd({
      title:      title.trim(),
      dueDate,
      assigneeId,
      visibility,
    })
    // Reset for the next entry — keep date + assignee + visibility sticky.
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
          placeholder="Quick add — internal work, not tied to a production (Enter to add)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          onFocus={() => setExpanded(true)}
        />
        <button
          onClick={submit}
          disabled={!canAdd}
          className="btn-primary"
          title={canAdd ? 'Add task (Enter)' : 'Type a title'}
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* Options — date / assignee / visibility. Shown while the input has
          focus so the defaults are visible; collapsible if noisy. */}
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
            {roster.map(u => (
              <option key={u.id} value={u.id}>
                {u.id === meId ? `${u.name} (me)` : u.name}
              </option>
            ))}
          </select>

          <span className="mx-1 text-orbital-dim">·</span>

          <div className="inline-flex">
            <button
              type="button"
              onClick={() => setVisibility(TASK_VISIBILITY.TEAM)}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 text-[11px] border-y border-l',
                visibility === TASK_VISIBILITY.TEAM
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/45'
                  : 'text-orbital-subtle border-orbital-border hover:text-orbital-text'
              )}
            >
              <UsersIcon size={10} /> Team
            </button>
            <button
              type="button"
              onClick={() => setVisibility(TASK_VISIBILITY.PERSONAL)}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 text-[11px] border',
                visibility === TASK_VISIBILITY.PERSONAL
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/45'
                  : 'text-orbital-subtle border-orbital-border hover:text-orbital-text'
              )}
            >
              <Lock size={10} /> Personal
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
