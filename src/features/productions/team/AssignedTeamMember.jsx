import { useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { AVAILABILITY_STATUS } from '../../../data/models.js'
import clsx from 'clsx'

const AVAIL_STYLES = {
  [AVAILABILITY_STATUS.AVAILABLE]:   'bg-green-500/15 text-green-400 border-green-500/30',
  [AVAILABILITY_STATUS.BUSY]:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  [AVAILABILITY_STATUS.UNAVAILABLE]: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function AssignedTeamMember({ assignment, productionId, isAdminOrSup }) {
  const { getContractor, getProduction, updateProduction, removeContractor } = useApp()
  const [editingRole, setEditingRole] = useState(false)
  const [roleValue, setRoleValue] = useState(assignment.role || '')

  const contractor = getContractor(assignment.contractorId)
  if (!contractor) return null

  const handleRoleSave = () => {
    const production = getProduction(productionId)
    if (!production) return
    const updated = (production.assignedContractors || []).map(a =>
      a.contractorId === assignment.contractorId ? { ...a, role: roleValue } : a
    )
    updateProduction(productionId, { assignedContractors: updated })
    setEditingRole(false)
  }

  const avail = contractor.availability
  const availStyle = AVAIL_STYLES[avail] || 'bg-orbital-muted text-orbital-subtle border-orbital-border'

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-orbital-muted border border-orbital-border group">
      {/* Avatar */}
      {contractor.photoUrl ? (
        <img
          src={contractor.photoUrl}
          alt={contractor.name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-orbital-surface flex items-center justify-center text-sm font-bold text-orbital-text flex-shrink-0">
          {contractor.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-orbital-text">{contractor.name}</p>

        {editingRole ? (
          <div className="flex items-center gap-1 mt-1">
            <input
              className="input py-0.5 text-xs flex-1"
              value={roleValue}
              onChange={e => setRoleValue(e.target.value)}
              placeholder="Role on this production"
              onKeyDown={e => { if (e.key === 'Enter') handleRoleSave() }}
              autoFocus
            />
            <button onClick={handleRoleSave} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5">
              Save
            </button>
            <button
              onClick={() => { setRoleValue(assignment.role || ''); setEditingRole(false) }}
              className="text-xs text-orbital-subtle hover:text-orbital-text px-1 py-0.5"
            >
              ✕
            </button>
          </div>
        ) : (
          <p
            className={clsx(
              'text-xs truncate',
              isAdminOrSup && 'cursor-pointer hover:text-orbital-text'
            )}
            style={{ color: 'var(--color-orbital-subtle)' }}
            onClick={isAdminOrSup ? () => setEditingRole(true) : undefined}
            title={isAdminOrSup ? 'Click to edit role' : undefined}
          >
            {assignment.role || contractor.primaryRole}
            {isAdminOrSup && (
              <span className="ml-1 opacity-0 group-hover:opacity-50 text-orbital-subtle">✎</span>
            )}
          </p>
        )}
      </div>

      {/* Availability + remove */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={clsx('text-xs px-2 py-0.5 rounded border', availStyle)}>
          {avail}
        </span>
        {isAdminOrSup && (
          <button
            onClick={() => removeContractor(productionId, assignment.contractorId)}
            className="p-1 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove from production"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
