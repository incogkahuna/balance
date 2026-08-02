import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { createContractor, PRODUCTION_ROLE_PRESETS } from '../../../data/models.js'

// ─────────────────────────────────────────────────────────────────────────────
// Core crew slots — Danny 2026-07-25: "supervisor has a drop down from
// roster, operator has drop down, stage manager has drop down, then add
// custom position… most of the time it's those 3." Plus (same day):
// "need ability to custom input stage manager… any time a custom position
// or custom name is added add those options to database so they can also
// be in the twirl down in the future."
//
// ONE dataset, three views. The slots are quick controls over the SAME
// fields everything else reads — assignedMembers / assignedContractors
// (roleOnProduction) and stageManagerId — so the Team tab, the Overview
// tab, and the production card all update each other for free.
//
// PERSISTENCE OF CUSTOM ENTRIES, without a new table:
//  · a custom NAME becomes a real contractor row (createContractor +
//    addContractor) → it's in the DB and in every people dropdown forever.
//  · a custom POSITION is remembered by deriving the option list from every
//    title ever used across all productions (union the presets). The titles
//    already live in the productions table; reading them back is free and
//    inherently shared with the whole team — no duplicate store to drift.
// ─────────────────────────────────────────────────────────────────────────────

export const SUP_SLOT_RE = /^(project\s+)?supervisor$/i
export const OP_SLOT_RE = /^operator$/i
const CUSTOM = '__custom__'

// Members carry either the flat legacy `roleOnProduction` or the newer
// `roles.{prep,production,post}` shape — read whichever is present.
export const memberRole = (m) => m?.roleOnProduction ?? m?.roles?.production ?? ''

const withRole = (m, role) => ({
  ...m,
  roleOnProduction: role,
  ...(m.roles ? { roles: { ...m.roles, production: role } } : {}),
})

// Every position title the studio has ever used, so custom ones come back
// as suggestions next time. Derived — never stored twice.
export function useKnownPositions() {
  const { productions } = useApp()
  return useMemo(() => {
    const seen = new Set(['Supervisor', 'Operator', ...PRODUCTION_ROLE_PRESETS])
    for (const p of productions || []) {
      for (const m of p.assignedMembers || []) {
        const r = memberRole(m).trim()
        if (r) seen.add(r)
      }
      for (const c of p.assignedContractors || []) {
        const r = (c.role || '').trim()
        if (r) seen.add(r)
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [productions])
}

export function useCoreCrew(production) {
  const {
    users, contractors, updateProduction, setStageManager,
    addContractor, currentUser,
  } = useApp()
  const members = production.assignedMembers || []
  const assignedContractors = production.assignedContractors || []

  const isContractorId = (id) => (contractors || []).some((c) => c.id === id)

  // A slot's holder may be staff (assignedMembers) or a contractor
  // (assignedContractors) — check both.
  const holder = (re) => {
    const m = members.find((x) => re.test(memberRole(x).trim()))
    if (m) return m.userId
    const c = assignedContractors.find((x) => re.test((x.role || '').trim()))
    return c?.contractorId || ''
  }

  // Create a contractor row for a typed-in name so it persists and shows up
  // in future dropdowns. Returns the new id.
  const createPerson = (name, primaryRole = '') => {
    const person = createContractor({ name: name.trim(), primaryRole })
    addContractor(person)
    return person.id
  }

  // One write per change: clear the previous holder out of BOTH pools, then
  // put the new person in the right pool. Single updateProduction call, so
  // no read-modify-write race between two mutations.
  const setSlot = (re, canonical, personId) => {
    const nextMembers = members.filter(
      (m) => !(re.test(memberRole(m).trim()) && m.userId !== personId))
    const nextContractors = assignedContractors.filter(
      (c) => !(re.test((c.role || '').trim()) && c.contractorId !== personId))
    const patch = {}
    if (!personId) {
      patch.assignedMembers = nextMembers
      patch.assignedContractors = nextContractors
      return updateProduction(production.id, patch)
    }
    if (isContractorId(personId)) {
      patch.assignedMembers = nextMembers.filter((m) => m.userId !== personId)
      patch.assignedContractors = nextContractors.some((c) => c.contractorId === personId)
        ? nextContractors.map((c) => c.contractorId === personId ? { ...c, role: canonical } : c)
        : [...nextContractors, {
            contractorId: personId, role: canonical,
            assignedAt: new Date().toISOString(), assignedBy: currentUser?.id,
          }]
    } else {
      patch.assignedContractors = nextContractors.filter((c) => c.contractorId !== personId)
      patch.assignedMembers = nextMembers.some((m) => m.userId === personId)
        ? nextMembers.map((m) => m.userId === personId ? withRole(m, canonical) : m)
        : [...nextMembers, { userId: personId, roleOnProduction: canonical }]
    }
    updateProduction(production.id, patch)
  }

  const addCustom = (personId, title) => {
    const role = (title || '').trim()
    if (!personId || !role) return
    if (isContractorId(personId)) {
      const next = assignedContractors.some((c) => c.contractorId === personId)
        ? assignedContractors.map((c) => c.contractorId === personId ? { ...c, role } : c)
        : [...assignedContractors, {
            contractorId: personId, role,
            assignedAt: new Date().toISOString(), assignedBy: currentUser?.id,
          }]
      updateProduction(production.id, { assignedContractors: next })
    } else {
      const next = members.some((m) => m.userId === personId)
        ? members.map((m) => m.userId === personId ? withRole(m, role) : m)
        : [...members, { userId: personId, roleOnProduction: role }]
      updateProduction(production.id, { assignedMembers: next })
    }
  }

  // Combined people list for the dropdowns — staff first, then contractors.
  const peopleOptions = useMemo(() => ([
    ...(users || []).slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({ value: u.id, label: u.name, group: 'Orbital staff' })),
    ...(contractors || []).slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Contractors' })),
  ]), [users, contractors])

  return {
    peopleOptions,
    supervisorId: holder(SUP_SLOT_RE),
    operatorId: holder(OP_SLOT_RE),
    stageManagerId: production.stageManagerId || '',
    setSupervisor: (id) => setSlot(SUP_SLOT_RE, 'Supervisor', id),
    setOperator: (id) => setSlot(OP_SLOT_RE, 'Operator', id),
    setSM: (id) => setStageManager(production.id, id || null),
    addCustom,
    createPerson,
  }
}

// Select + inline "add a name we don't have yet". Shared by the Team tab,
// the Overview tab, and the production card so the behaviour can't diverge.
export function CrewSlotSelect({
  label, value, options, onChange, onCreatePerson, disabled, compact = false,
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const name = draft.trim()
    if (!name) { setAdding(false); return }
    const id = onCreatePerson(name)
    onChange(id)
    setDraft('')
    setAdding(false)
  }

  const groups = [...new Set(options.map((o) => o.group).filter(Boolean))]
  // A transparent select inherits the PAGE background for its native popup,
  // which on desktop renders as near-white options on a light list — the
  // "falls apart on web" Danny saw. Both variants carry a real surface
  // colour, and every option states its own colours, so the popup is
  // readable on every platform (and over a card image).
  const selectCls = compact
    ? 'w-full text-xs text-orbital-text cursor-pointer outline-none rounded-sm px-1.5 py-1 border'
    : 'w-full text-xs text-orbital-text border border-orbital-border rounded-sm px-1.5 py-1 cursor-pointer outline-none focus:border-blue-500/50 disabled:opacity-60'
  const selectStyle = {
    background: 'var(--orbital-surface)',
    color: 'var(--orbital-text)',
    ...(compact ? { borderColor: 'var(--orbital-border)' } : null),
  }
  const optionStyle = { background: 'var(--orbital-surface)', color: 'var(--orbital-text)' }

  return (
    <div className="min-w-0">
      {label && (
        <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-0.5">{label}</p>
      )}
      {adding ? (
        <input
          autoFocus
          className="w-full text-xs text-orbital-text bg-orbital-surface border border-blue-500/50 rounded-sm px-1.5 py-1 outline-none placeholder:text-orbital-dim"
          placeholder="Type a name, Enter"
          value={draft}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(''); setAdding(false) }
          }}
        />
      ) : (
        <select
          className={selectCls}
          style={selectStyle}
          value={options.some((o) => o.value === value) ? value : ''}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            if (e.target.value === CUSTOM) { setAdding(true); return }
            onChange(e.target.value)
          }}
        >
          <option value="" style={optionStyle}>—</option>
          {groups.length > 1
            ? groups.map((g) => (
                <optgroup key={g} label={g} style={optionStyle}>
                  {options.filter((o) => o.group === g).map((o) => (
                    <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>
                  ))}
                </optgroup>
              ))
            : options.map((o) => (
                <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>
              ))}
          {!disabled && <option value={CUSTOM} style={optionStyle}>+ Add someone new…</option>}
        </select>
      )}
    </div>
  )
}

