import { useState, useMemo } from 'react'
import { parseISO } from 'date-fns'
import { format } from '../lib/safeFormat.js'
import {
  Plus, Monitor, AlertTriangle, X, Edit2, Trash2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, createLedWall, LED_WALL_STATUS } from '../data/models.js'
import { DictationMic } from '../components/voice/DictationMic.tsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { ScreenshotAttach } from '../features/feedback/ScreenshotAttach.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// GearPage — v1 of the gear database, scoped to LED walls per Danny's spec.
// Lightweight: list the walls Orbital owns, see what's currently on each one,
// add/edit assignments to productions, flag overlapping bookings as conflicts.
// ─────────────────────────────────────────────────────────────────────────────

export function GearPage() {
  const { currentUser, ledWalls, productions } = useApp()

  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const [newWallOpen, setNewWallOpen]   = useState(false)
  const [editWall, setEditWall]         = useState(null)   // wall object being edited
  const [assignFor, setAssignFor]       = useState(null)   // { wall, assignment? }

  return (
    <div>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="hud-label mb-1">GEAR DATABASE</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">
              LED Walls
            </h1>
          </div>
          {isAdmin && (
            <button onClick={() => setNewWallOpen(true)} className="btn-primary">
              <Plus size={14} />
              <span className="hidden sm:inline">New Wall</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
        <p className="text-sm text-orbital-subtle mb-5">
          What's assigned where. Tap a wall to see its full booking history,
          or add an assignment to commit it to a production for a date range.
        </p>

        {/* ── Wall list ─────────────────────────────────────────────────── */}
        {ledWalls.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <Monitor size={32} className="mx-auto text-orbital-dim mb-3" />
            <p className="text-sm text-orbital-subtle mb-1">No LED walls in the database yet.</p>
            {isAdmin && (
              <button onClick={() => setNewWallOpen(true)} className="btn-primary mt-3 inline-flex">
                <Plus size={14} /> Add the first wall
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {ledWalls.map(wall => (
              <WallCard
                key={wall.id}
                wall={wall}
                productions={productions}
                isAdmin={isAdmin}
                onEdit={() => setEditWall(wall)}
                onAssign={(assignment) => setAssignFor({ wall, assignment })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {newWallOpen && (
        <WallFormModal
          onClose={() => setNewWallOpen(false)}
        />
      )}
      {editWall && (
        <WallFormModal
          wall={editWall}
          onClose={() => setEditWall(null)}
        />
      )}
      {assignFor && (
        <AssignmentModal
          wall={assignFor.wall}
          assignment={assignFor.assignment}
          onClose={() => setAssignFor(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WallCard — one wall, its current status, and its full assignment timeline.
// ─────────────────────────────────────────────────────────────────────────────
function WallCard({ wall, productions, isAdmin, onEdit, onAssign }) {
  const { deleteLedWall, unassignWall } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sort assignments by start date, ascending
  const sorted = useMemo(() => {
    return [...(wall.assignments || [])].sort((a, b) => {
      return (a.startDate || '').localeCompare(b.startDate || '')
    })
  }, [wall.assignments])

  // Categorise: past / current / upcoming
  const now = new Date()
  const categorised = useMemo(() => {
    const out = { current: [], upcoming: [], past: [] }
    for (const a of sorted) {
      if (!a.startDate) { out.upcoming.push(a); continue }
      const start = parseISO(a.startDate)
      const end   = a.endDate ? parseISO(a.endDate) : start
      if (end < now)        out.past.push(a)
      else if (start > now) out.upcoming.push(a)
      else                  out.current.push(a)
    }
    return out
  }, [sorted, now])

  // Conflict detection: any pair of assignments with overlapping date ranges
  const conflicts = useMemo(() => {
    const ids = new Set()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j]
        if (!a.startDate || !b.startDate) continue
        const aS = parseISO(a.startDate)
        const aE = a.endDate ? parseISO(a.endDate) : aS
        const bS = parseISO(b.startDate)
        const bE = b.endDate ? parseISO(b.endDate) : bS
        if (aS <= bE && bS <= aE) { ids.add(a.id); ids.add(b.id) }
      }
    }
    return ids
  }, [sorted])

  const hasConflicts = conflicts.size > 0

  const statusBadge = (() => {
    if (wall.status === LED_WALL_STATUS.IN_MAINTENANCE) {
      return { label: 'In Maintenance', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)' }
    }
    if (wall.status === LED_WALL_STATUS.RETIRED) {
      return { label: 'Retired', color: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.4)' }
    }
    if (categorised.current.length > 0) {
      const c = categorised.current[0]
      const prod = productions.find(p => p.id === c.productionId)
      return {
        label: `On ${prod?.name || 'unknown'}${c.endDate ? ` · until ${format(parseISO(c.endDate), 'MMM d')}` : ''}`,
        color: '#34d399',
        bg: 'rgba(52,211,153,0.12)',
        border: 'rgba(52,211,153,0.4)',
      }
    }
    return { label: 'Available', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)' }
  })()

  const handleDelete = () => setConfirmDelete(true)

  return (
    <div className="card-elevated p-4 flex flex-col gap-3">
      {/* Wall photo — click to open full size */}
      {wall.photo && (
        <a href={wall.photo} target="_blank" rel="noopener noreferrer" className="-mx-4 -mt-4 mb-1 block">
          <img
            src={wall.photo}
            alt={`${wall.name} photo`}
            className="w-full h-36 object-cover rounded-t hover:opacity-90 transition-opacity"
          />
        </a>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteLedWall(wall.id)}
        title="Delete LED wall"
        message={`Delete "${wall.name}"? Its assignment history will be lost.`}
        confirmLabel="Delete"
        danger
      />
      {/* Header: name + status + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-orbital-text truncate">{wall.name}</h3>
          {wall.description && (
            <p className="text-xs text-orbital-subtle mt-0.5 leading-relaxed">{wall.description}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-3 lg:p-1.5 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors"
              title="Edit wall"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={handleDelete}
              className="p-3 lg:p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors"
              title="Delete wall"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Status pill */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5"
          style={{ color: statusBadge.color, background: statusBadge.bg, border: `1px solid ${statusBadge.border}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusBadge.color }} />
          {statusBadge.label}
        </span>
      </div>

      {/* Conflicts banner (if any) */}
      {hasConflicts && (
        <div
          className="rounded-md p-2.5 flex items-center gap-2 text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
        >
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span>
            {conflicts.size} overlapping assignment{conflicts.size === 1 ? '' : 's'} —
            this wall can't be in two places at once.
          </span>
        </div>
      )}

      {/* Assignments — current → upcoming → past */}
      <div className="space-y-1.5">
        {sorted.length === 0 ? (
          <p className="text-xs text-orbital-dim italic">No assignments yet.</p>
        ) : (
          <>
            {categorised.current.map(a => (
              <AssignmentRow
                key={a.id} assignment={a} wall={wall} productions={productions}
                bucket="current" hasConflict={conflicts.has(a.id)}
                onEdit={() => onAssign(a)}
                onRemove={() => unassignWall(wall.id, a.id)}
                isAdmin={isAdmin}
              />
            ))}
            {categorised.upcoming.map(a => (
              <AssignmentRow
                key={a.id} assignment={a} wall={wall} productions={productions}
                bucket="upcoming" hasConflict={conflicts.has(a.id)}
                onEdit={() => onAssign(a)}
                onRemove={() => unassignWall(wall.id, a.id)}
                isAdmin={isAdmin}
              />
            ))}
            {categorised.past.length > 0 && (
              <details className="group">
                <summary className="text-[10px] text-orbital-dim uppercase tracking-wider cursor-pointer hover:text-orbital-subtle py-1">
                  Past assignments ({categorised.past.length})
                </summary>
                <div className="space-y-1.5 mt-1.5">
                  {categorised.past.map(a => (
                    <AssignmentRow
                      key={a.id} assignment={a} wall={wall} productions={productions}
                      bucket="past" hasConflict={conflicts.has(a.id)}
                      onEdit={() => onAssign(a)}
                      onRemove={() => unassignWall(wall.id, a.id)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {/* Assign CTA */}
      {isAdmin && wall.status !== LED_WALL_STATUS.RETIRED && (
        <button
          onClick={() => onAssign(null)}
          className="btn-secondary text-xs justify-center mt-1"
        >
          <Plus size={12} />
          Assign to production
        </button>
      )}
    </div>
  )
}

// ── One assignment row inside a wall card ────────────────────────────────────
function AssignmentRow({ assignment, productions, bucket, hasConflict, onEdit, onRemove, isAdmin }) {
  const prod = productions.find(p => p.id === assignment.productionId)
  const dateLabel = (() => {
    if (!assignment.startDate) return 'No dates set'
    const start = format(parseISO(assignment.startDate), 'MMM d')
    if (!assignment.endDate || assignment.endDate === assignment.startDate) return start
    return `${start} – ${format(parseISO(assignment.endDate), 'MMM d')}`
  })()

  const bucketStyle = {
    current:  { dot: '#34d399', textOpacity: 1   },
    upcoming: { dot: '#60a5fa', textOpacity: 1   },
    past:     { dot: '#71717a', textOpacity: 0.6 },
  }[bucket]

  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md"
      style={{
        background: hasConflict ? 'rgba(239,68,68,0.08)' : 'var(--orbital-muted)',
        border: `1px solid ${hasConflict ? 'rgba(239,68,68,0.35)' : 'var(--orbital-border)'}`,
        opacity: bucketStyle.textOpacity,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: bucketStyle.dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-orbital-text truncate">
          {prod ? prod.name : <span className="text-orbital-dim italic">Production removed</span>}
        </p>
        {assignment.notes && (
          <p className="text-[11px] text-orbital-subtle truncate">{assignment.notes}</p>
        )}
      </div>
      <span className="text-[11px] font-mono text-orbital-subtle whitespace-nowrap">{dateLabel}</span>
      {isAdmin && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-orbital-surface text-orbital-subtle hover:text-orbital-text transition-colors"
            title="Edit assignment"
          >
            <Edit2 size={11} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors"
            title="Remove assignment"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WallFormModal — create or edit an LED wall
// ─────────────────────────────────────────────────────────────────────────────
function WallFormModal({ wall, onClose }) {
  const { addLedWall, updateLedWall } = useApp()
  const isNew = !wall

  const [form, setForm] = useState({
    name: wall?.name || '',
    description: wall?.description || '',
    photo: wall?.photo || '',
    status: wall?.status || LED_WALL_STATUS.IN_SERVICE,
    notes: wall?.notes || '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.name.trim()) return
    if (isNew) {
      addLedWall(createLedWall(form))
    } else {
      updateLedWall(wall.id, form)
    }
    onClose()
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'New LED Wall' : 'Edit LED Wall'} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Main Volume Stage A"
            autoFocus
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Spec / Description</label>
            <DictationMic onText={t => set('description', form.description ? `${form.description}\n${t}` : t)} />
          </div>
          <textarea
            className="input min-h-[60px] resize-y"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="ROE Black Pearl 2.8mm · 30m × 5m · Brompton SX40 processor"
          />
        </div>
        <div>
          <label className="label">Photo</label>
          <ScreenshotAttach
            value={form.photo}
            onChange={v => set('photo', v)}
            label="Attach photo"
            alt={`${form.name || 'Wall'} photo`}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.values(LED_WALL_STATUS).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Notes</label>
            <DictationMic onText={t => set('notes', form.notes ? `${form.notes}\n${t}` : t)} />
          </div>
          <textarea
            className="input min-h-[60px] resize-y"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Mobile build kit · permanently installed · etc."
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={save} disabled={!form.name.trim()} className="btn-primary flex-1 justify-center">
            {isNew ? 'Create wall' : 'Save changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssignmentModal — assign a wall to a production for a date range (or edit existing)
// ─────────────────────────────────────────────────────────────────────────────
function AssignmentModal({ wall, assignment, onClose }) {
  const { productions, assignWall, updateWallAssignment } = useApp()
  const isNew = !assignment

  const [form, setForm] = useState({
    productionId: assignment?.productionId || '',
    startDate:    assignment?.startDate || '',
    endDate:      assignment?.endDate || '',
    notes:        assignment?.notes || '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const sortedProds = useMemo(
    () => [...productions].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [productions]
  )

  // If user picks a production, prefill dates from its date range (if empty)
  const handleProdPick = (id) => {
    set('productionId', id)
    if (form.startDate || form.endDate) return
    const p = productions.find(p => p.id === id)
    if (p?.startDate) set('startDate', p.startDate)
    if (p?.endDate)   set('endDate',   p.endDate)
  }

  const canSave =
    !!form.productionId &&
    !!form.startDate &&
    (!form.endDate || form.endDate >= form.startDate)

  const save = () => {
    if (!canSave) return
    if (isNew) {
      assignWall(wall.id, form)
    } else {
      updateWallAssignment(wall.id, assignment.id, form)
    }
    onClose()
  }

  return (
    <Modal open={true} onClose={onClose} title={`${isNew ? 'Assign' : 'Edit assignment'} — ${wall.name}`} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Production</label>
          <select
            className="input"
            value={form.productionId}
            onChange={e => handleProdPick(e.target.value)}
          >
            <option value="">— Pick a production —</option>
            {sortedProds.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-orbital-dim mt-1">
            Picking a production will prefill the dates from its start/end if they're empty.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start</label>
            <input
              type="date"
              className="input"
              value={form.startDate}
              onChange={e => set('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="label">End</label>
            <input
              type="date"
              className="input"
              value={form.endDate}
              onChange={e => set('endDate', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <input
            className="input"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Setup includes truss + power distro · special config notes"
          />
        </div>
        {form.endDate && form.endDate < form.startDate && (
          <p className="text-xs text-red-400">End date can't be before start date.</p>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={save} disabled={!canSave} className="btn-primary flex-1 justify-center">
            {isNew ? 'Assign' : 'Save changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
