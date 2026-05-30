import { useState } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { AVAILABILITY_STATUS, CONTRACTOR_FLAG } from '../../data/models.js'
import { ContractorPhoto } from '../../components/files/ContractorPhoto.tsx'
import clsx from 'clsx'

const AVAIL_DOT = {
  [AVAILABILITY_STATUS.AVAILABLE]:   'bg-green-400',
  [AVAILABILITY_STATUS.BUSY]:        'bg-amber-400',
  [AVAILABILITY_STATUS.UNAVAILABLE]: 'bg-red-400',
}

/**
 * ContractorQuickAdd — used inside ProductionForm to search and attach contractors.
 *
 * Props:
 *   assignedMembers  — full assignedMembers array (users + contractors)
 *   onToggle(id)     — add or remove a contractor by id
 *   onSetRole(id, r) — update roleOnProduction for an assigned contractor
 */
export function ContractorQuickAdd({ assignedMembers, onToggle, onSetRole }) {
  const { contractors } = useApp()
  const [query, setQuery] = useState('')

  const isDNR = (c) => c.flag === CONTRACTOR_FLAG.DO_NOT_REHIRE

  const results = contractors.filter(c => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.primaryRole.toLowerCase().includes(q) ||
      c.skills?.some(s => s.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle" />
        <input
          className="input pl-9 pr-8 text-sm"
          placeholder="Search contractors by name, role, skill..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-orbital-subtle hover:text-orbital-text"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <p className="text-xs text-orbital-subtle text-center py-3">No contractors match your search.</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {results.map(c => {
            const assigned = assignedMembers.find(m => m.userId === c.id)
            const dnr = isDNR(c)
            return (
              <div key={c.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  disabled={dnr && !assigned}
                  className={clsx(
                    'flex items-center gap-2.5 flex-1 p-2.5 rounded-lg border text-left transition-colors',
                    assigned
                      ? 'bg-blue-500/10 border-blue-500/40 text-orbital-text'
                      : dnr
                        ? 'opacity-50 cursor-not-allowed bg-orbital-surface border-orbital-border text-orbital-subtle'
                        : 'bg-orbital-surface border-orbital-border text-orbital-subtle hover:border-orbital-muted'
                  )}
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-orbital-muted text-orbital-text font-semibold text-xs">
                    <ContractorPhoto
                      photoUrl={c.photoUrl}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      fallback={<span>{c.name.charAt(0).toUpperCase()}</span>}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        AVAIL_DOT[c.availability]
                      )} />
                      {dnr && (
                        <span className="text-xs text-red-400 flex-shrink-0">DNR</span>
                      )}
                    </div>
                    <p className="text-xs opacity-60 truncate">{c.primaryRole}</p>
                  </div>

                  {/* Icon matches the click action — see ProductionForm
                      for the same fix. Checkmark visually meant "saved"
                      but the click actually removed; X says "click to
                      remove" honestly. */}
                  {assigned ? (
                    <span
                      className="ml-auto flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-blue-500/15 text-blue-400"
                      aria-label="Remove from team"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Plus size={14} className="ml-auto text-orbital-dim flex-shrink-0" />
                  )}
                </button>

                {assigned && (
                  <input
                    className="input w-40 text-xs"
                    placeholder="Role on this job"
                    value={assigned.roleOnProduction}
                    onChange={e => onSetRole(c.id, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
