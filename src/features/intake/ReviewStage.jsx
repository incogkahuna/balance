import { useState, useRef } from 'react'
import {
  Film, User, Calendar, MapPin, Tag, Users, Route, Monitor,
  AlertTriangle, FileText, CheckCircle, Edit3, Check,
  X, ChevronDown, ChevronUp, Sparkles, Image, Plus, Trash2, ScanLine, Loader,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'
import {
  LOCATION_TYPE, TASK_PRIORITY, MILESTONE_TYPE, MILESTONE_STATUS, createMilestone,
} from '../../data/models.js'
import { useApp } from '../../context/AppContext.jsx'
import { resolveField, isOrbitalStaffContact } from './intakeUtils.js'
import { parseIntakeInputs } from '../../lib/parseIntake.ts'
import { MILESTONE_TYPE_CONFIG } from '../productions/roadmap/roadmapUtils.js'

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence, source }) {
  if (!confidence || confidence === 'high') return null
  const styles = {
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    low:    'bg-red-500/15   text-red-400   border-red-500/25',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[confidence]}`}>
      {confidence === 'low' ? '?' : '~'} {confidence}
    </span>
  )
}

// ─── Inline editable field ────────────────────────────────────────────────────
function EditableField({ label, icon: Icon, value, confidence, source, onSave, placeholder = 'Not set', type = 'text', options }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value || '')

  const save = () => {
    onSave(draft || null)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value || '')
    setEditing(false)
  }

  const missing = !value

  return (
    <div className={clsx(
      'group flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all',
      missing
        ? 'border-amber-500/25 bg-amber-500/5'
        : 'border-orbital-border/40 bg-white/[0.02] hover:border-orbital-border'
    )}>
      {/* Icon */}
      <div className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
        missing ? 'bg-amber-500/15' : 'bg-white/5'
      )}>
        <Icon size={14} className={missing ? 'text-amber-400' : 'text-orbital-subtle'} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-orbital-subtle mb-1">{label}</p>

        {editing ? (
          <div className="flex flex-col gap-2">
            {type === 'select' ? (
              <div className="flex flex-col gap-1.5">
                {(options || []).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setDraft(opt.value); onSave(opt.value); setEditing(false) }}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                      draft === opt.value
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-white/5 text-orbital-text hover:bg-white/10 border border-transparent'
                    )}
                  >
                    {draft === opt.value && <Check size={12} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : type === 'date' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  className="flex-1 bg-white/5 border border-orbital-border rounded-lg px-3 py-2 text-sm text-orbital-text focus:outline-none focus:border-blue-400/60"
                  autoFocus
                />
                <button onClick={save}   className="p-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25">
                  <Check size={14} />
                </button>
                <button onClick={cancel} className="p-2 rounded-lg bg-white/5 text-orbital-subtle hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
                  className="flex-1 bg-white/5 border border-orbital-border rounded-lg px-3 py-2 text-sm text-orbital-text focus:outline-none focus:border-blue-400/60"
                  autoFocus
                />
                <button onClick={save}   className="p-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25">
                  <Check size={14} />
                </button>
                <button onClick={cancel} className="p-2 rounded-lg bg-white/5 text-orbital-subtle hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-sm font-medium', missing ? 'text-amber-400/70 italic' : 'text-orbital-text')}>
              {missing ? placeholder : (type === 'date' ? tryFormatDate(value) : value)}
            </span>
            {!missing && <ConfidenceBadge confidence={confidence} source={source} />}
            {missing && (
              <span className="text-[10px] text-amber-400/60 font-medium uppercase tracking-wider">Unset</span>
            )}
          </div>
        )}
      </div>

      {/* Edit button */}
      {!editing && type !== 'select' && (
        <button
          onClick={() => { setDraft(value || ''); setEditing(true) }}
          className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-orbital-subtle hover:text-orbital-text transition-all flex-shrink-0"
        >
          <Edit3 size={13} />
        </button>
      )}
      {!editing && type === 'select' && (
        <button
          onClick={() => setEditing(true)}
          className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-orbital-subtle hover:text-orbital-text transition-all flex-shrink-0"
        >
          <Edit3 size={13} />
        </button>
      )}
    </div>
  )
}

function tryFormatDate(val) {
  if (!val) return val
  try { return format(parseISO(val), 'dd MMM yyyy') } catch { return val }
}

// ─── Add key player — manual entry or from a screenshot (item 9) ─────────────
const KEY_PLAYER_ROLES = ['Director', 'Producer', 'DP', 'Client Contact', 'Agency Contact', 'Production Manager', 'Other']

function AddKeyPlayer({ onAddContacts }) {
  const [mode, setMode] = useState(null)   // null | 'manual'
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '' })
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const fileRef = useRef(null)

  const submit = () => {
    if (!form.name.trim()) return
    onAddContacts([{
      id: crypto.randomUUID(),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: '',
      roleGuess: form.role,
      confidence: 'high',
      source: 'manual',
      sourceName: 'Added in review',
    }])
    setForm({ name: '', role: '', email: '', phone: '' })
    setMode(null)
  }

  // Screenshot → contacts, reusing the intake parser (reads email sigs,
  // call sheets, business cards). Filters out Orbital staff like the main
  // parse does.
  const handleScanFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setScanError(null)
    setScanning(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await parseIntakeInputs([
          { id: 'key-player-shot', type: 'image', preview: reader.result, fileName: file.name },
        ])
        const found = (res.contacts || [])
          .filter(c => c.name || c.email)
          .map(c => ({
            id: crypto.randomUUID(),
            name: c.name || (c.email ? c.email.split('@')[0] : ''),
            email: (c.email || '').toLowerCase(),
            phone: c.phone || '',
            company: c.company || '',
            roleGuess: c.role || '',
            confidence: 'high',
            source: 'screenshot',
            sourceName: file.name,
          }))
          .filter(c => !isOrbitalStaffContact(c))
        if (found.length === 0) setScanError('No people found in that image.')
        else onAddContacts(found)
      } catch (err) {
        setScanError(err?.message || 'Could not read that image.')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  if (mode === 'manual') {
    return (
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="bg-white/5 border border-orbital-border/40 rounded-lg px-3 py-2 text-sm text-orbital-text focus:outline-none focus:border-blue-400/60"
            placeholder="Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <select
            className="bg-white/5 border border-orbital-border/40 rounded-lg px-3 py-2 text-sm text-orbital-text focus:outline-none"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          >
            <option value="">Role…</option>
            {KEY_PLAYER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            className="bg-white/5 border border-orbital-border/40 rounded-lg px-3 py-2 text-sm text-orbital-text focus:outline-none focus:border-blue-400/60"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <input
            className="bg-white/5 border border-orbital-border/40 rounded-lg px-3 py-2 text-sm text-orbital-text focus:outline-none focus:border-blue-400/60"
            placeholder="Phone"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={!form.name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40"
          >
            <Check size={12} /> Add person
          </button>
          <button
            onClick={() => setMode(null)}
            className="px-3 py-1.5 text-xs text-orbital-subtle hover:text-orbital-text"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setMode('manual')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
      >
        <Plus size={12} /> Add person
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-orbital-subtle text-xs font-medium hover:bg-white/10 hover:text-orbital-text transition-colors disabled:opacity-50"
        title="Upload a call sheet, email signature, or business card — the AI pulls the people out"
      >
        {scanning ? <Loader size={12} className="animate-spin" /> : <ScanLine size={12} />}
        {scanning ? 'Reading…' : 'From screenshot'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { handleScanFile(e.target.files?.[0]); e.target.value = '' }}
      />
      {scanError && <span className="text-xs text-red-400">{scanError}</span>}
    </div>
  )
}

// ─── Source viewer — every source item in the create window opens (item 8) ───
function SourceViewer({ input, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,4,10,0.85)' }}
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[85vh] overflow-y-auto rounded-xl border border-orbital-border bg-orbital-surface p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-orbital-text truncate">{input.fileName || 'Source'}</p>
          <div className="flex items-center gap-2">
            {(input.type === 'image' || input.type === 'file') && input.preview && (
              <a
                href={input.preview}
                download={input.fileName || 'source'}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Download
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-orbital-subtle hover:text-orbital-text" aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>
        {input.type === 'image' && input.preview ? (
          <img src={input.preview} alt={input.fileName || ''} className="max-w-full mx-auto" />
        ) : input.type === 'file' ? (
          <p className="text-sm text-orbital-subtle text-center py-8">
            {input.fileName} — use Download above to open this document.
          </p>
        ) : (
          <pre className="text-sm text-orbital-text whitespace-pre-wrap font-sans">{input.content}</pre>
        )}
      </div>
    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ icon: Icon, title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-orbital-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          <Icon size={13} className="text-orbital-subtle" />
        </div>
        <span className="text-sm font-semibold text-orbital-text flex-1">{title}</span>
        {badge != null && (
          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        {open ? <ChevronUp size={14} className="text-orbital-subtle" /> : <ChevronDown size={14} className="text-orbital-subtle" />}
      </button>
      {open && (
        <div className="p-4 space-y-2.5 border-t border-orbital-border/30">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Contact row ──────────────────────────────────────────────────────────────
const CONTACT_ROLES = ['Director', 'Producer', 'DP', 'Client Contact', 'Agency Contact', 'Technical Lead', 'Other']

function ContactRow({ contact, edits, onUpdate, onToggle }) {
  const [editingRole, setEditingRole] = useState(false)
  const isIncluded = edits?.included !== false

  return (
    <div className={clsx(
      'flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all',
      isIncluded ? 'border-orbital-border/40 bg-white/[0.02]' : 'border-orbital-border/20 bg-white/[0.01] opacity-50'
    )}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-400">
        {(edits?.name || contact.name || '?').charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <input
          className="w-full bg-transparent text-sm font-medium text-orbital-text focus:outline-none focus:bg-white/5 rounded px-1 -mx-1 py-0.5"
          value={edits?.name ?? contact.name ?? ''}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Name"
        />
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {contact.email && <span className="text-xs text-orbital-subtle truncate max-w-[160px]">{contact.email}</span>}
          {contact.phone && <span className="text-xs text-orbital-subtle">{contact.phone}</span>}
        </div>

        {/* Role selector */}
        {editingRole ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTACT_ROLES.map(role => (
              <button
                key={role}
                onClick={() => { onUpdate({ role }); setEditingRole(false) }}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  (edits?.role || contact.roleGuess) === role
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 text-orbital-subtle hover:bg-white/10 hover:text-orbital-text'
                )}
              >
                {role}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setEditingRole(true)}
            className="mt-1.5 text-xs text-orbital-subtle/70 hover:text-blue-400 transition-colors"
          >
            {edits?.role || contact.roleGuess || '+ Assign role'}
          </button>
        )}
      </div>

      {/* Include toggle */}
      <button
        onClick={() => onToggle(!isIncluded)}
        className={clsx(
          'flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all',
          isIncluded ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-orbital-border/40 bg-white/5 text-orbital-subtle'
        )}
      >
        {isIncluded ? <Check size={11} /> : <X size={11} />}
      </button>
    </div>
  )
}

// ─── Editable milestone row (Danny items 3, 7 — parsed content is editable) ──
function MilestoneEditRow({ milestone, onChange, onDelete }) {
  const cfg = MILESTONE_TYPE_CONFIG[milestone.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 group">
      <div className={`w-2.5 h-2.5 rounded-sm rotate-45 flex-shrink-0 ${cfg.dot}`} title={milestone.type} />
      <input
        className="flex-1 min-w-0 bg-transparent text-sm text-orbital-text focus:outline-none focus:bg-white/5 rounded px-1.5 py-0.5"
        value={milestone.title}
        onChange={e => onChange({ title: e.target.value })}
        placeholder="Milestone title"
      />
      <input
        type="date"
        className="bg-white/5 border border-orbital-border/40 rounded px-2 py-1 text-xs text-orbital-text focus:outline-none flex-shrink-0"
        value={(milestone.date || '').split('T')[0]}
        onChange={e => onChange({ date: e.target.value ? `${e.target.value}T09:00` : '' })}
      />
      <button
        onClick={onDelete}
        className="p-1 rounded text-orbital-subtle hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0"
        title="Remove milestone"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── ReviewStage ──────────────────────────────────────────────────────────────
export function ReviewStage({
  draft, onEdit, onEditContact, onAddContacts, onToggleConcern, onConcernsChange,
  onToggleCrew, onToggleTask, onMilestonesChange, onStarterTasksChange, onFinalize,
}) {
  const { extracted, answers, edits, contacts = [], concerns = [], inputs = [], contactEdits = {}, concernEdits = {}, detectedCrew = [], crewEdits = {}, milestones = [], starterTasks = [] } = draft
  const { ledWalls = [], users = [] } = useApp()
  const [viewingSource, setViewingSource] = useState(null)

  const resolve = field => resolveField(field, extracted, answers, edits)
  const r = {
    title:          resolve('title'),
    client:         resolve('client'),
    productionType: resolve('productionType'),
    ledWallId:      resolve('ledWallId'),
    locationType:   resolve('locationType'),
    locationName:   resolve('locationName'),
    startDate:      resolve('startDate'),
    endDate:        resolve('endDate'),
  }

  // LED Wall picker options for the EditableField select — same flow as
  // the wall picker on ProductionForm. "None / Other" maps to empty
  // string so the dropdown shows it as the unselected state. Picking a
  // wall sets ledWallId in the draft AND mirrors the wall name into
  // productionType so downstream display sites that read the type
  // string keep showing something sensible.
  const wallOptions = [
    { value: '', label: 'None / Other' },
    ...ledWalls.map(w => ({ value: w.id, label: w.name })),
  ]
  const handleWallPick = (wallId) => {
    onEdit('ledWallId', wallId || '')
    if (wallId) {
      const w = ledWalls.find(x => x.id === wallId)
      if (w) onEdit('productionType', w.name)
    }
  }

  // Review-owned editable lists (seeded on entering this stage)
  const safeMilestones = Array.isArray(milestones) ? milestones : []
  const safeTasks = Array.isArray(starterTasks) ? starterTasks : []
  const includedTaskCount = safeTasks.filter(t => t.included).length

  const updateMilestone = (id, patch) =>
    onMilestonesChange(safeMilestones.map(m => m.id === id ? { ...m, ...patch } : m))
  const deleteMilestoneRow = (id) =>
    onMilestonesChange(safeMilestones.filter(m => m.id !== id))
  const addMilestoneRow = () =>
    onMilestonesChange([...safeMilestones, createMilestone({
      title: '', type: MILESTONE_TYPE.PRE_PRODUCTION,
      date: r.startDate.value ? `${r.startDate.value}T09:00` : '',
      status: MILESTONE_STATUS.UPCOMING,
    })])

  const updateTaskRow = (id, patch) =>
    onStarterTasksChange(safeTasks.map(t => t.id === id ? { ...t, ...patch } : t))
  const deleteTaskRow = (id) =>
    onStarterTasksChange(safeTasks.filter(t => t.id !== id))
  const addTaskRow = () =>
    onStarterTasksChange([...safeTasks, {
      id: crypto.randomUUID(), title: '', priority: TASK_PRIORITY.MEDIUM, included: true,
    }])

  const updateConcernRow = (id, patch) =>
    onConcernsChange(concerns.map(c => c.id === id ? { ...c, ...patch } : c))
  const deleteConcernRow = (id) =>
    onConcernsChange(concerns.filter(c => c.id !== id))
  const addConcernRow = () => {
    const c = {
      id: crypto.randomUUID(), title: '', description: '', category: 'general',
      confidence: 'high', include: false, source: 'manual', sourceName: 'Added in review',
    }
    onConcernsChange([...concerns, c])
    onToggleConcern(c.id, true)
  }

  // Missing required fields
  const missingFields = ['title', 'client'].filter(f => !resolve(f).value)

  const LOCATION_OPTIONS = [
    { label: 'In-House (Orbital Studios)', value: LOCATION_TYPE.IN_HOUSE },
    { label: 'Mobile / On Location',       value: LOCATION_TYPE.MOBILE  },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* Missing warning */}
      {missingFields.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-400">
            Still needed: <strong>{missingFields.join(', ')}</strong> — fill these in before creating.
          </p>
        </div>
      )}

      {/* Production basics */}
      <Section icon={Film} title="Production Basics" defaultOpen>
        <EditableField
          label="Production name" icon={Film}
          value={r.title.value} confidence={r.title.confidence} source={r.title.sourceName}
          placeholder="Enter a production name"
          onSave={v => onEdit('title', v)}
        />
        <EditableField
          label="Client / Company" icon={User}
          value={r.client.value} confidence={r.client.confidence}
          placeholder="Enter client name"
          onSave={v => onEdit('client', v)}
        />
        {/* LED Wall picker — replaces the old Production type dropdown
            here too (it was the same parallel-list confusion Danny
            flagged on the regular form). Sourced from /gear walls.
            "None / Other" preserves the free-form productionType for
            on-location shoots. Picking a wall also auto-creates a
            booking assignment after the production is saved
            (handled in IntakePage.handleFinalize). */}
        <EditableField
          label="LED Wall" icon={Monitor}
          value={
            r.ledWallId.value
              ? (ledWalls.find(w => w.id === r.ledWallId.value)?.name || 'Unknown wall')
              : (r.productionType.value || null)
          }
          confidence={r.ledWallId.confidence || r.productionType.confidence}
          placeholder="Pick an LED wall from /gear (or leave blank for none)"
          type="select" options={wallOptions}
          onSave={handleWallPick}
        />
        <EditableField
          label="Location type" icon={MapPin}
          value={r.locationType.value ? LOCATION_OPTIONS.find(o => o.value === r.locationType.value)?.label : null}
          confidence={r.locationType.confidence}
          placeholder="In-house or mobile?"
          type="select" options={LOCATION_OPTIONS}
          onSave={v => onEdit('locationType', v)}
        />
        <div className="grid grid-cols-2 gap-2">
          <EditableField
            label="Start date" icon={Calendar}
            value={r.startDate.value} confidence={r.startDate.confidence}
            placeholder="TBD" type="date"
            onSave={v => onEdit('startDate', v)}
          />
          <EditableField
            label="End date" icon={Calendar}
            value={r.endDate.value} confidence={r.endDate.confidence}
            placeholder="Same day" type="date"
            onSave={v => onEdit('endDate', v)}
          />
        </div>
        {r.locationName.value && (
          <EditableField
            label="Location name" icon={MapPin}
            value={r.locationName.value} confidence={r.locationName.confidence}
            onSave={v => onEdit('locationName', v)}
          />
        )}
      </Section>

      {/* Key players — PRODUCTION knowledge: the director, producer, DP,
          points of contact on the client side. Orbital staff are filtered
          out at parse time (they belong in Detected Crew below). Add people
          manually or from a screenshot (call sheet, email sig). */}
      <Section
        icon={Users}
        title="Key Players"
        badge={contacts.length || null}
        defaultOpen
      >
        <p className="text-xs text-orbital-subtle px-1 mb-1">
          Who matters on the production side — director, producer, DP, client points of contact. These seed the Production Bible.
        </p>
        {contacts.length === 0 && (
          <p className="text-sm text-orbital-subtle italic px-1">
            No external contacts found in your inputs yet — add them below.
          </p>
        )}
        {contacts.map(c => (
          <ContactRow
            key={c.id}
            contact={c}
            edits={contactEdits[c.id]}
            onUpdate={updates => onEditContact(c.id, updates)}
            onToggle={included => onEditContact(c.id, { included })}
          />
        ))}
        <AddKeyPlayer onAddContacts={onAddContacts} />
      </Section>

      {/* Detected crew — Orbital team members named in the inputs. Each
          comes pre-included; uncheck to leave them off the new
          production. They get auto-added to assignedMembers on finalise. */}
      {detectedCrew.length > 0 && (
        <Section
          icon={Sparkles}
          title="Detected Crew"
          badge={detectedCrew.length}
          defaultOpen
        >
          <p className="text-xs text-orbital-subtle mb-2 px-1">
            We spotted these team members in your inputs. They&apos;ll be auto-assigned to this production — uncheck any you don&apos;t want on it.
          </p>
          {detectedCrew.map(c => {
            const u = users.find(x => x.id === c.userId)
            if (!u) return null
            const isIncluded = crewEdits[c.userId]?.included !== false
            return (
              <div
                key={c.userId}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.02]"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: u.color }}
                >
                  {u.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-orbital-text font-medium">{u.name}</p>
                  <p className="text-[11px] text-orbital-subtle">
                    Matched as &ldquo;{c.matchedAs}&rdquo; · {c.confidence} confidence
                  </p>
                </div>
                <button
                  onClick={() => onToggleCrew?.(c.userId, !isIncluded)}
                  className={clsx(
                    'p-1.5 rounded transition-colors flex-shrink-0',
                    isIncluded
                      ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                      : 'bg-orbital-muted text-orbital-subtle hover:bg-white/10'
                  )}
                  title={isIncluded ? 'Click to exclude' : 'Click to include'}
                >
                  {isIncluded ? <Check size={13} /> : <X size={13} />}
                </button>
              </div>
            )
          })}
        </Section>
      )}

      {/* Roadmap milestones — seeded from parsed events (tech scouts,
          prelights, shoot days) when the AI found any, otherwise from the
          type template. Every row is editable before creation. */}
      <Section
        icon={Route}
        title="Roadmap Milestones"
        badge={safeMilestones.length || null}
        defaultOpen={safeMilestones.length > 0}
      >
        {safeMilestones.length === 0 ? (
          <p className="text-sm text-orbital-subtle italic px-1">
            Nothing dated was found — add milestones below or set a start date above.
          </p>
        ) : (
          <div className="divide-y divide-orbital-border/30 rounded-lg border border-orbital-border/30 overflow-hidden">
            {safeMilestones.map(m => (
              <MilestoneEditRow
                key={m.id}
                milestone={m}
                onChange={patch => updateMilestone(m.id, patch)}
                onDelete={() => deleteMilestoneRow(m.id)}
              />
            ))}
          </div>
        )}
        <button
          onClick={addMilestoneRow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
        >
          <Plus size={12} /> Add milestone
        </button>
        <p className="text-xs text-orbital-subtle px-1">
          These land on the Roadmap tab after creation — rename, re-date, or remove anything.
        </p>
      </Section>

      {/* Starter tasks — opt-IN suggestions, every row editable (item 4) */}
      <Section
        icon={CheckCircle}
        title="Starter Tasks"
        badge={includedTaskCount}
        defaultOpen={false}
      >
        <p className="text-xs text-orbital-subtle px-1 mb-2">
          Suggestions only — nothing is created unless ticked. Rename any row, or add your own.
        </p>
        <div className="space-y-1.5">
          {safeTasks.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group',
                t.included ? 'bg-white/[0.02]' : 'bg-white/[0.01] opacity-60'
              )}
            >
              <button
                onClick={() => updateTaskRow(t.id, { included: !t.included })}
                className={clsx(
                  'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                  t.included ? 'bg-blue-500/20 border-blue-500/50' : 'border-orbital-border/50 hover:border-orbital-chrome'
                )}
                title={t.included ? 'Will be created — click to skip' : 'Click to include'}
              >
                {t.included && <Check size={11} className="text-blue-400" />}
              </button>
              <input
                className="flex-1 min-w-0 bg-transparent text-sm text-orbital-text focus:outline-none focus:bg-white/5 rounded px-1.5 py-0.5"
                value={t.title}
                onChange={e => updateTaskRow(t.id, { title: e.target.value })}
                placeholder="Task title"
              />
              <button
                onClick={() => {
                  const order = [TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH, TASK_PRIORITY.CRITICAL]
                  const next = order[(order.indexOf(t.priority) + 1) % order.length]
                  updateTaskRow(t.id, { priority: next })
                }}
                className={clsx(
                  'text-[10px] font-medium uppercase tracking-wider flex-shrink-0 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors',
                  t.priority === 'High' ? 'text-amber-400' : t.priority === 'Critical' ? 'text-red-400' : 'text-orbital-subtle/60'
                )}
                title="Click to cycle priority"
              >
                {t.priority}
              </button>
              <button
                onClick={() => deleteTaskRow(t.id)}
                className="p-1 rounded text-orbital-subtle hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0"
                title="Remove suggestion"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addTaskRow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
        >
          <Plus size={12} /> Add task
        </button>
        <p className="text-xs text-orbital-subtle px-1">
          {includedTaskCount === 0
            ? 'No starter tasks will be created.'
            : `${includedTaskCount} task${includedTaskCount === 1 ? '' : 's'} will be created with the production.`}
        </p>
      </Section>

      {/* Potential concerns — parsed suggestions, all editable (item 7) */}
      <Section
        icon={AlertTriangle}
        title="Potential Concerns"
        badge={concerns.filter(c => concernEdits[c.id]?.included === true).length || null}
        defaultOpen={concerns.length > 0}
      >
        <p className="text-xs text-orbital-subtle px-1 mb-2">
          Toggle on any concerns to seed the Production Bible — edit the wording, remove ones that are wrong, or add your own.
        </p>
        {concerns.map(c => {
          const included = concernEdits[c.id]?.included === true
          const title = concernEdits[c.id]?.title ?? c.title
          return (
            <div key={c.id} className={clsx(
              'flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all group',
              included ? 'border-amber-500/25 bg-amber-500/5' : 'border-orbital-border/30 bg-white/[0.01]'
            )}>
              <AlertTriangle size={13} className={included ? 'text-amber-400 mt-1.5 flex-shrink-0' : 'text-orbital-subtle mt-1.5 flex-shrink-0'} />
              <input
                className="flex-1 min-w-0 bg-transparent text-sm text-orbital-text leading-snug focus:outline-none focus:bg-white/5 rounded px-1.5 py-1"
                value={title}
                onChange={e => updateConcernRow(c.id, { title: e.target.value })}
                placeholder="Describe the concern"
              />
              <button
                onClick={() => onToggleConcern(c.id, !included)}
                className={clsx(
                  'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all mt-0.5',
                  included ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-orbital-subtle border border-orbital-border/40 hover:bg-white/10'
                )}
              >
                {included ? 'Included' : 'Include'}
              </button>
              <button
                onClick={() => deleteConcernRow(c.id)}
                className="p-1 mt-0.5 rounded text-orbital-subtle hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0"
                title="Remove concern"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
        <button
          onClick={addConcernRow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
        >
          <Plus size={12} /> Add concern
        </button>
      </Section>

      {/* Source materials — every item opens (item 8) */}
      <Section
        icon={FileText}
        title="Source Materials"
        badge={inputs.length}
        defaultOpen={false}
      >
        <p className="text-xs text-orbital-subtle px-1 mb-1">Click any item to open it full size.</p>
        {inputs.map(input => (
          <button
            key={input.id}
            onClick={() => setViewingSource(input)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-orbital-border/30 text-left hover:border-orbital-chrome transition-colors"
          >
            {input.type === 'image' ? (
              <>
                {input.preview
                  ? <img src={input.preview} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  : <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Image size={13} className="text-orbital-subtle" />
                    </div>
                }
                <span className="text-sm text-orbital-text flex-1 truncate">{input.fileName}</span>
                <span className="text-xs text-orbital-subtle/60">Screenshot</span>
              </>
            ) : input.type === 'file' ? (
              <>
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-orbital-subtle" />
                </div>
                <span className="text-sm text-orbital-text flex-1 truncate">{input.fileName}</span>
                <span className="text-xs text-orbital-subtle/60">Document</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-orbital-subtle" />
                </div>
                <span className="text-sm text-orbital-text flex-1 truncate">{input.fileName}</span>
                <span className="text-xs text-orbital-subtle/60">{input.content?.length} chars</span>
              </>
            )}
          </button>
        ))}
      </Section>

      {/* Source viewer */}
      {viewingSource && (
        <SourceViewer input={viewingSource} onClose={() => setViewingSource(null)} />
      )}

      {/* Create button */}
      <div className="pt-2 pb-4">
        <button
          onClick={onFinalize}
          disabled={missingFields.length > 0}
          className={clsx(
            'w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-semibold text-base transition-all',
            missingFields.length === 0
              ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20'
              : 'bg-white/5 text-orbital-subtle cursor-not-allowed'
          )}
        >
          <Sparkles size={18} />
          Create Production
        </button>
        {missingFields.length > 0 && (
          <p className="text-xs text-center text-amber-400/80 mt-2">
            Fill in the missing fields above to continue
          </p>
        )}
      </div>
    </div>
  )
}
