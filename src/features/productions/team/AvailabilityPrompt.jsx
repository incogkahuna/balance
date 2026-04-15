import { AlertTriangle } from 'lucide-react'
import { AVAILABILITY_STATUS } from '../../../data/models.js'

export function AvailabilityPrompt({ contractor, onConfirm, onCancel }) {
  const isUnavailable = contractor.availability === AVAILABILITY_STATUS.UNAVAILABLE

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
      <div className="bg-orbital-surface border border-orbital-border rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
          isUnavailable ? 'bg-red-500/15' : 'bg-amber-500/15'
        }`}>
          <AlertTriangle size={20} className={isUnavailable ? 'text-red-400' : 'text-amber-400'} />
        </div>

        <h3 className="font-semibold text-orbital-text mb-2">
          {contractor.name} is {contractor.availability}
        </h3>

        <p className="text-sm text-orbital-subtle mb-5">
          {isUnavailable
            ? `${contractor.name} is marked unavailable. Assigning them may cause scheduling conflicts.`
            : `${contractor.name} is currently busy on other work. Are you sure you want to assign them?`
          }
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isUnavailable
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            Assign Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
