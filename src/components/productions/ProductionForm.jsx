import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Check, Loader2, AlertCircle, Plus, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAutoSave } from '../../hooks/useAutoSave.js'
import {
  PRODUCTION_STATUS, PRODUCTION_TYPE, PRODUCTION_TYPE_PRESETS, LOCATION_TYPE, ROLES,
  createProduction, USERS
} from '../../data/models.js'

// Sentinel for the "Custom…" dropdown option. The actual saved value is
// whatever the user types in the free-form input below.
const CUSTOM_TYPE = '__custom__'

export function ProductionForm({ initial, onSubmit, onCancel, autoSave = false }) {
  const { currentUser } = useApp()
  const isEdit = Boolean(initial?.id)
  // Auto-save only when we have an existing record (something to update) AND
  // the parent has opted in. Create mode keeps the explicit submit button so
  // users don't end up with half-typed productions persisted as drafts.
  const autoSaveEnabled = autoSave && isEdit

  // Seed dateRanges from existing data. If the production has explicit
  // dateRanges (multi-window project), use those. Otherwise synthesize a
  // single range from startDate/endDate so the multi-range UI shows the
  // legacy data as the first row.
  const initialRanges = (() => {
    if (initial?.dateRanges?.length) return initial.dateRanges
    if (initial?.startDate || initial?.endDate) {
      return [{ start: initial?.startDate || '', end: initial?.endDate || '' }]
    }
    return [{ start: '', end: '' }]
  })()

  const [form, setForm] = useState({
    name: initial?.name || '',
    client: initial?.client || '',
    locationType: initial?.locationType || LOCATION_TYPE.IN_HOUSE,
    locationAddress: initial?.locationAddress || '',
    productionType: initial?.productionType || PRODUCTION_TYPE.TVC_AOTO,
    status: initial?.status || PRODUCTION_STATUS.INCOMING,
    dateRanges: initialRanges,
    assignedMembers: initial?.assignedMembers || [],
    instructionNotes: initial?.instructionPackage?.notes || '',
  })

  // Range helpers
  const updateRange = (idx, patch) => {
    setForm(f => ({
      ...f,
      dateRanges: f.dateRanges.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }))
  }
  const addRange = () => {
    setForm(f => ({ ...f, dateRanges: [...f.dateRanges, { start: '', end: '' }] }))
  }
  const removeRange = (idx) => {
    setForm(f => ({
      ...f,
      // Always keep at least one row
      dateRanges: f.dateRanges.length === 1
        ? [{ start: '', end: '' }]
        : f.dateRanges.filter((_, i) => i !== idx),
    }))
  }

  // Compute the overall envelope from the ranges. min(start) → startDate,
  // max(end) → endDate. Backwards compat for everything reading start/end.
  const { envelopeStart, envelopeEnd } = useMemo(() => {
    const starts = form.dateRanges.map(r => r.start).filter(Boolean)
    const ends   = form.dateRanges.map(r => r.end).filter(Boolean)
    return {
      envelopeStart: starts.length ? starts.slice().sort()[0] : '',
      envelopeEnd:   ends.length   ? ends.slice().sort().reverse()[0] : '',
    }
  }, [form.dateRanges])

  // Type dropdown UX: if the current productionType isn't one of the presets
  // (e.g. legacy 'LED Volume', 'Other', or a custom string), the dropdown
  // shows "Custom" and a text input below holds the actual value.
  const isCustomType = form.productionType !== '' && !PRODUCTION_TYPE_PRESETS.includes(form.productionType)
  const [showCustomType, setShowCustomType] = useState(isCustomType)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleMember = (userId) => {
    const exists = form.assignedMembers.find(m => m.userId === userId)
    if (exists) {
      set('assignedMembers', form.assignedMembers.filter(m => m.userId !== userId))
    } else {
      set('assignedMembers', [...form.assignedMembers, { userId, roleOnProduction: '' }])
    }
  }

  const setMemberRole = (userId, role) => {
    set('assignedMembers', form.assignedMembers.map(m =>
      m.userId === userId ? { ...m, roleOnProduction: role } : m
    ))
  }

  // Single source of truth: turn current form state into a production object.
  // Both the submit handler and the auto-save effect consume this.
  // Note: dateRanges is saved as-is; startDate/endDate are derived as the
  // min/max envelope so card / Gantt / Constellation views that read
  // start/end continue to render the full project span correctly.
  const cleanRanges = form.dateRanges.filter(r => r.start || r.end)
  const buildProd = () => createProduction({
    ...(initial || {}),
    name: form.name,
    client: form.client,
    locationType: form.locationType,
    locationAddress: form.locationAddress,
    productionType: form.productionType,
    status: form.status,
    startDate: envelopeStart,
    endDate:   envelopeEnd,
    dateRanges: cleanRanges,
    assignedMembers: form.assignedMembers,
    instructionPackage: {
      ...(initial?.instructionPackage || { files: [], voiceMemos: [] }),
      notes: form.instructionNotes,
    },
    createdBy: initial?.createdBy || currentUser?.id,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(buildProd())
  }

  // ── Auto-save ──────────────────────────────────────────────────────────────
  // Memoise the value we hand to the hook so its JSON.stringify diff is stable.
  // The hook debounces by 600ms — fast enough to feel instant, slow enough that
  // a burst of typing doesn't fire a save per keystroke.
  const autoSaveValue = useMemo(() => form, [form])
  const { status: saveStatus, lastSavedAt, error: saveError } = useAutoSave(
    autoSaveValue,
    () => onSubmit(buildProd()),
    { enabled: autoSaveEnabled, delay: 600 }
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {autoSaveEnabled && (
        <SaveStatus status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} />
      )}

      <div>
        <label className="label">Production Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Nike Airmax Campaign"
          required
        />
      </div>

      <div>
        <label className="label">Client</label>
        <input
          className="input"
          value={form.client}
          onChange={e => set('client', e.target.value)}
          placeholder="e.g. Nike / W+K Agency"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Type</label>
          <select
            className="select"
            value={showCustomType ? CUSTOM_TYPE : form.productionType}
            onChange={e => {
              if (e.target.value === CUSTOM_TYPE) {
                setShowCustomType(true)
                // Clear the value so the input below starts empty unless
                // the existing value was already custom (preserve in that case)
                if (PRODUCTION_TYPE_PRESETS.includes(form.productionType)) {
                  set('productionType', '')
                }
              } else {
                setShowCustomType(false)
                set('productionType', e.target.value)
              }
            }}
          >
            {PRODUCTION_TYPE_PRESETS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value={CUSTOM_TYPE}>Custom…</option>
          </select>
          {showCustomType && (
            <input
              className="input mt-2"
              value={form.productionType}
              onChange={e => set('productionType', e.target.value)}
              placeholder="Type a custom production type"
              autoFocus={!isCustomType}
            />
          )}
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.values(PRODUCTION_STATUS).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Location</label>
        <select className="select mb-2" value={form.locationType} onChange={e => set('locationType', e.target.value)}>
          {Object.values(LOCATION_TYPE).map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {form.locationType === LOCATION_TYPE.MOBILE && (
          <input
            className="input mt-2"
            value={form.locationAddress}
            onChange={e => set('locationAddress', e.target.value)}
            placeholder="Sound stage address / name"
          />
        )}
      </div>

      {/* Date ranges — one row by default; add more for projects that span
          weeks but only run on certain days. The overall envelope (min start,
          max end) is auto-derived and saved as startDate/endDate so card /
          Gantt / Constellation views render the full span. */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="label mb-0">Date Range{form.dateRanges.length > 1 ? 's' : ''}</label>
          {form.dateRanges.length > 1 && envelopeStart && envelopeEnd && (
            <span className="font-telemetry text-[9px] tracking-wider text-orbital-dim">
              ENVELOPE: {envelopeStart} → {envelopeEnd}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {form.dateRanges.map((range, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                type="date"
                className="input"
                value={range.start}
                onChange={e => updateRange(idx, { start: e.target.value })}
                aria-label={`Range ${idx + 1} start date`}
              />
              <input
                type="date"
                className="input"
                value={range.end}
                onChange={e => updateRange(idx, { end: e.target.value })}
                aria-label={`Range ${idx + 1} end date`}
              />
              <button
                type="button"
                onClick={() => removeRange(idx)}
                className="p-1.5 text-orbital-subtle hover:text-red-400 transition-colors"
                style={{ border: '1px solid var(--orbital-border)' }}
                disabled={form.dateRanges.length === 1 && !range.start && !range.end}
                title={form.dateRanges.length === 1 ? 'Clear this range' : 'Remove this range'}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRange}
          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
          style={{ border: '1px dashed var(--orbital-border)' }}
        >
          <Plus size={12} />
          Add another date range
        </button>
        <p className="text-[11px] text-orbital-dim mt-2">
          Use multiple ranges when the project runs on specific days across a longer span — e.g. one shoot day per week for a month.
        </p>
      </div>

      {/* Team — Orbital Staff */}
      <div>
        <label className="label">Team</label>
        <div className="space-y-2">
          {USERS.map(user => {
            const assigned = form.assignedMembers.find(m => m.userId === user.id)
            return (
              <div key={user.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => toggleMember(user.id)}
                  className={`flex items-center gap-2.5 flex-1 p-2.5 rounded-lg border text-left transition-colors ${
                    assigned
                      ? 'bg-blue-500/10 border-blue-500/40 text-orbital-text'
                      : 'bg-orbital-surface border-orbital-border text-orbital-subtle hover:border-orbital-muted'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs opacity-60 capitalize">{user.role}</p>
                  </div>
                  {assigned && (
                    <svg className="ml-auto w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                {assigned && (
                  <input
                    className="input w-full sm:w-40"
                    placeholder="Role on this job"
                    value={assigned.roleOnProduction}
                    onChange={e => setMemberRole(user.id, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label">Package Notes</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.instructionNotes}
          onChange={e => set('instructionNotes', e.target.value)}
          placeholder="Stage config, special notes, key contacts..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        {autoSaveEnabled ? (
          <button type="button" onClick={onCancel} className="btn-primary flex-1">
            Done
          </button>
        ) : (
          <>
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">
              {initial?.id ? 'Save Changes' : 'Create Production'}
            </button>
          </>
        )}
      </div>
    </form>
  )
}

// ── Save status pill — shown at the top of the form in auto-save mode ──────
function SaveStatus({ status, lastSavedAt, error }) {
  let icon, label, color, bg, border
  if (status === 'saving') {
    icon = <Loader2 size={11} className="animate-spin" />
    label = 'SAVING'
    color = '#fbbf24'
    bg = 'rgba(251,191,36,0.1)'
    border = 'rgba(251,191,36,0.3)'
  } else if (status === 'error') {
    icon = <AlertCircle size={11} />
    label = `SAVE FAILED · ${error || 'unknown error'}`.toUpperCase().slice(0, 80)
    color = '#ef4444'
    bg = 'rgba(239,68,68,0.1)'
    border = 'rgba(239,68,68,0.3)'
  } else if (status === 'saved' && lastSavedAt) {
    icon = <Check size={11} />
    label = `SAVED · ${format(lastSavedAt, 'HH:mm:ss')}`
    color = '#34d399'
    bg = 'rgba(52,211,153,0.1)'
    border = 'rgba(52,211,153,0.3)'
  } else {
    icon = <Check size={11} className="opacity-40" />
    label = 'AUTO-SAVE ENABLED'
    color = 'var(--orbital-subtle)'
    bg = 'transparent'
    border = 'var(--orbital-border)'
  }
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 font-telemetry text-[10px] tracking-wider"
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}
