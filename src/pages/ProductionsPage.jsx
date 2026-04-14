import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Plus, Search, Film, MapPin, Calendar } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, PRODUCTION_STATUS } from '../data/models.js'
import { StatusBadge } from '../components/ui/StatusBadge.jsx'
import { AvatarGroup } from '../components/ui/Avatar.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ProductionForm } from '../components/productions/ProductionForm.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'

const STATUS_ORDER = [
  PRODUCTION_STATUS.ACTIVE,
  PRODUCTION_STATUS.INCOMING,
  PRODUCTION_STATUS.WRAP,
  PRODUCTION_STATUS.COMPLETED,
]

export function ProductionsPage() {
  const { currentUser, productions, addProduction } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // Status filter is URL-synced so dashboard stat cards and other deep links
  // can land here pre-filtered (e.g. /productions?status=Active).
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') || 'all'
  const setStatusFilter = (status) => {
    if (status === 'all') setSearchParams({})
    else setSearchParams({ status })
  }

  const canCreate = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const filtered = productions
    .filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  const handleCreate = (prod) => {
    addProduction(prod)
    setShowCreate(false)
    navigate(`/productions/${prod.id}`)
  }

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-orbital-text">Productions</h1>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={16} />
              <span className="hidden sm:inline">New Production</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle" />
            <input
              className="input pl-9"
              placeholder="Search productions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', ...Object.values(PRODUCTION_STATUS)].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-orbital-text'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Productions grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No productions found"
            description={search ? 'Try adjusting your search.' : 'Create your first production to get started.'}
            action={canCreate && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={16} /> New Production
              </button>
            )}
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(prod => (
              <ProductionCard
                key={prod.id}
                production={prod}
                onClick={() => navigate(`/productions/${prod.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Production"
        size="lg"
      >
        <ProductionForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  )
}

function ProductionCard({ production: prod, onClick }) {
  const { tasks } = useApp()
  const prodTasks = tasks.filter(t => t.productionId === prod.id)
  const completedTasks = prodTasks.filter(t => t.verifiedComplete).length
  const memberIds = prod.assignedMembers.map(m => m.userId)

  const typeColor = {
    'LED Volume': 'text-purple-400',
    'Mobile Build': 'text-cyan-400',
    'Other': 'text-orbital-subtle',
  }[prod.productionType] || 'text-orbital-subtle'

  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:border-orbital-muted transition-all active:scale-[0.98] group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-orbital-text truncate group-hover:text-white transition-colors">
            {prod.name}
          </h3>
          <p className="text-xs text-orbital-subtle mt-0.5 truncate">{prod.client}</p>
        </div>
        <StatusBadge status={prod.status} className="flex-shrink-0" />
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-1.5 text-xs">
          <Film size={12} className={typeColor} />
          <span className={typeColor}>{prod.productionType}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-orbital-subtle">
          <MapPin size={12} />
          <span className="truncate">
            {prod.locationType === 'In-House (Orbital Studios)'
              ? 'Orbital Studios'
              : prod.locationAddress || 'Mobile'}
          </span>
        </div>
        {prod.startDate && (
          <div className="flex items-center gap-1.5 text-xs text-orbital-subtle">
            <Calendar size={12} />
            <span>
              {format(parseISO(prod.startDate), 'MMM d')}
              {prod.endDate && ` – ${format(parseISO(prod.endDate), 'MMM d')}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <AvatarGroup userIds={memberIds} size="sm" />
        {prodTasks.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-orbital-subtle">{completedTasks}/{prodTasks.length} tasks</p>
            <div className="w-20 h-1 bg-orbital-muted rounded-full mt-1">
              <div
                className="h-1 bg-blue-500 rounded-full transition-all"
                style={{ width: `${(completedTasks / prodTasks.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
