import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useAutoSave } from '../../hooks/useAutoSave.js'
import { SaveStatusPill } from '../ui/SaveStatusPill.jsx'
import { TASK_PRIORITY, TASK_STATUS, USERS, createTask } from '../../data/models.js'

export function TaskForm({ productionId, initial, onClose }) {
  const { currentUser, addTask, updateTask, deleteTask } = useApp()

  // ── Eager-create placeholder ──────────────────────────────────────────────
  // Add an empty task immediately so the auto-save effect has something to
  // target. If the user closes without typing a title, we drop the placeholder.
  const workingIdRef = useRef(initial?.id || null)
  const createdHereRef = useRef(false)

  useEffect(() => {
    if (initial?.id || workingIdRef.current) return
    const placeholder = createTask({
      productionId,
      title: '',
      assigneeId: '',
      priority: TASK_PRIORITY.MEDIUM,
      status: TASK_STATUS.NOT_STARTED,
      assignedBy: currentUser?.id || '',
      // Real auth UUID — satisfies the tasks.created_by FK to profiles.
      createdBy: currentUser?.profileId || '',
    })
    workingIdRef.current = placeholder.id
    createdHereRef.current = true
    addTask(placeholder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    assigneeId: initial?.assigneeId || '',
    dueDate: initial?.dueDate || '',
    priority: initial?.priority || TASK_PRIORITY.MEDIUM,
    expectationsNote: initial?.expectationsNote || '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const enabled = !!workingIdRef.current
  const { status: saveStatus, lastSavedAt, error: saveError } = useAutoSave(
    form,
    (value) => {
      const id = workingIdRef.current
      if (!id) return
      updateTask(id, value)
    },
    { enabled, delay: 600 }
  )

  // Close: drop placeholder if no title typed
  const handleClose = () => {
    const id = workingIdRef.current
    if (id && createdHereRef.current && !form.title.trim()) {
      deleteTask(id)
    }
    onClose?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <SaveStatusPill status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} compact />
      </div>

      <div>
        <label className="label">Task Title *</label>
        <input
          className="input"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. LED Wall Pre-Calibration"
          autoFocus
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="What needs to be done, how, and any key details..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Assign To</label>
          <select
            className="select"
            value={form.assigneeId}
            onChange={e => set('assigneeId', e.target.value)}
          >
            <option value="">Select person</option>
            {USERS.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due Date</label>
          <input
            type="date"
            className="input"
            value={form.dueDate}
            onChange={e => set('dueDate', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Priority</label>
        <div className="flex gap-2 flex-wrap">
          {Object.values(TASK_PRIORITY).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => set('priority', p)}
              className={`px-4 py-2.5 lg:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                form.priority === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-orbital-text'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Expectations Note</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.expectationsNote}
          onChange={e => set('expectationsNote', e.target.value)}
          placeholder="What you need, why it matters, any context the assignee should know..."
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={handleClose} className="btn-primary flex-1">
          Done
        </button>
      </div>
    </div>
  )
}
