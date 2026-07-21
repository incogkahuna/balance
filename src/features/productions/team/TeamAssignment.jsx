import { useState, useMemo } from 'react'
import { Plus, X, Search, UserPlus } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { ROLES } from '../../../data/models.js'
import { Modal } from '../../../components/ui/Modal.jsx'
import { StageManagerSlot } from './StageManagerSlot.jsx'
import { AssignedTeamMember } from './AssignedTeamMember.jsx'
import { ContractorSelectSheet } from './ContractorSelectSheet.jsx'

export function TeamAssignment({ production }) {
  const {
    currentUser, users, assignContractor, resolveAssignee,
    assignMember, removeMember, updateMemberRole,
  } = useApp()
  const [showContractorSelect, setShowContractorSelect] = useState(false)
  const [showMemberSelect, setShowMemberSelect] = useState(false)

  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const assignedContractors = production.assignedContractors || []
  const assignedMembers = production.assignedMembers || []

  const handleAssignContractor = (contractor) => {
    assignContractor(production.id, {
      contractorId: contractor.id,
      role: contractor.primaryRole,
      assignedAt: new Date().toISOString(),
      assignedBy: currentUser?.id,
    })
    setShowContractorSelect(false)
  }

  const handleAssignMember = (user) => {
    assignMember(production.id, { userId: user.id, roleOnProduction: '' })
    setShowMemberSelect(false)
  }

  return (
    <div className="space-y-6">

      {/* Stage Manager — always shown first as a first-class field */}
      <StageManagerSlot production={production} isAdminOrSup={isAdminOrSup} />

      {/* Orbital Staff — core salaried team, assignable right here */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Team Members</p>
          {isAdminOrSup && (
            <button
              onClick={() => setShowMemberSelect(true)}
              className="btn-ghost text-xs py-1.5"
            >
              <Plus size={13} /> Assign Staff
            </button>
          )}
        </div>

        {assignedMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-orbital-border p-6 text-center">
            <p className="text-sm text-orbital-subtle">No staff assigned yet.</p>
            {isAdminOrSup && (
              <button
                onClick={() => setShowMemberSelect(true)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
              >
                Assign a team member →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {assignedMembers.map(({ userId, roleOnProduction }) => {
              const user = resolveAssignee(userId)
              if (!user) return null
              return (
                <div
                  key={userId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-orbital-muted border border-orbital-border"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orbital-text truncate">{user.name}</p>
                    {isAdminOrSup ? (
                      <RoleOnProductionInput
                        value={roleOnProduction || ''}
                        placeholder={`Role on this production (e.g. ${user.role})`}
                        onCommit={(v) => updateMemberRole(production.id, userId, v)}
                      />
                    ) : (
                      <p className="text-xs text-orbital-subtle truncate">
                        {roleOnProduction || <span className="capitalize">{user.role}</span>}
                      </p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-orbital-surface border border-orbital-border text-orbital-subtle capitalize flex-shrink-0">
                    {user.role}
                  </span>
                  {isAdminOrSup && (
                    <button
                      onClick={() => removeMember(production.id, userId)}
                      className="text-orbital-subtle hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove from production"
                      aria-label={`Remove ${user.name}`}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contractors */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Contractors</p>
          {isAdminOrSup && (
            <button
              onClick={() => setShowContractorSelect(true)}
              className="btn-ghost text-xs py-1.5"
            >
              <Plus size={13} /> Add Contractor
            </button>
          )}
        </div>

        {assignedContractors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-orbital-border p-6 text-center">
            <p className="text-sm text-orbital-subtle">No contractors assigned yet.</p>
            {isAdminOrSup && (
              <button
                onClick={() => setShowContractorSelect(true)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
              >
                Assign a contractor →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {assignedContractors.map(assignment => (
              <AssignedTeamMember
                key={assignment.contractorId}
                assignment={assignment}
                productionId={production.id}
                isAdminOrSup={isAdminOrSup}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contractor selector sheet */}
      {showContractorSelect && (
        <ContractorSelectSheet
          production={production}
          mode="assign"
          onAssign={handleAssignContractor}
          onClose={() => setShowContractorSelect(false)}
        />
      )}

      {/* Staff selector */}
      <MemberSelectModal
        open={showMemberSelect}
        onClose={() => setShowMemberSelect(false)}
        roster={users}
        assignedMembers={assignedMembers}
        onAssign={handleAssignMember}
      />
    </div>
  )
}

// Inline editor for a member's role on this production — commits on blur/Enter.
function RoleOnProductionInput({ value, placeholder, onCommit }) {
  const [draft, setDraft] = useState(value)
  return (
    <input
      className="w-full bg-transparent text-xs text-orbital-subtle placeholder:text-orbital-dim outline-none focus:text-orbital-text truncate"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== value) onCommit(draft.trim()) }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

// Simple searchable roster picker — lists salaried staff not already assigned.
function MemberSelectModal({ open, onClose, roster, assignedMembers, onAssign }) {
  const [query, setQuery] = useState('')
  const assignedIds = useMemo(
    () => new Set((assignedMembers || []).map(m => m.userId)),
    [assignedMembers],
  )
  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (roster || [])
      .filter(u => !assignedIds.has(u.id))
      .filter(u => !q || u.name.toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [roster, assignedIds, query])

  return (
    <Modal open={open} onClose={onClose} title="Assign team member" size="sm">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-dim" />
          <input
            className="input pl-9"
            placeholder="Search staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-orbital-dim text-center py-6">
            {roster?.length ? 'Everyone is already assigned.' : 'No staff on the roster.'}
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {available.map(u => (
              <button
                key={u.id}
                onClick={() => onAssign(u)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-orbital-border hover:bg-orbital-muted transition-colors text-left"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: u.color }}
                >
                  {u.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-orbital-text truncate">{u.name}</p>
                  <p className="text-xs text-orbital-subtle capitalize">{u.role}</p>
                </div>
                <UserPlus size={15} className="text-blue-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
