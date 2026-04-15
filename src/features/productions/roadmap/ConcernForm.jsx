import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import {
  CONCERN_CATEGORY, CONCERN_IMPACT, CONCERN_STATUS, createLogisticalConcern
} from '../../../data/models.js'

function useProductionTeam(production) {
  const { resolveAssignee } = useApp()
  return useMemo(() => {
    const ids = [
      ...production.assignedMembers.map(m => m.userId),
      ...(production.assignedContractors || []).map(a => a.contractorId),
      production.stageManagerId,
    ].filter(Boolean)
    const seen = new Set()
    return ids
      .filter(id => { if (seen.has(id)) return false; seen.add(id); return true })
      .map(id => resolveAssignee(id))
      .filter(Boolean)
  }, [production, resolveAssignee])
}

export function ConcernForm({ production, initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()
  const team = useProductionTeam(production)

  const [form, setForm] = useState({
    title:          initial?.title          || '',
    category:       initial?.category       || CONCERN_CATEGORY.OTHER,
    description:    initial?.description    || '',
    impactLevel:    initial?.impactLevel    || CONCERN_IMPACT.MEDIUM,
    actionRequired: initial?.actionRequired || '',
    ownerId:        initial?.ownerId        || '',
    dueDate:        initial?.dueDate        || '',
    status:         initial?.status         || CONCERN_STATUS.OPEN,
    resolutionNotes:initial?.resolutionNotes|| '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isResolved = form.status === CONCERN_STATUS.RESOLVED

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const concern = createLogisticalConcern({
      ...(initial || {}),
      ...form,
      createdBy: initial?.createdBy || currentUser?.id,
    })
    onSubmit(concern)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onCancel} />

      <div className="fixed inset-x-0 bottom-0 z-50 bg-orbital-surface border-t border-orbital-border rounded-t-2xl max-h-[92vh] flex flex-col lg:inset-auto lg:fixed lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[540px] lg:max-h-[90vh] lg:rounded-xl lg:border">

        <div className="flex items-center justify-between p-4 border-b border-orbital-border flex-shrink-0">
          <h3 className="font-semibold text-orbital-text">
            {initial ? 'Edit Concern' : 'Add Logistical Concern'}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-orbital-muted transition-colors">
            <X size={16} className="text-orbital-subtle" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-4">

          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Generator Power Requirements, Transport of LED Panels"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.values(CONCERN_CATEGORY).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Impact Level</label>
              <select className="select" value={form.impactLevel} onChange={e => set('impactLevel', e.target.value)}>
                {Object.values(CONCERN_IMPACT).map(i => (
                  <option key={i} value={i}>{i}</option>
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
              placeholder="Detailed notes on the concern..."
            />
          </div>

          <div>
            <label className="label">Action Required</label>
            <textarea
              className="input min-h-[60px] resize-y"
              value={form.actionRequired}
              onChange={e => set('actionRequired', e.target.value)}
              placeholder="What specifically needs to happen to resolve or mitigate this?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Owner</label>
              <select className="select" value={form.ownerId} onChange={e => set('ownerId', e.target.value)}>
                <option value="">— Unassigned —</option>
                {team.map(person => (
                  <option key={person.id} value={person.id}>{person.name}</option>
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
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.values(CONCERN_STATUS).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {isResolved && (
            <div>
              <label className="label">Resolution Notes</label>
              <textarea
                className="input min-h-[60px] resize-y"
                value={form.resolutionNotes}
                onChange={e => set('resolutionNotes', e.target.value)}
                placeholder="How was this resolved?"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">
              {initial ? 'Save Changes' : 'Add Concern'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
