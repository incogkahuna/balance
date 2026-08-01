import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Core crew slots — Danny 2026-07-25: "supervisor has a drop down from
// roster, operator has drop down, stage manager has drop down, then add
// custom position… most of the time it's those 3."
//
// ONE dataset, three views. The slots are quick controls over the SAME
// fields everything else reads — assignedMembers (roleOnProduction) and
// stageManagerId — so the Team tab, the Overview tab, and the production
// card all update each other for free. Nothing is stored twice.
//
// Slot identity is an ANCHORED role match ('Supervisor' / 'Project
// Supervisor' / 'Operator'), so a custom position like "2nd Operator"
// is never disturbed when a slot changes hands.
// ─────────────────────────────────────────────────────────────────────────────

export const SUP_SLOT_RE = /^(project\s+)?supervisor$/i
export const OP_SLOT_RE = /^operator$/i

// Members carry either the flat legacy `roleOnProduction` or the newer
// `roles.{prep,production,post}` shape — read whichever is present.
export const memberRole = (m) => m?.roleOnProduction ?? m?.roles?.production ?? ''

const withRole = (m, role) => ({
  ...m,
  roleOnProduction: role,
  ...(m.roles ? { roles: { ...m.roles, production: role } } : {}),
})

export function useCoreCrew(production) {
  const { users, contractors, updateProduction, setStageManager } = useApp()
  const members = production.assignedMembers || []

  const holder = (re) => members.find((m) => re.test(memberRole(m).trim()))

  // Single write per change — previous holder out, new holder in, one
  // assignedMembers array, no read-modify-write races between two calls.
  const setSlot = (re, canonical, userId) => {
    let next = members.filter((m) => !(re.test(memberRole(m).trim()) && m.userId !== userId))
    if (userId) {
      next = next.some((m) => m.userId === userId)
        ? next.map((m) => (m.userId === userId ? withRole(m, canonical) : m))
        : [...next, { userId, roleOnProduction: canonical }]
    }
    updateProduction(production.id, { assignedMembers: next })
  }

  const addCustom = (userId, title) => {
    if (!userId || !title.trim()) return
    const next = members.some((m) => m.userId === userId)
      ? members.map((m) => (m.userId === userId ? withRole(m, title.trim()) : m))
      : [...members, { userId, roleOnProduction: title.trim() }]
    updateProduction(production.id, { assignedMembers: next })
  }

  return {
    users,
    contractors,
    supervisorId: holder(SUP_SLOT_RE)?.userId || '',
    operatorId: holder(OP_SLOT_RE)?.userId || '',
    stageManagerId: production.stageManagerId || '',
    setSupervisor: (id) => setSlot(SUP_SLOT_RE, 'Supervisor', id),
    setOperator: (id) => setSlot(OP_SLOT_RE, 'Operator', id),
    setSM: (id) => setStageManager(production.id, id || null),
    addCustom,
  }
}

function SlotSelect({ label, value, options, onChange, disabled, placeholder = '—' }) {
  return (
    <div className="min-w-0">
      <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-0.5">{label}</p>
      <select
        className="w-full text-xs text-orbital-text bg-orbital-surface border border-orbital-border rounded-sm px-1.5 py-1 cursor-pointer outline-none focus:border-blue-500/50 disabled:opacity-60 disabled:cursor-default"
        value={value}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value) }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// The three slots + custom-position add. Used on the Team tab and the
// Overview tab; the production card renders its own compact variant off
// the same hook.
export function CoreCrewSlots({ production, editable = true }) {
  const crew = useCoreCrew(production)
  const [customTitle, setCustomTitle] = useState('')
  const [customUser, setCustomUser] = useState('')

  const staffOptions = (crew.users || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((u) => ({ value: u.id, label: u.name }))
  const contractorOptions = (crew.contractors || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }))

  const handleAddCustom = () => {
    crew.addCustom(customUser, customTitle)
    setCustomUser('')
    setCustomTitle('')
  }

  return (
    <div className="card p-4">
      <p className="section-title mb-3">Core Crew</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SlotSelect label="SUPERVISOR" value={crew.supervisorId} options={staffOptions}
          onChange={crew.setSupervisor} disabled={!editable} />
        <SlotSelect label="OPERATOR" value={crew.operatorId} options={staffOptions}
          onChange={crew.setOperator} disabled={!editable} />
        <SlotSelect label="STAGE MANAGER" value={crew.stageManagerId} options={contractorOptions}
          onChange={crew.setSM} disabled={!editable} />
      </div>
      {editable && (
        <div className="flex items-end gap-2 mt-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-0.5">CUSTOM POSITION</p>
            <input
              className="w-full text-xs text-orbital-text bg-orbital-surface border border-orbital-border rounded-sm px-1.5 py-1 outline-none focus:border-blue-500/50 placeholder:text-orbital-dim"
              placeholder="e.g. 2nd Operator"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <select
              className="w-full text-xs text-orbital-text bg-orbital-surface border border-orbital-border rounded-sm px-1.5 py-1 cursor-pointer outline-none focus:border-blue-500/50"
              value={customUser}
              onChange={(e) => setCustomUser(e.target.value)}
            >
              <option value="">Pick person…</option>
              {staffOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
