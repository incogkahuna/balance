import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Bug, Lightbulb, StickyNote, Plus, X, Send, Filter, MessageSquare, Trash2,
  CheckCircle2, Circle, AlertCircle, Ban,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import {
  ROLES, FEEDBACK_KIND, FEEDBACK_STATUS, createFeedbackItem,
} from '../data/models.js'
import { DictationMic } from '../components/voice/DictationMic.tsx'
import clsx from 'clsx'

// ─── Visual config ──────────────────────────────────────────────────────────
const KIND_META = {
  [FEEDBACK_KIND.BUG]:  { label: 'Bug',  icon: Bug,       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)'  },
  [FEEDBACK_KIND.IDEA]: { label: 'Idea', icon: Lightbulb, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' },
  [FEEDBACK_KIND.NOTE]: { label: 'Note', icon: StickyNote, color: '#5eead4', bg: 'rgba(94,234,212,0.12)', border: 'rgba(94,234,212,0.35)' },
}

const STATUS_META = {
  [FEEDBACK_STATUS.NEW]:          { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.4)',  icon: Circle        },
  [FEEDBACK_STATUS.ACKNOWLEDGED]: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)', icon: AlertCircle   },
  [FEEDBACK_STATUS.IN_PROGRESS]:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.4)',  icon: AlertCircle   },
  [FEEDBACK_STATUS.SHIPPED]:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.4)',   icon: CheckCircle2  },
  [FEEDBACK_STATUS.WONT_FIX]:     { color: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.4)', icon: Ban           },
}

const KIND_FILTERS   = [
  { id: 'all', label: 'All' },
  { id: FEEDBACK_KIND.BUG, label: 'Bugs' },
  { id: FEEDBACK_KIND.IDEA, label: 'Ideas' },
  { id: FEEDBACK_KIND.NOTE, label: 'Notes' },
]
const STATUS_FILTERS = ['all', ...Object.values(FEEDBACK_STATUS)]

