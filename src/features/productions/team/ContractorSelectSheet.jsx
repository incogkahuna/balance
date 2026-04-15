import { useState } from 'react'
import { Search, X, Star } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { AVAILABILITY_STATUS, CONTRACTOR_FLAG } from '../../../data/models.js'
import { AvailabilityPrompt } from './AvailabilityPrompt.jsx'
import clsx from 'clsx'

const AVAIL_STYLES = {
  [AVAILABILITY_STATUS.AVAILABLE]:   'bg-green-500/15 text-green-400',
  [AVAILABILITY_STATUS.BUSY]:        'bg-amber-500/15 text-amber-400',
  [AVAILABILITY_STATUS.UNAVAILABLE]: 'bg-red-500/15 text-red-400',
}

// mode: 'assign' (add contractor) | 'stageManager' (pick stage manager)
export function ContractorSelectSheet({ production, mode = 'assign', onAssign, onClose }) {
  const { contractors } = useApp()
  const [search, setSearch] = useState('')
  const [pendingContractor, setPendingContractor] = useState(null)

  // IDs already assigned to this production
  const takenIds = new Set([
    ...(production.assignedContractors || []).map(a => a.contractorId),
    production.stageManagerId,
  ].filter(Boolean))

  const filtered = contractors.filter(c => {
    if (c.flag === CONTRACTOR_FLAG.DO_NOT_REHIRE) return false
    // In stageManager mode only exclude the current SM; in assign mode exclude all taken
    if (mode === 'stageManager' && c.id === production.stageManagerId) return false
    if (mode === 'assign' && takenIds.has(c.id)) return false
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.primaryRole.toLowerCase().includes(q)
  })

  const handleSelect = (contractor) => {
    if (contractor.availability !== AVAILABILITY_STATUS.AVAILABLE) {
      setPendingContractor(contractor)
    } else {
      onAssign(contractor)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Sheet — bottom sheet on mobile, centered modal on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-orbital-surface border-t border-orbital-border rounded-t-2xl max-h-[80vh] flex flex-col lg:inset-auto lg:fixed lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[480px] lg:max-h-[560px] lg:rounded-xl lg:border">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-orbital-border">
          <h3 className="font-semibold text-orbital-text">
            {mode === 'stageManager' ? 'Assign Stage Manager' : 'Add Contractor'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-orbital-muted transition-colors">
            <X size={16} className="text-orbital-subtle" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-orbital-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search by name or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Contractor list */}
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-orbital-subtle py-10">
              {search ? 'No contractors match your search.' : 'No contractors available to assign.'}
            </p>
          ) : (
            filtered.map(contractor => (
              <button
                key={contractor.id}
                onClick={() => handleSelect(contractor)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-orbital-muted transition-colors text-left group"
              >
                {/* Avatar */}
                {contractor.photoUrl ? (
                  <img
                    src={contractor.photoUrl}
                    alt={contractor.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orbital-muted flex items-center justify-center text-sm font-bold text-orbital-text flex-shrink-0">
                    {contractor.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-orbital-text">{contractor.name}</span>
                    {contractor.flag === CONTRACTOR_FLAG.RECOMMENDED && (
                      <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-orbital-subtle truncate">
                    {contractor.primaryRole}
                    {contractor.experienceLevel && ` · ${contractor.experienceLevel}`}
                  </p>
                </div>

                {/* Availability */}
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded flex-shrink-0',
                  AVAIL_STYLES[contractor.availability] || 'bg-orbital-muted text-orbital-subtle'
                )}>
                  {contractor.availability}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Availability warning prompt */}
      {pendingContractor && (
        <AvailabilityPrompt
          contractor={pendingContractor}
          onConfirm={() => {
            onAssign(pendingContractor)
            setPendingContractor(null)
          }}
          onCancel={() => setPendingContractor(null)}
        />
      )}
    </>
  )
}
