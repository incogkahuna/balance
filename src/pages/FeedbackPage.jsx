import { useState, useMemo, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Bug, Lightbulb, StickyNote, Plus, X, Send, Filter, MessageSquare, Trash2,
  CheckCircle2, Circle, AlertCircle, Ban, ClipboardCopy, CheckSquare, Square,
  ChevronDown,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import {
  ROLES, FEEDBACK_KIND, FEEDBACK_STATUS, createFeedbackItem,
} from '../data/models.js'
import { DictationMic } from '../components/voice/DictationMic.tsx'
import {
  formatFeedbackPrompt, formatFeedbackPromptBatch, copyText,
} from '../features/feedback/feedbackPrompt.js'
import { ScreenshotAttach } from '../features/feedback/ScreenshotAttach.jsx'
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
  const toast = useToast()
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const [showSubmit, setShowSubmit]   = useState(false)
  const [kindFilter, setKindFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)   // feedback item pending delete confirmation
  // Prompt list — a curated "cart" of reports built up across filters. Persists
  // as filters change, so you can gather bugs + a few ideas into one export.
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  // Closed reports (Shipped / Won't Fix) drop out of the default "All" view —
  // the board shows live work. They stay reachable via their own status chips.
  const CLOSED_STATUSES = [FEEDBACK_STATUS.SHIPPED, FEEDBACK_STATUS.WONT_FIX]
  const filtered = useMemo(() => {
    return feedbackItems
      .filter(f => kindFilter === 'all' || f.kind === kindFilter)
      .filter(f => statusFilter === 'all'
        ? !CLOSED_STATUSES.includes(f.status)
        : f.status === statusFilter)
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackItems, kindFilter, statusFilter])

  // The selected reports, newest-first — copied ALL AT ONCE regardless of the
  // current filter (they were curated deliberately).
  const selectedItems = useMemo(
    () => feedbackItems
      .filter(f => selectedIds.has(f.id))
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')),
    [feedbackItems, selectedIds],
  )

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const addAllShown = () => setSelectedIds(prev => {
    const next = new Set(prev)
    filtered.forEach(f => next.add(f.id))
    return next
  })
  const clearSelection = () => setSelectedIds(new Set())
  const allShownSelected = filtered.length > 0 && filtered.every(f => selectedIds.has(f.id))

  // Copy the whole list as one paste-ready coding-agent prompt.
  const handleCopyList = async () => {
    if (selectedItems.length === 0) return
    const text = formatFeedbackPromptBatch(selectedItems)
    const ok = await copyText(text)
    if (ok) toast.success(`Copied ${selectedItems.length} report${selectedItems.length === 1 ? '' : 's'} as a prompt`)
    else toast.error("Couldn't access the clipboard — try again")
  }

  // Batch-set status on the whole list (admin) — e.g. move everything you just
  // exported to "Acknowledged" or "In Progress" in one go.
  const applyStatusToSelected = (status) => {
    if (!status || selectedItems.length === 0) return
    selectedItems.forEach(it => updateFeedbackItem(it.id, { status }))
    toast.success(`Set ${selectedItems.length} report${selectedItems.length === 1 ? '' : 's'} to “${status}”`)
  }

  // Would this item still show under the active filters?
  const matchesView = (it) =>
    (kindFilter === 'all' || it.kind === kindFilter) &&
    (statusFilter === 'all' ? !CLOSED_STATUSES.includes(it.status) : it.status === statusFilter)

  // Single-item status change (from the row's inline pill). If the new status
  // drops the item out of the current view (e.g. → Shipped while on "All"),
  // say where it went so it never feels like the control just vanished.
  const handleSetStatus = (item, status) => {
    if (status === item.status) return
    updateFeedbackItem(item.id, { status })
    if (!matchesView({ ...item, status })) {
      toast.info(`“${item.title || 'Report'}” moved to ${status} — find it under the ${status} filter.`)
    }
  }

  // Counts for filter chip badges. Type chips count OPEN items (closed ones
  // are hidden from the default view); status chips keep per-status counts.
  const counts = useMemo(() => {
    const open     = feedbackItems.filter(f => !CLOSED_STATUSES.includes(f.status))
    const all      = open.length
    const bugs     = open.filter(f => f.kind === FEEDBACK_KIND.BUG).length
    const ideas    = open.filter(f => f.kind === FEEDBACK_KIND.IDEA).length
    const notes    = open.filter(f => f.kind === FEEDBACK_KIND.NOTE).length
    const byStatus = Object.fromEntries(
      Object.values(FEEDBACK_STATUS).map(s => [s, feedbackItems.filter(f => f.status === s).length])
    )
    return { all, bugs, ideas, notes, byStatus }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackItems])

  return (
    <div>
      {/* When the prompt-list bar is up, pad the page bottom so the last rows
          scroll clear of it instead of being covered. */}
      <div className={clsx('max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-5', selectedItems.length > 0 && 'pb-32')}>
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
          {/* Add-all toggle — bulk-add the current filter to the prompt list */}
          {filtered.length > 0 && (
            <button
              onClick={allShownSelected ? clearSelection : addAllShown}
              className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-orbital-subtle hover:text-orbital-text border border-orbital-border hover:bg-orbital-muted transition-colors"
              title="Add all reports matching the current filter to the prompt list"
            >
              {allShownSelected
                ? <><CheckSquare size={12} /> Clear shown</>
                : <><Plus size={12} /> Add all shown</>}
            </button>
          )}
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
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
                isExpanded={expandedId === item.id}
                onToggleExpand={() => setExpandedId(id => id === item.id ? null : item.id)}
                onUpdateStatus={(status) => handleSetStatus(item, status)}
                onUpdateResolution={(resolutionNote) => updateFeedbackItem(item.id, { resolutionNote })}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Prompt list bar — appears once you've added reports ── */}
      {selectedItems.length > 0 && (
        <div
          className="fixed inset-x-0 z-40 px-3 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
        >
          <div className="lg:pl-52">
            <div className="max-w-4xl mx-auto pointer-events-auto">
              <div className="card-elevated shadow-2xl flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 flex-wrap">
                <span className="text-sm font-medium text-orbital-text whitespace-nowrap">
                  <span className="font-telemetry">{selectedItems.length}</span> selected
                </span>
                <button onClick={clearSelection} className="btn-ghost text-xs">
                  <X size={13} /> Clear
                </button>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  {isAdmin && (
                    <label className="flex items-center gap-1.5 text-xs text-orbital-subtle">
                      <span className="hidden sm:inline">Set status</span>
                      <select
                        className="text-xs px-2 py-1.5 bg-orbital-surface border border-orbital-border text-orbital-text rounded cursor-pointer"
                        value=""
                        onChange={(e) => { applyStatusToSelected(e.target.value); e.target.value = '' }}
                        title="Set the status of every selected report"
                      >
                        <option value="" disabled>Change to…</option>
                        {Object.values(FEEDBACK_STATUS).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button onClick={handleCopyList} className="btn-primary text-xs">
                    <ClipboardCopy size={13} />
                    <span className="hidden sm:inline">Copy all as prompt</span>
                    <span className="sm:hidden">Prompt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

// ── StatusPillSelect — the status pill IS the dropdown (admins) ──────────────
// Always visible on the row, colored by the current status; picking a value
// changes it immediately. This is the single, obvious place to organise
// status — no need to expand the row.
function StatusPillSelect({ status, onChange }) {
  const meta = STATUS_META[status] || STATUS_META[FEEDBACK_STATUS.NEW]
  const Icon = meta.icon
  return (
    <div className="relative inline-flex items-center">
      <Icon size={11} className="absolute left-2 pointer-events-none" style={{ color: meta.color }} />
      <ChevronDown size={11} className="absolute right-1.5 pointer-events-none" style={{ color: meta.color }} />
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        title="Change status"
        className="appearance-none cursor-pointer text-[11px] font-medium pl-7 pr-5 py-1 rounded outline-none focus:ring-2"
        style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
      >
        {Object.values(FEEDBACK_STATUS).map(s => (
          <option key={s} value={s} style={{ color: 'var(--orbital-text)', background: 'var(--orbital-surface)' }}>{s}</option>
        ))}
      </select>
    </div>
  )
}

// ── FeedbackRow ─────────────────────────────────────────────────────────────
function FeedbackRow({ item, isAdmin, isSelected, onToggleSelect, isExpanded, onToggleExpand, onUpdateStatus, onUpdateResolution, onDelete }) {
  const toast = useToast()
  const kindMeta   = KIND_META[item.kind] || KIND_META[FEEDBACK_KIND.IDEA]
  const statusMeta = STATUS_META[item.status] || STATUS_META[FEEDBACK_STATUS.NEW]
  const KindIcon   = kindMeta.icon
  const StatusIcon = statusMeta.icon

  const handleCopyOne = async () => {
    const ok = await copyText(formatFeedbackPrompt(item))
    if (ok) toast.success('Report copied as a prompt')
    else toast.error("Couldn't access the clipboard — try again")
  }

  // Admin resolution-note editor state. Draft is local; Save persists.
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(item.resolutionNote || '')

  const submittedDate = item.submittedAt
    ? format(parseISO(item.submittedAt), 'MMM d, yyyy')
    : ''

  return (
    <div
      className="card-elevated overflow-hidden"
      style={{ borderLeft: `3px solid ${kindMeta.color}`, ...(isSelected ? { background: 'rgba(59,130,246,0.06)' } : null) }}
    >
      {/* Header row — checkbox and status control are SIBLINGS of the expand
          button (can't nest a button/select inside a button). The status
          control is always visible, so changing status never requires
          expanding the row. */}
      <div className="flex items-center">
        <button
          onClick={onToggleSelect}
          className="pl-4 pr-1 py-3 flex-shrink-0 transition-colors"
          style={{ color: isSelected ? '#60a5fa' : 'var(--orbital-dim)' }}
          title={isSelected ? 'Deselect' : 'Select (for batch status / prompt export)'}
          aria-pressed={isSelected}
        >
          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        <button
          onClick={onToggleExpand}
          className="flex-1 min-w-0 flex items-center gap-3 pl-2 pr-2 py-3 text-left hover:bg-orbital-muted transition-colors"
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
        </button>

        {/* Status control — admins get an inline dropdown; others a static pill */}
        <div className="pr-3 flex-shrink-0">
          {isAdmin ? (
            <StatusPillSelect status={item.status} onChange={onUpdateStatus} />
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
              style={{ color: statusMeta.color, background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}
            >
              <StatusIcon size={11} />
              {item.status}
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid var(--orbital-border)' }}>
          {item.context && (
            <p className="text-xs mt-3">
              <span className="text-orbital-dim font-telemetry tracking-wider">WHERE / EXPECTED · </span>
              <span className="text-orbital-text">{item.context}</span>
            </p>
          )}
          {item.description && (
            <p className="text-sm text-orbital-subtle whitespace-pre-wrap mt-3">{item.description}</p>
          )}
          {item.screenshot && (
            <a href={item.screenshot} target="_blank" rel="noopener noreferrer" className="block mt-3">
              <img
                src={item.screenshot}
                alt="Report screenshot"
                className="rounded border border-orbital-border max-h-72 object-contain hover:opacity-90 transition-opacity"
              />
            </a>
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

          {/* Copy this one report as a standalone prompt — everyone */}
          <div className="mt-3">
            <button
              onClick={handleCopyOne}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
              title="Copy this report as a paste-ready prompt"
            >
              <ClipboardCopy size={11} />
              Copy as prompt
            </button>
          </div>

          {/* Admin controls — status now lives on the always-visible row pill */}
          {isAdmin && (
            <>
              <div className="flex items-center gap-2 mt-4 flex-wrap">
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
  const [context, setContext]         = useState('')
  const [screenshot, setScreenshot]   = useState('')
  const formRef = useRef(null)

  const canSubmit = title.trim().length > 0

  return (
    <Modal open={true} onClose={onClose} title="New report" size="md">
      <div className="space-y-4" ref={formRef}>
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

        {/* Where / expected — the one line that makes an idea buildable first-try */}
        <div>
          <label className="label">Where in the app? (optional)</label>
          <input
            className="input"
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. Team tab, inside a production"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className="label">Screenshot (optional)</label>
          <ScreenshotAttach value={screenshot} onChange={setScreenshot} pasteScope={formRef} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onSubmit(createFeedbackItem({
              kind, title: title.trim(), description: description.trim(),
              context: context.trim(), screenshot,
            }))}
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