// ────────────────────────────────────────────────────────────────────────────
// FeedbackPage — bugs & ideas board. Everyone can submit + view; admin/sup
// can move status + delete. Backed by localStorage for v1.
// ────────────────────────────────────────────────────────────────────────────
export function FeedbackPage() {
  const { currentUser, feedbackItems, addFeedbackItem, updateFeedbackItem, deleteFeedbackItem } = useApp()
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const [showSubmit, setShowSubmit]   = useState(false)
  const [kindFilter, setKindFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)   // feedback item pending delete confirmation

  const filtered = useMemo(() => {
    return feedbackItems
      .filter(f => kindFilter === 'all' || f.kind === kindFilter)
      .filter(f => statusFilter === 'all' || f.status === statusFilter)
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
  }, [feedbackItems, kindFilter, statusFilter])

  // Counts for filter chip badges
  const counts = useMemo(() => {
    const all      = feedbackItems.length
    const bugs     = feedbackItems.filter(f => f.kind === FEEDBACK_KIND.BUG).length
    const ideas    = feedbackItems.filter(f => f.kind === FEEDBACK_KIND.IDEA).length
    const notes    = feedbackItems.filter(f => f.kind === FEEDBACK_KIND.NOTE).length
    const byStatus = Object.fromEntries(
      Object.values(FEEDBACK_STATUS).map(s => [s, feedbackItems.filter(f => f.status === s).length])
    )
    return { all, bugs, ideas, notes, byStatus }
  }, [feedbackItems])

  return (
    <div>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
        {/* Header */}
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <p className="hud-label mb-1">FEEDBACK</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">
              Bugs &amp; Ideas
            </h1>
            <p className="text-sm text-orbital-subtle mt-0.5">
              Spot something broken or have an idea? Drop it here. {isAdmin ? 'Move status as items get worked on.' : 'Track when your suggestions ship.'}
            </p>
          </div>
          <button onClick={() => setShowSubmit(true)} className="btn-primary">
            <Plus size={14} />
            New report
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
          <div className="flex items-center gap-2">
            <Filter size={11} className="text-orbital-subtle" />
            <span className="hud-label">TYPE</span>
            <div className="flex gap-1">
              {KIND_FILTERS.map(k => {
                const active = kindFilter === k.id
                const count  =
                  k.id === 'all' ? counts.all :
                  k.id === FEEDBACK_KIND.BUG ? counts.bugs :
                  k.id === FEEDBACK_KIND.NOTE ? counts.notes : counts.ideas
                return (
                  <button
                    key={k.id}
                    onClick={() => setKindFilter(k.id)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40'
                        : 'text-orbital-subtle hover:text-orbital-text border border-orbital-border hover:bg-orbital-muted'
                    )}
                  >
                    {k.label}
                    <span className="font-mono text-[10px] opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="hud-label">STATUS</span>
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map(s => {
                const active = statusFilter === s
                const count  = s === 'all' ? counts.all : counts.byStatus[s]
                const accent = s === 'all' ? '#60a5fa' : STATUS_META[s]?.color
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium transition-colors border"
                    style={{
                      color:      active ? accent : 'var(--orbital-subtle)',
                      background: active ? `${accent}22` : 'transparent',
                      borderColor:active ? `${accent}88` : 'var(--orbital-border)',
                    }}
                  >
                    {s === 'all' ? 'All' : s}
                    <span className="font-mono text-[10px] opacity-60">{count || 0}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="card-elevated p-10 text-center">
            <MessageSquare size={28} className="mx-auto text-orbital-dim mb-3" />
            <p className="text-sm text-orbital-text font-medium mb-1">
              {feedbackItems.length === 0 ? 'No reports yet.' : 'Nothing matches that filter.'}
            </p>
            <p className="text-xs text-orbital-subtle">
              {feedbackItems.length === 0
                ? 'Be the first — hit "New report" above.'
                : 'Try widening the filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <FeedbackRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                isExpanded={expandedId === item.id}
                onToggleExpand={() => setExpandedId(id => id === item.id ? null : item.id)}
                onUpdateStatus={(status) => updateFeedbackItem(item.id, { status })}
                onUpdateResolution={(resolutionNote) => updateFeedbackItem(item.id, { resolutionNote })}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      {showSubmit && (
        <SubmitFeedbackModal
          onSubmit={(item) => { addFeedbackItem(item); setShowSubmit(false) }}
          onClose={() => setShowSubmit(false)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteFeedbackItem(deleteTarget?.id)}
        title="Delete report"
        message={`Delete "${deleteTarget?.title}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

// ── FeedbackRow ─────────────────────────────────────────────────────────────
function FeedbackRow({ item, isAdmin, isExpanded, onToggleExpand, onUpdateStatus, onUpdateResolution, onDelete }) {
  const kindMeta   = KIND_META[item.kind] || KIND_META[FEEDBACK_KIND.IDEA]
  const statusMeta = STATUS_META[item.status] || STATUS_META[FEEDBACK_STATUS.NEW]
  const KindIcon   = kindMeta.icon
  const StatusIcon = statusMeta.icon

  // Admin resolution-note editor state. Draft is local; Save persists.
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(item.resolutionNote || '')

  const submittedDate = item.submittedAt
    ? format(parseISO(item.submittedAt), 'MMM d, yyyy')
    : ''

  return (
    <div
      className="card-elevated overflow-hidden"
      style={{ borderLeft: `3px solid ${kindMeta.color}` }}
    >
      {/* Header row */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orbital-muted transition-colors"
      >
        {/* Kind icon */}
        <span
          className="w-7 h-7 flex items-center justify-center flex-shrink-0"
          style={{ background: kindMeta.bg, border: `1px solid ${kindMeta.border}`, color: kindMeta.color }}
        >
          <KindIcon size={13} />
        </span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-orbital-text truncate">{item.title || '(Untitled)'}</p>
          <p className="text-[11px] text-orbital-subtle mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-telemetry tracking-wider uppercase" style={{ color: kindMeta.color }}>{kindMeta.label}</span>
            <span className="text-orbital-dim">·</span>
            <span>{item.submittedByName || 'Anonymous'}</span>
            <span className="text-orbital-dim">·</span>
            <span className="font-mono">{submittedDate}</span>
          </p>
        </div>

        {/* Status pill */}
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap flex-shrink-0"
          style={{ color: statusMeta.color, background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}
        >
          <StatusIcon size={11} />
          {item.status}
        </span>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid var(--orbital-border)' }}>
          {item.description && (
            <p className="text-sm text-orbital-subtle whitespace-pre-wrap mt-3">{item.description}</p>
          )}
          {item.resolutionNote && !editingNote && (
            <div
              className="mt-3 p-3 rounded"
              style={{ background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}
            >
              <p className="hud-label mb-1" style={{ color: statusMeta.color }}>
                RESOLUTION
              </p>
              <p className="text-xs text-orbital-text whitespace-pre-wrap">{item.resolutionNote}</p>
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <>
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <label className="text-[10px] text-orbital-dim font-telemetry tracking-wider">SET STATUS</label>
                <select
                  className="text-xs px-2 py-1 bg-orbital-surface border border-orbital-border text-orbital-text rounded"
                  value={item.status}
                  onChange={(e) => onUpdateStatus(e.target.value)}
                >
                  {Object.values(FEEDBACK_STATUS).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {!editingNote && (
                  <button
                    onClick={() => { setNoteDraft(item.resolutionNote || ''); setEditingNote(true) }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
                  >
                    <MessageSquare size={11} />
                    {item.resolutionNote ? 'Edit resolution' : 'Add resolution'}
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-orbital-subtle hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={11} />
                  Delete
                </button>
              </div>

              {editingNote && (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="input min-h-[64px] resize-y text-xs"
                    placeholder="Resolution note — what was done, or why it won't be…"
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onUpdateResolution(noteDraft.trim()); setEditingNote(false) }}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingNote(false)}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Submit modal ─────────────────────────────────────────────────────────────
function SubmitFeedbackModal({ onSubmit, onClose }) {
  const [kind, setKind]               = useState(FEEDBACK_KIND.IDEA)
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')

  const canSubmit = title.trim().length > 0

  return (
    <Modal open={true} onClose={onClose} title="New report" size="md">
      <div className="space-y-4">
        {/* Kind toggle */}
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2">
            {[FEEDBACK_KIND.BUG, FEEDBACK_KIND.IDEA, FEEDBACK_KIND.NOTE].map(k => {
              const m = KIND_META[k]
              const Icon = m.icon
              const active = kind === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={clsx(
                    'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors border',
                  )}
                  style={{
                    color:       active ? m.color : 'var(--orbital-subtle)',
                    background:  active ? m.bg : 'transparent',
                    borderColor: active ? m.border : 'var(--orbital-border)',
                  }}
                >
                  <Icon size={14} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={
              kind === FEEDBACK_KIND.BUG
                ? "e.g. Gantt scrubber jumps back 3 days on load"
                : "e.g. Add a 'duplicate production' button"
            }
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Details (optional)</label>
            <DictationMic onText={t => setDescription(d => d ? `${d}\n${t}` : t)} />
          </div>
          <textarea
            className="input min-h-[100px] resize-y"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={
              kind === FEEDBACK_KIND.BUG
                ? "What did you expect? What actually happened? Steps to reproduce?"
                : "What problem does it solve? What would the ideal flow look like?"
            }
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onSubmit(createFeedbackItem({ kind, title: title.trim(), description: description.trim() }))}
            disabled={!canSubmit}
            className="btn-primary flex-1 justify-center"
          >
            <Send size={13} />
            Submit
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
