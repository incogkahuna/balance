import { useState } from 'react'
import { UserCheck, X } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { AVAILABILITY_STATUS } from '../../../data/models.js'
import { ContractorSelectSheet } from './ContractorSelectSheet.jsx'
import { AvailabilityPrompt } from './AvailabilityPrompt.jsx'
import clsx from 'clsx'

const AVAIL_STYLES = {
  [AVAILABILITY_STATUS.AVAILABLE]:   'bg-green-500/15 text-green-400 border-green-500/30',
  [AVAILABILITY_STATUS.BUSY]:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  [AVAILABILITY_STATUS.UNAVAILABLE]: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function StageManagerSlot({ production, isAdminOrSup }) {
  const { getContractor, setStageManager } = useApp()
  const [showSelect, setShowSelect] = useState(false)
  const [pendingContractor, setPendingContractor] = useState(null)

  const stageManager = production.stageManagerId ? getContractor(production.stageManagerId) : null

  // Called from ContractorSelectSheet — contractor may be busy/unavailable
  const handleAssign = (contractor) => {
    if (contractor.availability !== AVAILABILITY_STATUS.AVAILABLE) {
      // Sheet has already shown its own AvailabilityPrompt, but we close it
      // and let our own prompt handle confirmation so z-index stacking is clean
      setPendingContractor(contractor)
      setShowSelect(false)
      return
    }
    setStageManager(production.id, contractor.id)
    setShowSelect(false)
  }

  const handleConfirmAssign = () => {
    if (pendingContractor) {
      setStageManager(production.id, pendingContractor.id)
      setPendingContractor(null)
    }
  }

  const handleRemove = () => setStageManager(production.id, null)

  return (
    <>
      <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-3">
          <UserCheck size={14} className="text-blue-400 flex-shrink-0" />
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Stage Manager</p>
        </div>

        {stageManager ? (
          <div className="flex items-center gap-3">
            {/* Avatar */}
            {stageManager.photoUrl ? (
              <img
                src={stageManager.photoUrl}
                alt={stageManager.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orbital-muted flex items-center justify-center text-sm font-bold text-orbital-text flex-shrink-0">
                {stageManager.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orbital-text">{stageManager.name}</p>
              <p className="text-xs text-orbital-subtle">{stageManager.primaryRole}</p>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded border',
                AVAIL_STYLES[stageManager.availability] || 'bg-orbital-muted text-orbital-subtle border-orbital-border'
              )}>
                {stageManager.availability}
              </span>
              {isAdminOrSup && (
                <>
                  <button
                    onClick={() => setShowSelect(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleRemove}
                    className="p-1 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors"
                    title="Remove stage manager"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-orbital-subtle italic">No stage manager assigned</p>
            {isAdminOrSup && (
              <button
                onClick={() => setShowSelect(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Assign →
              </button>
            )}
          </div>
        )}
      </div>

      {showSelect && (
        <ContractorSelectSheet
          production={production}
          mode="stageManager"
          onAssign={handleAssign}
          onClose={() => setShowSelect(false)}
        />
      )}

      {pendingContractor && (
        <AvailabilityPrompt
          contractor={pendingContractor}
          onConfirm={handleConfirmAssign}
          onCancel={() => setPendingContractor(null)}
        />
      )}
    </>
  )
}
