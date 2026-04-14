import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { TASK_PRIORITY, USERS, createTask } from '../../data/models.js'

export function TaskForm({ productionId, initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()

  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    assigneeId: initial?.assigneeId || '',
    dueDate: initial?.dueDate || '',
    priority: initial?.priority || TASK_PRIORITY.MEDIUM,
    expectationsNote: initial?.expectationsNote || '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const task = createTask({
      ...(initial || {}),
      productionId,
      title: form.title,
      description: form.description,
      assigneeId: form.assigneeId,
      assignedBy: initial?.assignedBy || currentUser?.id,
      dueDate: form.dueDate,
      priority: form.priority,
      expectationsNote: form.expectationsNote,
    })
    onSubmit(task)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Task Title *</label>
        <input
          className="input"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. LED Wall Pre-Calibration"
          required
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
          <label className="label">Assign To *</label>
          <select
            className="select"
            value={form.assigneeId}
            onChange={e => set('assigneeId', e.target.value)}
            required
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">
          {initial?.id ? 'Save Task' : 'Create Task'}
        </button>
      </div>
    </form>
  )
}
