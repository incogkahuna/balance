import { useState } from 'react'
import { Phone, Mail, Plus, Edit2, Trash2, User, Copy } from 'lucide-react'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import clsx from 'clsx'

// Tag config — label, colors for badge rendering
const TAGS = {
  'Client Side': { label: 'Client Side', class: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'Internal':    { label: 'Internal',    class: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  'Vendor':      { label: 'Vendor',      class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
}

const EMPTY_FORM = { name: '', role: '', company: '', phone: '', email: '', notes: '', tag: 'Client Side' }

export function KeyPlayers({ players = [], onChange }) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null) // player object being edited, or null for new
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (player) => {
    setEditing(player)
    setForm({ ...player })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editing) {
      onChange(players.map(p => p.id === editing.id ? { ...editing, ...form } : p))
    } else {
      onChange([...players, { id: crypto.randomUUID(), ...form }])
    }
    setShowModal(false)
  }

  const handleDelete = (id) => {
    onChange(players.filter(p => p.id !== id))
    setDeleteTarget(null)
  }

  // One-tap copy for phone/email on mobile
  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-orbital-text">Key Players</h3>
        <button onClick={openAdd} className="btn-primary py-1.5 text-xs">
          <Plus size={14} /> Add Person
        </button>
      </div>

      {players.length === 0 ? (
        <EmptyState
          icon={User}
          title="No contacts yet"
          description="Add the key people for this production — clients, vendors, and internal contacts."
          action={
            <button onClick={openAdd} className="btn-primary">
              <Plus size={14} /> Add first contact
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {players.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onEdit={() => openEdit(player)}
              onDelete={() => setDeleteTarget(player)}
              onCopy={copyToClipboard}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Contact' : 'Add Key Player'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label">Role / Title</label>
              <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Executive Producer" />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Studios" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@studio.com" />
            </div>
          </div>

          <div>
            <label className="label">Tag</label>
            <div className="flex gap-2">
              {Object.keys(TAGS).map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => set('tag', tag)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    form.tag === tag ? TAGS[tag].class : 'bg-orbital-surface border-orbital-border text-orbital-subtle'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[70px] resize-y"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Anything relevant about this person — preferences, history, how they operate..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={!form.name.trim()}>
              {editing ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Remove Contact"
        message={`Remove ${deleteTarget?.name} from Key Players?`}
        confirmLabel="Remove"
        danger
      />
    </section>
  )
}

function PlayerCard({ player, onEdit, onDelete, onCopy }) {
  const tag = TAGS[player.tag] || TAGS['Client Side']

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-orbital-text">{player.name}</span>
            <span className={clsx('px-2 py-0.5 rounded-md text-xs font-medium border', tag.class)}>
              {player.tag}
            </span>
          </div>
          {(player.role || player.company) && (
            <p className="text-xs text-orbital-subtle mb-2">
              {[player.role, player.company].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Contact actions — tap-to-call/email on mobile */}
          <div className="flex flex-wrap gap-2">
            {player.phone && (
              <a
                href={`tel:${player.phone}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orbital-muted hover:bg-orbital-border text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
                onClick={e => { e.stopPropagation() }}
              >
                <Phone size={11} />
                {player.phone}
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onCopy(player.phone) }}
                  className="ml-0.5 opacity-50 hover:opacity-100"
                  aria-label="Copy phone"
                >
                  <Copy size={10} />
                </button>
              </a>
            )}
            {player.email && (
              <a
                href={`mailto:${player.email}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orbital-muted hover:bg-orbital-border text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <Mail size={11} />
                {player.email}
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onCopy(player.email) }}
                  className="ml-0.5 opacity-50 hover:opacity-100"
                  aria-label="Copy email"
                >
                  <Copy size={10} />
                </button>
              </a>
            )}
          </div>

          {player.notes && (
            <p className="text-xs text-orbital-subtle mt-2 italic">{player.notes}</p>
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
