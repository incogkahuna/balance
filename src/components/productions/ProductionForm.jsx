import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, X, Monitor } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAutoSave } from '../../hooks/useAutoSave.js'
import { SaveStatusPill } from '../ui/SaveStatusPill.jsx'
import {
  PRODUCTION_STATUS, LOCATION_TYPE, ROLES,
  PRODUCTION_ROLE_PRESETS, normalizeAssignedMember,
  createProduction, USERS
} from '../../data/models.js'

// Sentinel for the per-phase role dropdown "Other…" option.
const CUSTOM_ROLE = '__custom_role__'

// Sentinel for the Wall picker "Other / None" option (no wall from gear).
const NO_WALL = '__no_wall__'

export function ProductionForm({ initial, onSubmit, onCancel, autoSave = false }) {
  const { currentUser, ledWalls = [], syncProductionWallAssignment } = useApp()
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
    // productionType is now driven by the picked LED wall (kept in sync as
    // the wall's name) so existing display sites that read it keep working.
    // For productions without a wall (no LED setup, on-location shoots), the
    // user can free-type a value via the "Other" option in the picker.
    productionType: initial?.productionType || '',
    ledWallId: initial?.ledWallId || null,
    status: initial?.status || PRODUCTION_STATUS.INCOMING,
    dateRanges: initialRanges,
    // Normalize each member to the new {userId, roles:{prep,production,post}}
    // shape so the UI never has to deal with the legacy roleOnProduction
    // string. Mirroring back to roleOnProduction on save keeps legacy
    // display sites working.
    assignedMembers: (initial?.assignedMembers || []).map(normalizeAssignedMember).filter(Boolean),
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

  // Wall picker UX. If the production has a ledWallId pointing to a real
  // wall, the dropdown shows that wall. Otherwise it falls back to "Other"
  // mode with a free-form text input for productionType (covers
  // on-location shoots with no wall and any legacy productionType strings
  // from before walls were first-class).
  const pickedWall = useMemo(
    () => form.ledWallId ? ledWalls.find(w => w.id === form.ledWallId) : null,
    [form.ledWallId, ledWalls]
  )
  const showCustomType = !form.ledWallId
  const handleWallPick = (value) => {
    if (value === NO_WALL) {
      setForm(f => ({ ...f, ledWallId: null }))
      // Don't clear productionType — let user edit it in the free-form input
      // below. Helps with legacy values they might want to keep.
      return
    }
    const wall = ledWalls.find(w => w.id === value)
    if (!wall) return
    setForm(f => ({ ...f, ledWallId: wall.id, productionType: wall.name }))
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleMember = (userId) => {
    const exists = form.assignedMembers.find(m => m.userId === userId)
    if (exists) {
      set('assignedMembers', form.assignedMembers.filter(m => m.userId !== userId))
    } else {
      set('assignedMembers', [
        ...form.assignedMembers,
        normalizeAssignedMember({ userId }),
      ])
    }
  }

  // Update one phase's role for a given member.
  // phase ∈ 'prep' | 'production' | 'post'.
  const setMemberRoleForPhase = (userId, phase, role) => {
    set('assignedMembers', form.assignedMembers.map(m => {
      if (m.userId !== userId) return m
      const nextRoles = { ...m.roles, [phase]: role }
      return {
        ...m,
        roles: nextRoles,
        // Keep the legacy field mirrored to the production-phase role so
        // older display sites keep showing something sensible.
        roleOnProduction: nextRoles.production,
      }
    }))
  }

  // Single source of truth: turn current form state into a production object.
  // Both the submit handler and the auto-save effect consume this.
  // Note: dateRanges is saved as-is; startDate/endDate are derived as the
  // min/max envelope so card / Gantt / Grav Map views that read
  // start/end continue to render the full project span correctly.
  const cleanRanges = form.dateRanges.filter(r => r.start || r.end)
  const buildProd = () => createProduction({
    ...(initial || {}),
    name: form.name,
    client: form.client,
    locationType: form.locationType,
    locationAddress: form.locationAddress,
    productionType: form.productionType,
    ledWallId: form.ledWallId,
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

  // ── Wall auto-assignment sync ─────────────────────────────────────────────
  // Whenever the picked wall or the production's date envelope changes (and
  // the production has been saved at least once so we have an ID), keep the
  // gear database's wall assignments in lockstep. Idempotent — the sync
  // helper finds and updates an existing auto-linked assignment if one
  // exists, otherwise creates a fresh one.
  //
  // Quiet on the first render — `lastSyncedRef` lets us only fire on actual
  // user changes, not the initial mount where the form is just hydrating
  // from existing data.
  const lastSyncedRef = useRef(null)
  useEffect(() => {
    if (!isEdit || !initial?.id) return
    const key = `${form.ledWallId || ''}|${envelopeStart || ''}|${envelopeEnd || ''}`
    if (lastSyncedRef.current === null) {
      lastSyncedRef.current = key
      return
    }
    if (lastSyncedRef.current === key) return
    lastSyncedRef.current = key
    syncProductionWallAssignment?.(initial.id, form.ledWallId, envelopeStart, envelopeEnd)
  }, [form.ledWallId, envelopeStart, envelopeEnd, isEdit, initial?.id, syncProductionWallAssignment])

  const handleSubmit = (e) => {
    e.preventDefault()
    const prod = buildProd()
    onSubmit(prod)
    // On create, the useEffect-based wall sync below never fires (it's
    // gated on isEdit). Sync once here so picking a wall on the create
    // form actually books it. On edits the useEffect handles it.
    if (!isEdit && prod.ledWallId && prod.startDate) {
      syncProductionWallAssignment?.(prod.id, prod.ledWallId, prod.startDate, prod.endDate)
    }
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
        <SaveStatusPill status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} />
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
          <label className="label inline-flex items-center gap-1.5">
            <Monitor size={11} className="text-orbital-subtle" />
            LED Wall
          </label>
          <select
            className="select"
            value={form.ledWallId || NO_WALL}
            onChange={e => handleWallPick(e.target.value)}
          >
            {ledWalls.length === 0 && (
              <option value={NO_WALL} disabled>
                No walls in /gear yet
              </option>
            )}
            <option value={NO_WALL}>— None / Other —</option>
            {ledWalls.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {showCustomType ? (
            <input
              className="input mt-2"
              value={form.productionType}
              onChange={e => set('productionType', e.target.value)}
              placeholder="Type a description (e.g. Mobile shoot, On-location, etc.)"
            />
          ) : (
            // Visible reservation hint — picking a wall on the form
            // auto-creates a matching assignment on that wall when dates
            // are set, so the user sees what's about to happen instead of
            // discovering a "phantom" assignment later in /gear.
            <p className="text-[11px] text-orbital-dim mt-2 leading-relaxed">
              {envelopeStart
                ? <>This will reserve <span className="text-orbital-subtle">{pickedWall?.name}</span> for {envelopeStart}{envelopeEnd && envelopeEnd !== envelopeStart ? ` → ${envelopeEnd}` : ''}.</>
                : <>Add a date range below to reserve this wall on the gear page.</>
              }
            </p>
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
          Gantt / Grav Map views render the full span. */}
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

      {/* Team — Orbital Staff. Each assigned member gets per-phase role
          dropdowns (Prep / Production / Post). Selecting "Other…" reveals
          a free-form text input for that phase. */}
      <div>
        <label className="label">Team</label>
        <div className="space-y-3">
          {USERS.map(user => {
            const assigned = form.assignedMembers.find(m => m.userId === user.id)
            return (
              <div
                key={user.id}
                className="rounded-lg border transition-colors"
                style={{
                  background: assigned ? 'rgba(59,130,246,0.06)' : 'var(--orbital-surface)',
                  borderColor: assigned ? 'rgba(59,130,246,0.4)' : 'var(--orbital-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleMember(user.id)}
                  className="flex items-center gap-2.5 w-full p-2.5 text-left transition-colors"
                  style={{ color: assigned ? 'var(--orbital-text)' : 'var(--orbital-subtle)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs opacity-60 capitalize">{user.role}</p>
                  </div>
                  {/* Icon matches the click action so the visual is honest:
                      a Plus when the row is "click to add", a remove-style
                      X-in-circle when the row is "click to remove". The
                      previous checkmark here read as "confirm/save" but
                      actually unassigned the user — a visual contradiction. */}
                  {assigned ? (
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-blue-500/15 text-blue-400"
                      aria-label="Remove from team"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Plus size={14} className="text-orbital-dim flex-shrink-0" />
                  )}
                </button>
                {assigned && (
                  <div className="px-2.5 pb-2.5 space-y-1.5" style={{ borderTop: '1px dashed var(--orbital-border)', paddingTop: '8px' }}>
                    <PhaseRoleSelect
                      label="PREP"
                      value={assigned.roles?.prep || ''}
                      onChange={v => setMemberRoleForPhase(user.id, 'prep', v)}
                    />
                    <PhaseRoleSelect
                      label="PROD"
                      value={assigned.roles?.production || ''}
                      onChange={v => setMemberRoleForPhase(user.id, 'production', v)}
                    />
                    <PhaseRoleSelect
                      label="POST"
                      value={assigned.roles?.post || ''}
                      onChange={v => setMemberRoleForPhase(user.id, 'post', v)}
                    />
                  </div>
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

// ── Phase role select — preset dropdown + free-form "Other…" input ────────
function PhaseRoleSelect({ label, value, onChange }) {
  const isCustom = !!value && !PRODUCTION_ROLE_PRESETS.includes(value)
  const [showCustom, setShowCustom] = useState(isCustom)

  const handleSelect = (next) => {
    if (next === CUSTOM_ROLE) {
      setShowCustom(true)
      // If they previously had a preset, clear it so the input starts empty
      if (PRODUCTION_ROLE_PRESETS.includes(value)) onChange('')
    } else {
      setShowCustom(false)
      onChange(next)
    }
  }

  return (
    <div className="grid grid-cols-[44px_1fr] gap-2 items-center">
      <label
        className="font-telemetry text-[9px] tracking-wider text-orbital-subtle"
        title={label === 'PREP' ? 'Pre-production' : label === 'PROD' ? 'Production / Shoot' : 'Post-production'}
      >
        {label}
      </label>
      <div className="flex gap-2">
        <select
          className="select flex-1 text-xs py-1.5"
          value={showCustom ? CUSTOM_ROLE : (value || '')}
          onChange={e => handleSelect(e.target.value)}
        >
          <option value="">— None —</option>
          {PRODUCTION_ROLE_PRESETS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
          <option value={CUSTOM_ROLE}>Other…</option>
        </select>
        {showCustom && (
          <input
            type="text"
            className="input flex-1 text-xs py-1.5"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Custom role"
            autoFocus={!isCustom}
          />
        )}
      </div>
    </div>
  )
}

