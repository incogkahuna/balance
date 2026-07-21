import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useAutoSave } from '../../hooks/useAutoSave.js'
import { SaveStatusPill } from '../ui/SaveStatusPill.jsx'
import { TASK_PRIORITY, TASK_STATUS, createTask } from '../../data/models.js'
import { DictationMic } from '../voice/DictationMic.tsx'

export function TaskForm({ productionId, initial, onClose }) {
  const { currentUser, addTask, updateTask, deleteTask, getProduction, users, productions } = useApp()

  // ── Purpose: Internal (default) or a production ───────────────────────────
  // Tasks default to internal use; a dropdown switches them onto a production
  // (Danny's report). When the form is opened FROM a production (detail page
  // passes productionId), that production is preselected instead.
  const [prodId, setProdId] = useState(initial?.productionId ?? productionId ?? '')
  // Cross-fill (M7 / #16): prep tasks are due by the shoot — default a new
  // task's due date to the production's start date.
  const production = prodId ? getProduction(prodId) : null

  // ── Create-on-first-title ─────────────────────────────────────────────────
  // The old eager-create pattern inserted an empty placeholder on mount, but
  // the data layer (rightly) rejects tasks without a title — so the remote
  // insert always failed, the optimistic row was rolled back, and every
  // subsequent auto-save tried to UPDATE a row that existed nowhere. Net
  // effect: form-created tasks never persisted (intake-created ones, which
  // carry a title at insert time, always did).
  //
  // Now we reserve the id up front but only CREATE once the first auto-save
  // carries a non-empty title; every save after that is an UPDATE.
  const workingIdRef = useRef(initial?.id || null)
  if (!workingIdRef.current) workingIdRef.current = crypto.randomUUID()
  const createdHereRef = useRef(false)

  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    assigneeId: initial?.assigneeId || '',
    dueDate: initial?.dueDate || (initial?.id ? '' : production?.startDate) || '',
    priority: initial?.priority || TASK_PRIORITY.MEDIUM,
    expectationsNote: initial?.expectationsNote || '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // prodId rides in the watched value so changing the purpose dropdown
  // persists like any other field (and lands on the initial create).
  const { status: saveStatus, lastSavedAt, error: saveError } = useAutoSave(
    { ...form, prodId },
    (value) => {
      const id = workingIdRef.current
      if (!id) return
      const { prodId: vProdId, ...fields } = value
      // Editing an existing task (or one we already created) — plain update.
      if (initial?.id || createdHereRef.current) {
        updateTask(id, { ...fields, productionId: vProdId || '' })
        return
      }
      // New task: wait for a title, then create with the full current form.
      if (!fields.title.trim()) return
      createdHereRef.current = true
      addTask(createTask({
        ...fields,
        id,
        // '' = internal (freestanding, M2 to-do semantics, team-visible).
        productionId: vProdId || '',
        ...(vProdId ? {} : { visibility: 'team' }),
        status: TASK_STATUS.NOT_STARTED,
        assignedBy: currentUser?.id || '',
        // Real auth UUID — satisfies the tasks.created_by FK to profiles.
        createdBy: currentUser?.profileId || '',
      }))
    },
    { delay: 600 }
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
        <label className="label">For</label>
        <select
          className="select"
          value={prodId}
          onChange={e => setProdId(e.target.value)}
        >
          <option value="">Internal use (no production)</option>
          {productions.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
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
        <div className="flex items-center justify-between">
          <label className="label">Description</label>
          <DictationMic onText={t => set('description', form.description ? `${form.description}\n${t}` : t)} />
        </div>
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
            {users.map(u => (
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
        <div className="flex items-center justify-between">
          <label className="label">Expectations Note</label>
          <DictationMic onText={t => set('expectationsNote', form.expectationsNote ? `${form.expectationsNote}\n${t}` : t)} />
        </div>
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
