import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES, AVAILABILITY_STATUS, CONTRACTOR_FLAG } from '../../data/models.js'
import { Modal } from '../../components/ui/Modal.jsx'
import { TopBar } from '../../components/layout/TopBar.jsx'
import { ContractorCard } from './ContractorCard.jsx'
import { ContractorForm } from './ContractorForm.jsx'
import { ContractorProfile } from './ContractorProfile.jsx'
import clsx from 'clsx'

const AVAIL_FILTERS = ['All', ...Object.values(AVAILABILITY_STATUS)]
const FLAG_FILTERS  = [
  { label: 'All',           value: 'All' },
  { label: '★ Recommended', value: CONTRACTOR_FLAG.RECOMMENDED },
  { label: 'Neutral',       value: CONTRACTOR_FLAG.NEUTRAL },
  { label: '⚠ Do Not Rehire', value: CONTRACTOR_FLAG.DO_NOT_REHIRE },
]

export function ContractorsPage() {
  const { currentUser, contractors, addContractor } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  // Role gate — Crew should never reach this page (nav is hidden for them)
  if (currentUser?.role === ROLES.CREW) {
    return <Navigate to="/dashboard" replace />
  }

  const isAdmin = currentUser?.role === ROLES.ADMIN

  // URL-synced filter state
  const query = params.get('q') || ''
  const avail = params.get('avail') || 'All'
  const flag  = params.get('flag')  || 'All'

  const setParam = (key, val) => {
    const next = new URLSearchParams(params)
    if (!val || val === 'All') next.delete(key)
    else next.set(key, val)
    setParams(next, { replace: true })
  }

  // Filtering
  const filtered = contractors.filter(c => {
    const q = query.toLowerCase()
    const matchQuery = !q || [
      c.name, c.primaryRole, c.location,
      ...(c.secondaryRoles || []),
      ...(c.skills || []),
    ].some(s => s?.toLowerCase().includes(q))

    const matchAvail = avail === 'All' || c.availability === avail
    const matchFlag  = flag  === 'All' || c.flag === flag

    return matchQuery && matchAvail && matchFlag
  })

  const handleAdd = (contractor) => {
    addContractor(contractor)
    setShowAdd(false)
  }

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-orbital-text">Contractors</h1>
            <p className="text-sm text-orbital-subtle mt-0.5">
              {filtered.length} of {contractors.length} crew member{contractors.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex-shrink-0">
              <Plus size={15} /> Add Contractor
            </button>
          )}
        </div>

        {/* Search */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle" />
            <input
              className="input pl-9 pr-9"
              placeholder="Search name, role, skills..."
              value={query}
              onChange={e => setParam('q', e.target.value)}
            />
            {query && (
              <button
                onClick={() => setParam('q', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-orbital-subtle hover:text-orbital-text"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {AVAIL_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setParam('avail', f)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  avail === f
                    ? 'bg-blue-600/15 border-blue-500/40 text-blue-400'
                    : 'bg-orbital-surface border-orbital-border text-orbital-subtle hover:border-orbital-muted'
                )}
              >
                {f}
              </button>
            ))}
            <span className="self-center text-orbital-border text-xs select-none">|</span>
            {FLAG_FILTERS.map(({ label, value: fVal }) => (
              <button
                key={fVal}
                onClick={() => setParam('flag', fVal)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  flag === fVal
                    ? 'bg-blue-600/15 border-blue-500/40 text-blue-400'
                    : 'bg-orbital-surface border-orbital-border text-orbital-subtle hover:border-orbital-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Roster */}
        {contractors.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-orbital-subtle mb-2">No contractors in the roster yet.</p>
            {isAdmin && (
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">
                <Plus size={15} /> Add your first contractor
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-orbital-subtle text-sm mb-2">No contractors match your filters.</p>
            <button
              onClick={() => setParams({}, { replace: true })}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {filtered.map(c => (
              <ContractorCard
                key={c.id}
                contractor={c}
                showRates={isAdmin}
                onClick={() => setSelected(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Profile modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || ''}
        size="lg"
      >
        {selected && (
          <ContractorProfile
            contractor={selected}
            onClose={() => setSelected(null)}
            onDeleted={() => setSelected(null)}
          />
        )}
      </Modal>

      {/* Add contractor modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Contractor" size="lg">
        <ContractorForm
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
    </div>
  )
}