// The three slots + custom-position add. Used on the Team tab and the
// Overview tab; the production card renders its own compact variant off
// the same hook.
export function CoreCrewSlots({ production, editable = true }) {
  const crew = useCoreCrew(production)
  const knownPositions = useKnownPositions()
  const [customTitle, setCustomTitle] = useState('')
  const [customUser, setCustomUser] = useState('')

  const handleAddCustom = () => {
    crew.addCustom(customUser, customTitle)
    setCustomUser('')
    setCustomTitle('')
  }

  return (
    <div className="card p-4">
      <p className="section-title mb-3">Core Crew</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CrewSlotSelect label="SUPERVISOR" value={crew.supervisorId} options={crew.peopleOptions}
          onChange={crew.setSupervisor} onCreatePerson={(n) => crew.createPerson(n, 'Supervisor')}
          disabled={!editable} />
        <CrewSlotSelect label="OPERATOR" value={crew.operatorId} options={crew.peopleOptions}
          onChange={crew.setOperator} onCreatePerson={(n) => crew.createPerson(n, 'Operator')}
          disabled={!editable} />
        <CrewSlotSelect label="STAGE MANAGER" value={crew.stageManagerId} options={crew.peopleOptions}
          onChange={crew.setSM} onCreatePerson={(n) => crew.createPerson(n, 'Stage Manager')}
          disabled={!editable} />
      </div>
      {editable && (
        <div className="flex items-end gap-2 mt-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-0.5">CUSTOM POSITION</p>
            {/* datalist = every title ever used on any production */}
            <input
              className="w-full text-xs text-orbital-text bg-orbital-surface border border-orbital-border rounded-sm px-1.5 py-1 outline-none focus:border-blue-500/50 placeholder:text-orbital-dim"
              placeholder="e.g. 2nd Operator"
              list="crew-position-titles"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom() }}
            />
            <datalist id="crew-position-titles">
              {knownPositions.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="flex-1 min-w-[120px]">
            <CrewSlotSelect
              value={customUser}
              options={crew.peopleOptions}
              onChange={setCustomUser}
              onCreatePerson={(n) => crew.createPerson(n, customTitle.trim())}
            />
          </div>
          <button
            type="button"
            className="btn-ghost text-xs py-1.5"
            disabled={!customUser || !customTitle.trim()}
            onClick={handleAddCustom}
          >
            <Plus size={13} /> Add
          </button>
        </div>
      )}
    </div>
  )
}
