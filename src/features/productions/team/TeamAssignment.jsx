import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { ROLES, USERS } from '../../../data/models.js'
import { StageManagerSlot } from './StageManagerSlot.jsx'
import { AssignedTeamMember } from './AssignedTeamMember.jsx'
import { ContractorSelectSheet } from './ContractorSelectSheet.jsx'

export function TeamAssignment({ production }) {
  const { currentUser, assignContractor } = useApp()
  const [showContractorSelect, setShowContractorSelect] = useState(false)

  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const assignedContractors = production.assignedContractors || []

  const handleAssignContractor = (contractor) => {
    assignContractor(production.id, {
      contractorId: contractor.id,
      role: contractor.primaryRole,
      assignedAt: new Date().toISOString(),
      assignedBy: currentUser?.id,
    })
    setShowContractorSelect(false)
  }

  return (
    <div className="space-y-6">

      {/* Stage Manager — always shown first as a first-class field */}
      <StageManagerSlot production={production} isAdminOrSup={isAdminOrSup} />

      {/* Orbital Staff */}
      {production.assignedMembers.length > 0 && (
        <div>
          <p className="section-title mb-3">Orbital Staff</p>
          <div className="space-y-2">
            {production.assignedMembers.map(({ userId, roleOnProduction }) => {
              const user = USERS.find(u => u.id === userId)
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
                    <p className="text-sm font-medium text-orbital-text">{user.name}</p>
                    <p className="text-xs text-orbital-subtle">
                      {roleOnProduction || <span className="capitalize">{user.role}</span>}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-orbital-surface border border-orbital-border text-orbital-subtle capitalize">
                    {user.role}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
    </div>
  )
}
