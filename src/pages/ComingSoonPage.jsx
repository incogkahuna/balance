import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Check, Loader2, Hash, MessageSquare } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES } from '../data/models.js'
import {
  listComingSoon, createComingSoon, setComingSoonDone, deleteComingSoon,
  subscribeToComingSoon,
} from '../lib/data/comingSoon.ts'

export function ComingSoonPage() {
  const { currentUser } = useApp()
  const canEdit = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const canDelete = currentUser?.role === ROLES.ADMIN

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false
    listComingSoon()
      .then(rows => { if (!cancelled) { setItems(rows); setLoading(false) } })
      .catch(err => {
        if (cancelled) return
        console.error('[ComingSoon] load failed', err)
        setError(err.message)
        setLoading(false)
      })
    const unsub = subscribeToComingSoon((event) => {
      setItems(prev => {
        if (event.type === 'INSERT') {
          if (prev.some(i => i.id === event.row.id)) return prev
          return [event.row, ...prev]
        }
        if (event.type === 'UPDATE') {
          return prev.map(i => i.id === event.row.id ? event.row : i)
        }
        if (event.type === 'DELETE') {
          return prev.filter(i => i.id !== event.row.id)
        }
        return prev
      })
    })
    return () => { cancelled = true; unsub() }
  }, [])

  // ── Add form state ──
  const [draftText, setDraftText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    const text = draftText.trim()
    if (!text) return
    setSubmitting(true)
    try {
      await createComingSoon({ text })
      setDraftText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openItems = items.filter(i => !i.isDone)
  const doneItems = items.filter(i => i.isDone)

  return (
    <div className="px-4 lg:px-6 py-5 max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.25em] mb-1">
          ROADMAP · WHAT'S NEXT
        </p>
        <h1 className="text-base font-semibold text-orbital-text">Coming Soon</h1>
        <p className="text-sm text-orbital-subtle mt-1">
          What's planned, what's queued, what's almost ready to ship. Add items manually here or @-mention the Slack bot to drop in a quick idea.
        </p>
      </div>

      {/* ── Add form ────────────────────────────────────────────────────── */}
      {canEdit && (
        <form onSubmit={handleAdd} className="mb-5 flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="e.g. Email integration · Mobile crew checklist · Real-time chat in productions"
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            className="btn-primary inline-flex items-center gap-1.5"
            disabled={submitting || !draftText.trim()}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            <span>Add</span>
          </button>
        </form>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <p className="mb-4 text-xs text-red-400 px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </p>
      )}

      {/* ── Open items ──────────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">
            OPEN · {openItems.length}
          </p>
        </div>

        {loading ? (
          <div className="card-elevated px-4 py-8 text-center">
            <Loader2 size={16} className="animate-spin inline-block text-orbital-subtle" />
          </div>
        ) : openItems.length === 0 ? (
          <div className="card-elevated px-4 py-8 text-center">
            <p className="text-sm text-orbital-dim">No items in the queue yet.</p>
            {canEdit && <p className="text-xs text-orbital-dim mt-1">Add one above, or @-mention the Slack bot.</p>}
          </div>
        ) : (
          <ul className="card-elevated divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
            {openItems.map(item => (
              <ComingSoonRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                canDelete={canDelete}
                onToggleDone={() => setComingSoonDone(item.id, true)}
                onDelete={() => deleteComingSoon(item.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Done items ──────────────────────────────────────────────────── */}
      {doneItems.length > 0 && (
        <section>
          <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle mb-2">
            SHIPPED · {doneItems.length}
          </p>
          <ul className="card-elevated divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
            {doneItems.map(item => (
              <ComingSoonRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                canDelete={canDelete}
                done
                onToggleDone={() => setComingSoonDone(item.id, false)}
                onDelete={() => deleteComingSoon(item.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Single row ──────────────────────────────────────────────────────────────
function ComingSoonRow({ item, canEdit, canDelete, done, onToggleDone, onDelete }) {
  const [busy, setBusy] = useState(false)

  const handleToggle = async () => {
    setBusy(true)
    try { await onToggleDone() } finally { setBusy(false) }
  }
  const handleDelete = async () => {
    if (!confirm('Delete this item?')) return
    setBusy(true)
    try { await onDelete() } catch { setBusy(false) }
  }

  return (
    <li className="px-4 py-3 flex items-start gap-3 group hover:bg-orbital-panel transition-colors">
      {/* Bullet / checkbox */}
      {canEdit ? (
        <button
          onClick={handleToggle}
          disabled={busy}
          className="mt-1 w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            border: '1px solid var(--orbital-border)',
            background: done ? '#34d399' : 'transparent',
          }}
          title={done ? 'Mark as still pending' : 'Mark as shipped'}
        >
          {done && <Check size={10} className="text-orbital-bg" strokeWidth={3} />}
        </button>
      ) : (
        <span
          className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: done ? '#34d399' : 'var(--orbital-subtle)' }}
        />
      )}

      {/* Text + source meta */}
      <div className="min-w-0 flex-1">
        <p className={done ? 'text-sm text-orbital-subtle line-through' : 'text-sm text-orbital-text'}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.source === 'slack' ? (
            <span
              className="inline-flex items-center gap-1 font-telemetry text-[9px] tracking-wider px-1.5 py-px"
              style={{
                background: 'rgba(232,121,249,0.1)',
                border: '1px solid rgba(232,121,249,0.3)',
                color: '#e879f9',
              }}
              title={`From Slack${item.slackChannelName ? ' · #' + item.slackChannelName : ''}`}
            >
              <MessageSquare size={9} />
              SLACK
              {item.slackUserName && ` · ${item.slackUserName}`}
              {item.slackChannelName && (
                <span className="inline-flex items-center"><Hash size={8} />{item.slackChannelName}</span>
              )}
            </span>
          ) : (
            <span
              className="font-telemetry text-[9px] tracking-wider px-1.5 py-px"
              style={{
                border: '1px solid var(--orbital-border)',
                color: 'var(--orbital-subtle)',
              }}
            >
              MANUAL
            </span>
          )}
          <span className="font-telemetry text-[9px] text-orbital-dim tracking-wider">
            {format(parseISO(item.createdAt), 'MMM d · HH:mm')}
          </span>
        </div>
      </div>

      {/* Delete (admin only, hover) */}
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={busy}
          className="mt-0.5 p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--orbital-subtle)' }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  )
}
