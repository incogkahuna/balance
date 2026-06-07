import { useState, useMemo, useEffect, useRef } from 'react'
import { X, Users as UsersIcon } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { useAutoSave } from '../../../hooks/useAutoSave.js'
import { SaveStatusPill } from '../../../components/ui/SaveStatusPill.jsx'
import {
  MILESTONE_TYPE, MILESTONE_STATUS, TASK_PRIORITY, TASK_STATUS,
  createMilestone, createTask, USERS,
} from '../../../data/models.js'

// Selectable people for milestone owner / participant lookups. Per Danny:
// the entire salary roster should be eligible regardless of whether they're
// explicitly assigned to this production — milestones often need owners
// from outside the production team. Contractors on THIS production are
// layered in afterward since they're production-specific additions rather
// than always-on-the-roster.
function useProductionTeam(production) {
  const { resolveAssignee } = useApp()
  return useMemo(() => {
    const result = [...USERS]
    const seen = new Set(USERS.map(u => u.id))
    const contractorIds = [
      ...(production.assignedContractors || []).map(a => a.contractorId),
      production.stageManagerId,
    ].filter(Boolean)
    for (const cid of contractorIds) {
      if (seen.has(cid)) continue
      const c = resolveAssignee(cid)
      if (c) { result.push(c); seen.add(cid) }
    }
    return result
  }, [production, resolveAssignee])
}

export function MilestoneForm({ production, initial, onClose }) {
  const { currentUser, addMilestone, updateMilestone, deleteMilestone, addTask } = useApp()
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
    title:          initial?.title || '',
    date:           initial?.date  || '',
    type:           initial?.type  || MILESTONE_TYPE.PRE_PRODUCTION,
    description:    initial?.description || '',
    ownerId:        initial?.ownerId || '',
    participantIds: initial?.participantIds || [],
    status:         initial?.status || MILESTONE_STATUS.UPCOMING,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleParticipant = (id) => {
    setForm(f => {
      const has = f.participantIds.includes(id)
      return {
        ...f,
        participantIds: has
          ? f.participantIds.filter(x => x !== id)
          : [...f.participantIds, id],
      }
    })
  }

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

  // ── Auto-create tasks when team members get assigned ──────────────────────
  // Track who's already had a task created during this form session so we
  // don't double-create on every keystroke. Initial assignees (loaded with
  // an existing milestone) are seeded in so we don't generate retroactive
  // tasks for people already on the record.
  const assigneesWithTasksRef = useRef(new Set([
    ...(initial?.ownerId ? [initial.ownerId] : []),
    ...(initial?.participantIds || []),
  ]))

  useEffect(() => {
    if (!workingIdRef.current) return
    const assigned = [form.ownerId, ...form.participantIds].filter(Boolean)
    for (const personId of assigned) {
      if (assigneesWithTasksRef.current.has(personId)) continue
      assigneesWithTasksRef.current.add(personId)
      const person = team.find(p => p.id === personId)
      const milestoneLabel = form.title.trim() || 'Untitled milestone'
      const task = createTask({
        productionId: production.id,
        title:        `Milestone: ${milestoneLabel}`,
        description:  person
          ? `Auto-created when ${person.name} was assigned to the milestone.`
          : 'Auto-created from milestone assignment.',
        assigneeId:   personId,
        assignedBy:   currentUser?.id || '',
        dueDate:      form.date ? form.date.slice(0, 10) : '',
        priority:     TASK_PRIORITY.MEDIUM,
        status:       TASK_STATUS.NOT_STARTED,
      })
      addTask(task)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ownerId, form.participantIds, form.title, form.date])

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
            <SaveStatusPill status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} compact />
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

          {/* Participants — two-section roster: AVAILABLE / ASSIGNED.
              Shows the entire salary team (USERS) regardless of whether each
              person is on this production, so milestone owners can pull in
              anyone from the studio. Clicking a chip moves it between
              sections. The current Owner sits in AVAILABLE as a greyed-out
              chip so it's visible but not selectable. */}
          <div>
            <label className="label inline-flex items-center gap-1.5 mb-2">
              <UsersIcon size={11} className="text-orbital-subtle" />
              Participants
            </label>

            {/* ASSIGNED section */}
            <div
              className="p-2.5 mb-2"
              style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.25)' }}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="font-telemetry text-[9px] tracking-wider text-blue-400">
                  ASSIGNED
                </p>
                <p className="font-telemetry text-[9px] tracking-wider text-blue-400 tabular-nums">
                  {form.participantIds.length}
                </p>
              </div>
              {form.participantIds.length === 0 ? (
                <p className="text-[11px] text-orbital-dim italic py-1">
                  No one assigned yet. Click a name below to add them.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {USERS.filter(p => form.participantIds.includes(p.id)).map(person => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleParticipant(person.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 transition-colors group/chip"
                      style={{
                        background: 'rgba(59,130,246,0.18)',
                        border: '1px solid rgba(59,130,246,0.55)',
                        color: 'var(--orbital-text)',
                      }}
                      title="Click to remove"
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0"
                        style={{ background: person.color || '#6b7280' }}
                      >
                        {person.avatar || person.name?.charAt(0)?.toUpperCase()}
                      </span>
                      <span className="text-xs">{person.name}</span>
                      <X size={10} className="text-orbital-subtle group-hover/chip:text-red-400 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AVAILABLE section */}
            <div className="p-2.5" style={{ border: '1px solid var(--orbital-border)' }}>
              <p className="font-telemetry text-[9px] tracking-wider text-orbital-subtle mb-1.5">
                AVAILABLE
              </p>
              {(() => {
                const available = USERS.filter(p => !form.participantIds.includes(p.id))
                if (available.length === 0) {
                  return (
                    <p className="text-[11px] text-orbital-dim italic py-1">
                      Everyone's assigned.
                    </p>
                  )
                }
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {available.map(person => {
                      const isOwner = person.id === form.ownerId
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => toggleParticipant(person.id)}
                          disabled={isOwner}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 transition-colors hover:bg-orbital-muted"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--orbital-border)',
                            color: 'var(--orbital-subtle)',
                            opacity: isOwner ? 0.35 : 1,
                            cursor: isOwner ? 'not-allowed' : 'pointer',
                          }}
                          title={isOwner ? `${person.name} is the milestone owner` : 'Click to assign'}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0"
                            style={{ background: person.color || '#6b7280' }}
                          >
                            {person.avatar || person.name?.charAt(0)?.toUpperCase()}
                          </span>
                          <span className="text-xs">{person.name}</span>
                          {isOwner && (
                            <span className="font-telemetry text-[8px] tracking-wider text-orbital-dim ml-0.5">
                              OWNER
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <p className="text-[11px] text-orbital-dim mt-2">
              Owners and participants each get a task auto-created when first added — visible on their Team page.
            </p>
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

