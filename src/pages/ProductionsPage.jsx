import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Plus, Search, Film, MapPin, Calendar, GripVertical, Palette, Check, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { ROLES, PRODUCTION_STATUS, TASK_STATUS } from '../data/models.js'
import { computeRoadmapHealth, HEALTH_CONFIG } from '../features/productions/roadmap/roadmapUtils.js'
import { StatusBadge } from '../components/ui/StatusBadge.jsx'
import { AvatarGroup } from '../components/ui/Avatar.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ProductionForm } from '../components/productions/ProductionForm.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import clsx from 'clsx'

// ─── Card color palette ───────────────────────────────────────────────────────
const CARD_COLORS = [
  { label: 'Default',  value: null      },
  { label: 'Blue',     value: '#3b82f6' },
  { label: 'Indigo',   value: '#6366f1' },
  { label: 'Purple',   value: '#8b5cf6' },
  { label: 'Pink',     value: '#ec4899' },
  { label: 'Red',      value: '#ef4444' },
  { label: 'Amber',    value: '#f59e0b' },
  { label: 'Green',    value: '#22c55e' },
  { label: 'Cyan',     value: '#06b6d4' },
  { label: 'Slate',    value: '#94a3b8' },
]

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

  // Persistent card order — survives refresh, independent of production data
  const [cardOrder, setCardOrder] = useLocalStorage('balance_card_order', [])

  // Drag state lives in the page so it's shared across all card siblings
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') || 'all'
  const setStatusFilter = (status) => {
    if (status === 'all') setSearchParams({})
    else setSearchParams({ status })
  }

  const canCreate = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const filtered = useMemo(() => productions.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  }), [productions, search, statusFilter])

  // Apply custom order on top of filtered set
  const sortedFiltered = useMemo(() => {
    if (cardOrder.length === 0) {
      return [...filtered].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    }
    return [...filtered].sort((a, b) => {
      const ai = cardOrder.indexOf(a.id)
      const bi = cardOrder.indexOf(b.id)
      if (ai === -1 && bi === -1) {
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      }
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [filtered, cardOrder])

  const isCustomOrdered = cardOrder.length > 0

  // ─── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((id) => setDragId(id), [])
  const handleDragOver  = useCallback((id) => setDragOverId(id), [])
  const handleDragEnd   = useCallback(() => { setDragId(null); setDragOverId(null) }, [])

  const handleDrop = useCallback((targetId) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }
    const ids = sortedFiltered.map(p => p.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx   = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const newOrder = [...ids]
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, dragId)
    setCardOrder(newOrder)
    setDragId(null)
    setDragOverId(null)
  }, [dragId, sortedFiltered, setCardOrder])

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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-orbital-text">Productions</h1>
            {isCustomOrdered && (
              <button
                onClick={() => setCardOrder([])}
                className="flex items-center gap-1 text-xs text-orbital-subtle hover:text-orbital-text transition-colors"
                title="Reset to default order"
              >
                <RotateCcw size={12} /> Reset order
              </button>
            )}
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/productions/new')}
                className="btn-primary"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New Production</span>
                <span className="sm:hidden">New</span>
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-3 py-2 rounded-lg border border-orbital-border text-xs text-orbital-subtle hover:text-orbital-text hover:border-orbital-border/80 transition-colors"
                title="Quick add (minimal form)"
              >
                Quick Add
              </button>
            </div>
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

        {/* Drag hint — only shown when cards have been manually reordered */}
        {isCustomOrdered && !search && (
          <p className="text-xs text-orbital-subtle mb-4 flex items-center gap-1.5">
            <GripVertical size={12} /> Drag cards to reorder · hold grip handle
          </p>
        )}
        {!isCustomOrdered && sortedFiltered.length > 0 && !search && (
          <p className="text-xs text-orbital-subtle mb-4 flex items-center gap-1.5 opacity-50">
            <GripVertical size={12} /> Drag to reorder &nbsp;·&nbsp; <Palette size={12} /> Hover card to customise
          </p>
        )}

        {/* Productions grid */}
        {sortedFiltered.length === 0 ? (
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
            {sortedFiltered.map(prod => (
              <ProductionCard
                key={prod.id}
                production={prod}
                onClick={() => navigate(`/productions/${prod.id}`)}
                isDragging={dragId === prod.id}
                isDragOver={dragOverId === prod.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Production" size="lg">
        <ProductionForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function ColorPicker({ currentColor, onSelect, onClose }) {
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [onClose])

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 bg-orbital-surface border border-orbital-border rounded-xl p-3 shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-xs text-orbital-subtle mb-2 font-medium">Card colour</p>
      <div className="grid grid-cols-5 gap-1.5">
        {CARD_COLORS.map(({ label, value }) => (
          <button
            key={label}
            title={label}
            onClick={() => { onSelect(value); onClose() }}
            className={clsx(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95',
              !value && 'bg-orbital-muted border border-orbital-border'
            )}
            style={value ? { backgroundColor: value + '33', border: `1.5px solid ${value}` } : {}}
          >
            {currentColor === value && (
              <Check size={12} style={{ color: value || '#8b92a4' }} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Production Card ──────────────────────────────────────────────────────────
function ProductionCard({
  production: prod,
  onClick,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const { tasks, getContractor, currentUser, updateProduction } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)

  const prodTasks     = tasks.filter(t => t.productionId === prod.id)
  const completedTasks= prodTasks.filter(t => t.status === TASK_STATUS.VERIFIED).length
  const memberIds     = prod.assignedMembers.map(m => m.userId)
  const stageManager  = prod.stageManagerId ? getContractor(prod.stageManagerId) : null
  const health        = computeRoadmapHealth(prod.roadmap)
  const canCustomize  = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const accent        = prod.cardColor || null

  const typeColor = {
    'LED Volume':   'text-purple-400',
    'Mobile Build': 'text-cyan-400',
    'Other':        'text-orbital-subtle',
  }[prod.productionType] || 'text-orbital-subtle'

  // Card dynamic styles driven by accent colour
  const cardStyle = accent ? {
    borderColor: `${accent}50`,
    background: `linear-gradient(145deg, ${accent}12 0%, transparent 55%)`,
  } : {}

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', prod.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(prod.id)
      }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(prod.id) }}
      onDrop={(e) => { e.preventDefault(); onDrop(prod.id) }}
      onDragEnd={onDragEnd}
      className={clsx(
        'relative group transition-all duration-150',
        isDragging  && 'opacity-40 scale-[0.97]',
        isDragOver  && !isDragging && 'scale-[1.02]'
      )}
    >
      {/* Drop target ring */}
      {isDragOver && !isDragging && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-blue-500 ring-offset-2 ring-offset-orbital-bg pointer-events-none z-10" />
      )}

      {/* Accent bar across the top */}
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl z-10 pointer-events-none"
          style={{ backgroundColor: accent }}
        />
      )}

      {/* Controls overlay — visible on hover */}
      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Drag grip */}
        <div
          className="p-1 rounded-md bg-orbital-surface/90 backdrop-blur border border-orbital-border text-orbital-subtle hover:text-orbital-text cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={13} />
        </div>

        {/* Colour picker trigger */}
        {canCustomize && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setPickerOpen(o => !o) }}
              className={clsx(
                'p-1 rounded-md bg-orbital-surface/90 backdrop-blur border border-orbital-border transition-colors',
                pickerOpen
                  ? 'text-orbital-text border-orbital-muted'
                  : 'text-orbital-subtle hover:text-orbital-text'
              )}
              title="Customise card colour"
            >
              <Palette size={13} />
              {accent && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-orbital-surface"
                  style={{ backgroundColor: accent }}
                />
              )}
            </button>

            {pickerOpen && (
              <ColorPicker
                currentColor={accent}
                onSelect={(color) => updateProduction(prod.id, { cardColor: color })}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Main card — button keeps full click-to-navigate behaviour */}
      <button
        onClick={onClick}
        className="card p-5 text-left w-full hover:border-orbital-muted transition-all active:scale-[0.98] group/inner overflow-visible"
        style={cardStyle}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3 mt-1">
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold truncate group-hover/inner:text-white transition-colors"
              style={{ color: accent || undefined }}
            >
              {prod.name}
            </h3>
            <p className="text-xs text-orbital-subtle mt-0.5 truncate">{prod.client}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {health !== 'On Track' && HEALTH_CONFIG[health] && (
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${HEALTH_CONFIG[health].pill}`}>
                {HEALTH_CONFIG[health].dot} {health}
              </span>
            )}
            <StatusBadge status={prod.status} />
          </div>
        </div>

        {/* Meta rows */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-1.5 text-xs">
            <Film size={12} className={typeColor} />
            <span className={typeColor}>{prod.productionType}</span>
          </div>
          {stageManager && (
            <div className="flex items-center gap-1.5 text-xs text-orbital-subtle">
              <span style={{ color: accent || '#60a5fa' }} className="font-medium">SM:</span>
              <span>{stageManager.name}</span>
            </div>
          )}
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

        {/* Footer */}
        <div className="flex items-center justify-between">
          <AvatarGroup userIds={memberIds} size="sm" />
          {prodTasks.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-orbital-subtle">{completedTasks}/{prodTasks.length} tasks</p>
              <div className="w-20 h-1 bg-orbital-muted rounded-full mt-1 overflow-hidden">
                <div
                  className="h-1 rounded-full transition-all"
                  style={{
                    width: `${(completedTasks / prodTasks.length) * 100}%`,
                    backgroundColor: accent || '#3b82f6',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
