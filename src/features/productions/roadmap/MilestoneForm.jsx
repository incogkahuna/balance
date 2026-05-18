import { useState, useMemo, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { X, Check, Loader2, AlertCircle } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { useAutoSave } from '../../../hooks/useAutoSave.js'
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

export function MilestoneForm({ production, initial, onClose }) {
  const { currentUser, addMilestone, updateMilestone, deleteMilestone } = useApp()
  const team = useProductionTeam(production)

  // Eager-create flow: if there's no `initial`, we create a placeholder
  // milestone the moment this form mounts so subsequent edits can save
  // through updateMilestone. The working milestone's id is tracked in a ref
  // so the auto-save effect always targets the latest one.
  //
  // This means the moment you click "+ Add Milestone", an empty row appears
  // in the roadmap. If you close the form without typing a title we delete
  // that row so empty milestones don't accumulate.
  const workingIdRef = useRef(initial?.id || null)
  const createdHereRef = useRef(false)

  useEffect(() => {
    if (initial?.id || workingIdRef.current) return
    const placeholder = createMilestone({
      title: '',
      date: '',
      type: MILESTONE_TYPE.PRE_PRODUCTION,
      status: MILESTONE_STATUS.UPCOMING,
      createdBy: currentUser?.id,
    })
    workingIdRef.current = placeholder.id
    createdHereRef.current = true
    addMilestone(production.id, placeholder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [form, setForm] = useState({
    title:       initial?.title || '',
    date:        initial?.date  || '',
    type:        initial?.type  || MILESTONE_TYPE.PRE_PRODUCTION,
    description: initial?.description || '',
    ownerId:     initial?.ownerId || '',
    status:      initial?.status || MILESTONE_STATUS.UPCOMING,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // 600ms debounce. Each save targets workingIdRef.current via updateMilestone.
  // The hook bails (returns 'idle') if `enabled` is false — we only enable it
  // once the placeholder has been created, so we don't race the addMilestone
  // call above.
  const enabled = !!workingIdRef.current
  const { status: saveStatus, lastSavedAt, error: saveError } = useAutoSave(
    form,
    (value) => {
      const id = workingIdRef.current
      if (!id) return
      updateMilestone(production.id, id, value)
    },
    { enabled, delay: 600 }
  )

  // ── Close behaviour ───────────────────────────────────────────────────────
  // If the user closes without ever typing a title AND we created the
  // milestone on mount (vs editing an existing one), clean it up so empty
  // rows don't pile up in the roadmap.
  const handleClose = () => {
    const id = workingIdRef.current
    if (id && createdHereRef.current && !form.title.trim()) {
      deleteMilestone(production.id, id)
    }
    onClose?.()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={handleClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-orbital-surface border-t border-orbital-border rounded-t-2xl max-h-[92vh] flex flex-col lg:inset-auto lg:fixed lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[520px] lg:max-h-[90vh] lg:rounded-xl lg:border">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-orbital-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-orbital-text">
              {initial ? 'Edit Milestone' : 'Add Milestone'}
            </h3>
            <SaveStatus status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} />
          </div>
          <button onClick={handleClose} className="p-1.5 rounded hover:bg-orbital-muted transition-colors">
            <X size={16} className="text-orbital-subtle" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          <div>
            <label className="label">Milestone Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. LED Wall Delivery, First Day of Shoot"
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
            <button type="button" onClick={handleClose} className="btn-primary flex-1">
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Save status pill — telemetric chip next to the modal title ──────────────
function SaveStatus({ status, lastSavedAt, error }) {
  let icon, label, color, bg, border
  if (status === 'saving') {
    icon = <Loader2 size={10} className="animate-spin" />
    label = 'SAVING'
    color = '#fbbf24'
    bg = 'rgba(251,191,36,0.1)'
    border = 'rgba(251,191,36,0.3)'
  } else if (status === 'error') {
    icon = <AlertCircle size={10} />
    label = 'SAVE FAILED'
    color = '#ef4444'
    bg = 'rgba(239,68,68,0.1)'
    border = 'rgba(239,68,68,0.3)'
  } else if (status === 'saved' && lastSavedAt) {
    icon = <Check size={10} />
    label = `SAVED ${format(lastSavedAt, 'HH:mm:ss')}`
    color = '#34d399'
    bg = 'rgba(52,211,153,0.1)'
    border = 'rgba(52,211,153,0.3)'
  } else {
    icon = <Check size={10} className="opacity-40" />
    label = 'AUTO-SAVE'
    color = 'var(--orbital-subtle)'
    bg = 'transparent'
    border = 'var(--orbital-border)'
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 font-telemetry text-[9px] tracking-wider"
      style={{ color, background: bg, border: `1px solid ${border}` }}
      title={error || ''}
    >
      {icon}
      <span>{label}</span>
    </span>
  )
}
