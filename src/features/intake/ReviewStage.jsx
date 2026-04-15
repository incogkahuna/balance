import { useState } from 'react'
import {
  Film, User, Calendar, MapPin, Tag, Users, Route,
  AlertTriangle, FileText, CheckCircle, Edit3, Check,
  X, ChevronDown, ChevronUp, Sparkles, Image,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'
import { PRODUCTION_TYPE, LOCATION_TYPE } from '../../data/models.js'
import { resolveField, generateRoadmapMilestones, generateStarterTasks } from './intakeUtils.js'
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
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-orbital-subtle hover:text-orbital-text transition-all flex-shrink-0"
        >
          <Edit3 size={13} />
        </button>
      )}
      {!editing && type === 'select' && (
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-orbital-subtle hover:text-orbital-text transition-all flex-shrink-0"
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
const CONTACT_ROLES = ['Client Contact', 'Key Stakeholder', 'Technical Lead', 'Director', 'Producer', 'Other']

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
        <p className="text-sm font-medium text-orbital-text truncate">{edits?.name || contact.name || '—'}</p>
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

// ─── Milestone preview row ────────────────────────────────────────────────────
function MilestonePreviewRow({ milestone }) {
  const cfg = MILESTONE_TYPE_CONFIG[milestone.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className={`w-2.5 h-2.5 rounded-sm rotate-45 flex-shrink-0 ${cfg.dot}`} />
      <span className="text-sm text-orbital-text flex-1 truncate">{milestone.title}</span>
      <span className="text-xs text-orbital-subtle flex-shrink-0">
        {tryFormatDate(milestone.date?.split('T')[0])}
      </span>
    </div>
  )
}

// ─── ReviewStage ──────────────────────────────────────────────────────────────
export function ReviewStage({ draft, onEdit, onEditContact, onToggleConcern, onFinalize }) {
  const { extracted, answers, edits, contacts = [], concerns = [], inputs = [], contactEdits = {}, concernEdits = {} } = draft

  const resolve = field => resolveField(field, extracted, answers, edits)
  const r = {
    title:          resolve('title'),
    client:         resolve('client'),
    productionType: resolve('productionType'),
    locationType:   resolve('locationType'),
    locationName:   resolve('locationName'),
    startDate:      resolve('startDate'),
    endDate:        resolve('endDate'),
  }

  // Preview milestones + tasks
  const previewMilestones = generateRoadmapMilestones(
    r.productionType.value, r.startDate.value, r.endDate.value, ''
  )
  const previewTasks = generateStarterTasks(r.productionType.value || PRODUCTION_TYPE.OTHER, 'preview', '')

  // Missing required fields
  const missingFields = ['title', 'client'].filter(f => !resolve(f).value)

  const TYPE_OPTIONS = [
    { label: 'LED Volume',    value: PRODUCTION_TYPE.LED_VOLUME   },
    { label: 'Mobile Build',  value: PRODUCTION_TYPE.MOBILE_BUILD },
    { label: 'Other',         value: PRODUCTION_TYPE.OTHER        },
  ]
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
        <EditableField
          label="Production type" icon={Tag}
          value={r.productionType.value ? TYPE_OPTIONS.find(o => o.value === r.productionType.value)?.label : null}
          confidence={r.productionType.confidence}
          placeholder="Select type"
          type="select" options={TYPE_OPTIONS}
          onSave={v => onEdit('productionType', v)}
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

      {/* Key players */}
      <Section
        icon={Users}
        title="Key Players"
        badge={contacts.length || null}
        defaultOpen={contacts.length > 0}
      >
        {contacts.length === 0 ? (
          <p className="text-sm text-orbital-subtle italic px-1">
            No contacts found in your inputs — add them after creation.
          </p>
        ) : (
          contacts.map(c => (
            <ContactRow
              key={c.id}
              contact={c}
              edits={contactEdits[c.id]}
              onUpdate={updates => onEditContact(c.id, updates)}
              onToggle={included => onEditContact(c.id, { included })}
            />
          ))
        )}
      </Section>

      {/* Roadmap preview */}
      <Section
        icon={Route}
        title="Roadmap Milestones"
        badge={previewMilestones.length || null}
        defaultOpen={false}
      >
        {previewMilestones.length === 0 ? (
          <p className="text-sm text-orbital-subtle italic px-1">
            Set a start date above to generate a milestone roadmap.
          </p>
        ) : (
          <div className="divide-y divide-orbital-border/30 rounded-lg border border-orbital-border/30 overflow-hidden">
            {previewMilestones.map((m, i) => <MilestonePreviewRow key={i} milestone={m} />)}
          </div>
        )}
        <p className="text-xs text-orbital-subtle px-1">
          These will be added to the Roadmap tab after creation.
        </p>
      </Section>

      {/* Starter tasks */}
      <Section
        icon={CheckCircle}
        title="Starter Tasks"
        badge={previewTasks.length}
        defaultOpen={false}
      >
        <div className="space-y-1.5">
          {previewTasks.map((t, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02]">
              <div className="w-4 h-4 rounded border border-orbital-border/50 flex-shrink-0" />
              <span className="text-sm text-orbital-text">{t.title}</span>
              <span className={clsx(
                'ml-auto text-[10px] font-medium uppercase tracking-wider flex-shrink-0',
                t.priority === 'High' ? 'text-amber-400' : t.priority === 'Critical' ? 'text-red-400' : 'text-orbital-subtle/60'
              )}>
                {t.priority}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-orbital-subtle px-1">These starter tasks will be created automatically.</p>
      </Section>

      {/* Detected concerns */}
      {concerns.length > 0 && (
        <Section
          icon={AlertTriangle}
          title="Potential Concerns"
          badge={concerns.filter(c => concernEdits[c.id]?.included === true).length || null}
          defaultOpen={false}
        >
          <p className="text-xs text-orbital-subtle px-1 mb-2">
            Toggle on any concerns you want seeded into the Production Bible.
          </p>
          {concerns.map(c => {
            const included = concernEdits[c.id]?.included === true
            return (
              <div key={c.id} className={clsx(
                'flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all',
                included ? 'border-amber-500/25 bg-amber-500/5' : 'border-orbital-border/30 bg-white/[0.01]'
              )}>
                <AlertTriangle size={13} className={included ? 'text-amber-400 mt-0.5 flex-shrink-0' : 'text-orbital-subtle mt-0.5 flex-shrink-0'} />
                <p className="text-sm text-orbital-text flex-1 leading-snug">{c.title}</p>
                <button
                  onClick={() => onToggleConcern(c.id, !included)}
                  className={clsx(
                    'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                    included ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-orbital-subtle border border-orbital-border/40 hover:bg-white/10'
                  )}
                >
                  {included ? 'Included' : 'Include'}
                </button>
              </div>
            )
          })}
        </Section>
      )}

      {/* Source materials */}
      <Section
        icon={FileText}
        title="Source Materials"
        badge={inputs.length}
        defaultOpen={false}
      >
        {inputs.map(input => (
          <div key={input.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-orbital-border/30">
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
            ) : (
              <>
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-orbital-subtle" />
                </div>
                <span className="text-sm text-orbital-text flex-1 truncate">{input.fileName}</span>
                <span className="text-xs text-orbital-subtle/60">{input.content?.length} chars</span>
              </>
            )}
          </div>
        ))}
      </Section>

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
