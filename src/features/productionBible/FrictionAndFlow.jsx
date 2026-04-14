import { useState } from 'react'
import { Lock, TrendingUp, TrendingDown, Plus, Edit2, Trash2, Users } from 'lucide-react'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import clsx from 'clsx'

// Factor type config — professional, not dramatic
const FACTOR_TYPES = {
  'Positive Contributor': {
    icon: TrendingUp,
    class: 'bg-green-500/10 text-green-400 border-green-500/25',
    cardClass: 'border-green-500/15',
    label: 'Positive Contributor',
  },
  'Friction Point': {
    icon: TrendingDown,
    class: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    cardClass: 'border-amber-500/15',
    label: 'Friction Point',
  },
}

const EMPTY_FORM = { personName: '', personRole: '', company: '', factorType: 'Positive Contributor', notes: '' }

export function FrictionAndFlow({ entries = [], onChange }) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (entry) => { setEditing(entry); setForm({ ...entry }); setShowModal(true) }

  const handleSave = () => {
    if (!form.personName.trim()) return
    if (editing) {
      onChange(entries.map(e => e.id === editing.id ? { ...editing, ...form } : e))
    } else {
      onChange([...entries, { id: crypto.randomUUID(), ...form }])
    }
    setShowModal(false)
  }

  const handleDelete = (id) => {
    onChange(entries.filter(e => e.id !== id))
    setDeleteTarget(null)
  }

  // Group: positive contributors first, then friction points
  const positive = entries.filter(e => e.factorType === 'Positive Contributor')
  const friction = entries.filter(e => e.factorType === 'Friction Point')

  return (
    <section>
      {/* Internal-only header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-orbital-text">Friction & Flow</h3>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orbital-muted border border-orbital-border text-xs text-orbital-subtle font-medium">
            <Lock size={10} /> Internal Only
          </span>
        </div>
        <button onClick={openAdd} className="btn-primary py-1.5 text-xs">
          <Plus size={14} /> Add Entry
        </button>
      </div>

      {/* Internal notice — persistent, subtle */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-orbital-muted border border-orbital-border mb-4">
        <Lock size={13} className="text-orbital-subtle mt-0.5 flex-shrink-0" />
        <p className="text-xs text-orbital-subtle">
          This section is visible to Admin and Supervisor only. It is not shared with Crew.
          Keep notes professional and factual — this is operational intelligence, not personal commentary.
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No entries yet"
          description="Document who is making this production easier or harder. Helps the team calibrate before and during production."
          action={
            <button onClick={openAdd} className="btn-primary">
              <Plus size={14} /> Add first entry
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {positive.length > 0 && (
            <div>
              <p className="section-title mb-2">Positive Contributors</p>
              <div className="space-y-2">
                {positive.map(entry => (
                  <FlowCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => setDeleteTarget(entry)} />
                ))}
              </div>
            </div>
          )}
          {friction.length > 0 && (
            <div>
              <p className="section-title mb-2">Friction Points</p>
              <div className="space-y-2">
                {friction.map(entry => (
                  <FlowCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => setDeleteTarget(entry)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Entry' : 'Add Entry'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Person Name *</label>
              <input className="input" value={form.personName} onChange={e => set('personName', e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Their Role</label>
              <input className="input" value={form.personRole} onChange={e => set('personRole', e.target.value)} placeholder="Director, Line Producer..." />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Company name" />
            </div>
          </div>

          <div>
            <label className="label">Factor Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FACTOR_TYPES).map(([type, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('factorType', type)}
                    className={clsx(
                      'flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors',
                      form.factorType === type ? config.class : 'bg-orbital-surface border-orbital-border text-orbital-subtle'
                    )}
                  >
                    <Icon size={14} />
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="What specifically are they doing and why does it matter for this production..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={!form.personName.trim()}>
              {editing ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Remove Entry"
        message={`Remove entry for ${deleteTarget?.personName}?`}
        confirmLabel="Remove"
        danger
      />
    </section>
  )
}

function FlowCard({ entry, onEdit, onDelete }) {
  const config = FACTOR_TYPES[entry.factorType] || FACTOR_TYPES['Positive Contributor']
  const Icon = config.icon

  return (
    <div className={clsx('card p-4', config.cardClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border', config.class)}>
              <Icon size={10} /> {entry.factorType}
            </span>
          </div>
          <p className="font-medium text-sm text-orbital-text">{entry.personName}</p>
          {(entry.personRole || entry.company) && (
            <p className="text-xs text-orbital-subtle mt-0.5">
              {[entry.personRole, entry.company].filter(Boolean).join(' · ')}
            </p>
          )}
          {entry.notes && (
            <p className="text-xs text-orbital-subtle mt-2">{entry.notes}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
