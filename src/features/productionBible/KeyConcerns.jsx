import { useState } from 'react'
import { AlertTriangle, Plus, Edit2, Trash2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import clsx from 'clsx'

const SEVERITY = {
  High:   { class: 'bg-red-500/15 text-red-400 border-red-500/30',    card: 'border-red-500/25' },
  Medium: { class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', card: '' },
  Low:    { class: 'bg-zinc-600/30 text-zinc-400 border-zinc-600/40',  card: '' },
}

// Sort order: High → Medium → Low, open before resolved within each group
const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2 }

const EMPTY_FORM = { title: '', description: '', severity: 'Medium' }

export function KeyConcerns({ concerns = [], onChange }) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // resolving: id of concern being resolved — shows inline resolution note input
  const [resolving, setResolving] = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (concern) => {
    setEditing(concern)
    setForm({ title: concern.title, description: concern.description, severity: concern.severity })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    if (editing) {
      onChange(concerns.map(c => c.id === editing.id ? { ...c, ...form } : c))
    } else {
      onChange([...concerns, {
        id: crypto.randomUUID(),
        ...form,
        status: 'Open',
        resolutionNote: '',
        createdAt: new Date().toISOString(),
      }])
    }
    setShowModal(false)
  }

  const handleResolve = (id) => {
    onChange(concerns.map(c =>
      c.id === id ? { ...c, status: 'Resolved', resolutionNote } : c
    ))
    setResolving(null)
    setResolutionNote('')
  }

  const handleReopen = (id) => {
    onChange(concerns.map(c =>
      c.id === id ? { ...c, status: 'Open', resolutionNote: '' } : c
    ))
  }

  const handleDelete = (id) => {
    onChange(concerns.filter(c => c.id !== id))
    setDeleteTarget(null)
  }

  const open = concerns
    .filter(c => c.status === 'Open')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const resolved = concerns.filter(c => c.status === 'Resolved')

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-orbital-text">Key Concerns</h3>
        <button onClick={openAdd} className="btn-primary py-1.5 text-xs">
          <Plus size={14} /> Add Concern
        </button>
      </div>

      {concerns.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No concerns logged"
          description="Document anticipated challenges before they become problems. Proactive documentation keeps the whole team aligned."
          action={
            <button onClick={openAdd} className="btn-primary">
              <Plus size={14} /> Add first concern
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Open concerns */}
          {open.length > 0 && (
            <div className="space-y-2">
              {open.map(concern => (
                <ConcernCard
                  key={concern.id}
                  concern={concern}
                  onEdit={() => openEdit(concern)}
                  onDelete={() => setDeleteTarget(concern)}
                  onResolve={() => { setResolving(concern.id); setResolutionNote('') }}
                  onReopen={() => handleReopen(concern.id)}
                  resolving={resolving === concern.id}
                  resolutionNote={resolutionNote}
                  onResolutionNoteChange={setResolutionNote}
                  onConfirmResolve={() => handleResolve(concern.id)}
                  onCancelResolve={() => setResolving(null)}
                />
              ))}
            </div>
          )}

          {/* Resolved concerns — collapsible */}
          {resolved.length > 0 && (
            <div>
              <button
                onClick={() => setShowResolved(s => !s)}
                className="flex items-center gap-2 text-xs text-orbital-subtle hover:text-orbital-text transition-colors mb-2"
              >
                {showResolved ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {resolved.length} resolved concern{resolved.length !== 1 ? 's' : ''}
              </button>
              {showResolved && (
                <div className="space-y-2">
                  {resolved.map(concern => (
                    <ConcernCard
                      key={concern.id}
                      concern={concern}
                      onEdit={() => openEdit(concern)}
                      onDelete={() => setDeleteTarget(concern)}
                      onReopen={() => handleReopen(concern.id)}
                      resolving={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Concern' : 'Add Key Concern'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Concern Title *</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Content delivery not confirmed" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-y" value={form.description} onChange={e => set('description', e.target.value)} placeholder="What is the risk, what could go wrong, what needs to happen to resolve it..." />
          </div>
          <div>
            <label className="label">Severity</label>
            <div className="flex gap-2">
              {Object.keys(SEVERITY).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('severity', s)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-1',
                    form.severity === s ? SEVERITY[s].class : 'bg-orbital-surface border-orbital-border text-orbital-subtle'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={!form.title.trim()}>
              {editing ? 'Save Changes' : 'Add Concern'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Delete Concern"
        message={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        danger
      />
    </section>
  )
}

function ConcernCard({ concern, onEdit, onDelete, onResolve, onReopen, resolving, resolutionNote, onResolutionNoteChange, onConfirmResolve, onCancelResolve }) {
  const sev = SEVERITY[concern.severity] || SEVERITY.Medium
  const isResolved = concern.status === 'Resolved'

  return (
    <div className={clsx('card p-4 transition-all', !isResolved && sev.card, isResolved && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={clsx('font-medium text-sm', isResolved ? 'line-through text-orbital-subtle' : 'text-orbital-text')}>
              {concern.title}
            </span>
            <span className={clsx('px-2 py-0.5 rounded-md text-xs font-medium border', sev.class)}>
              {concern.severity}
            </span>
            {isResolved && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                Resolved
              </span>
            )}
          </div>
          {concern.description && (
            <p className="text-xs text-orbital-subtle mb-2">{concern.description}</p>
          )}
          {isResolved && concern.resolutionNote && (
            <p className="text-xs text-green-400/80 italic">Resolution: {concern.resolutionNote}</p>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {!isResolved && (
            <button onClick={onResolve} title="Mark resolved" className="p-1.5 rounded hover:bg-green-500/10 text-orbital-subtle hover:text-green-400 transition-colors">
              <CheckCircle size={14} />
            </button>
          )}
          {isResolved && (
            <button onClick={onReopen} title="Reopen" className="p-1.5 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors text-xs px-2">
              Reopen
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Inline resolve flow — appears below the card when resolving */}
      {resolving && (
        <div className="mt-3 pt-3 border-t border-orbital-border space-y-2">
          <textarea
            className="input min-h-[60px] resize-none text-xs"
            placeholder="Resolution note — what happened, how it was addressed..."
            value={resolutionNote}
            onChange={e => onResolutionNoteChange(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={onCancelResolve} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
            <button onClick={onConfirmResolve} className="btn-primary flex-1 text-xs py-1.5">
              <CheckCircle size={13} /> Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
