import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import {
  MILESTONE_TYPE, MILESTONE_STATUS, createMilestone, USERS
} from '../../../data/models.js'

// Collects all team members (staff + contractors) for a production into one list
function useProductionTeam(production) {
  const { resolveAssignee } = useApp()
  return useMemo(() => {
    const ids = [
      ...production.assignedMembers.map(m => m.userId),
      ...(production.assignedContractors || []).map(a => a.contractorId),
      production.stageManagerId,
    ].filter(Boolean)
    // Deduplicate
    const seen = new Set()
    return ids
      .filter(id => { if (seen.has(id)) return false; seen.add(id); return true })
      .map(id => resolveAssignee(id))
      .filter(Boolean)
  }, [production, resolveAssignee])
}

export function MilestoneForm({ production, initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()
  const team = useProductionTeam(production)

  const [form, setForm] = useState({
    title:       initial?.title || '',
    date:        initial?.date  || '',
    type:        initial?.type  || MILESTONE_TYPE.PRE_PRODUCTION,
    description: initial?.description || '',
    ownerId:     initial?.ownerId || '',
    status:      initial?.status || MILESTONE_STATUS.UPCOMING,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    const milestone = createMilestone({
      ...(initial || {}),
      ...form,
      createdBy: initial?.createdBy || currentUser?.id,
    })
    onSubmit(milestone)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onCancel} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-orbital-surface border-t border-orbital-border rounded-t-2xl max-h-[92vh] flex flex-col lg:inset-auto lg:fixed lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[520px] lg:max-h-[90vh] lg:rounded-xl lg:border">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-orbital-border flex-shrink-0">
          <h3 className="font-semibold text-orbital-text">
            {initial ? 'Edit Milestone' : 'Add Milestone'}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-orbital-muted transition-colors">
            <X size={16} className="text-orbital-subtle" />
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-4">

          <div>
            <label className="label">Milestone Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. LED Wall Delivery, First Day of Shoot"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date & Time *</label>
              <input
                type="datetime-local"
                className="input"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.values(MILESTONE_TYPE).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.values(MILESTONE_STATUS).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Owner</label>
              <select className="select" value={form.ownerId} onChange={e => set('ownerId', e.target.value)}>
                <option value="">— Unassigned —</option>
                {team.map(person => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What happens on this date? What needs to be ready?"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">
              {initial ? 'Save Changes' : 'Add Milestone'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
