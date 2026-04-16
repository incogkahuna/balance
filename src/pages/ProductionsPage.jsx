import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Plus, Search, Film, MapPin, Calendar, GripVertical, Palette, Check, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { ROLES, PRODUCTION_STATUS, TASK_STATUS } from '../data/models.js'
import { computeRoadmapHealth, HEALTH_CONFIG } from '../features/productions/roadmap/roadmapUtils.js'
import { StatusBadge, STATUS_COLOR } from '../components/ui/StatusBadge.jsx'
import { AvatarGroup } from '../components/ui/Avatar.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ProductionForm } from '../components/productions/ProductionForm.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import clsx from 'clsx'

// ── Card color palette ────────────────────────────────────────────────────────
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
  const [search, setSearch]     = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const [cardOrder, setCardOrder]     = useLocalStorage('balance_card_order', [])
  const [dragId, setDragId]           = useState(null)
  const [dragOverId, setDragOverId]   = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter    = searchParams.get('status') || 'all'
  const setStatusFilter = (s) => s === 'all' ? setSearchParams({}) : setSearchParams({ status: s })

  const canCreate = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const filtered = useMemo(() => productions.filter(p => {
    const q           = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  }), [productions, search, statusFilter])

  const sortedFiltered = useMemo(() => {
    if (cardOrder.length === 0) {
      return [...filtered].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    }
    return [...filtered].sort((a, b) => {
      const ai = cardOrder.indexOf(a.id)
      const bi = cardOrder.indexOf(b.id)
      if (ai === -1 && bi === -1) return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [filtered, cardOrder])

  const isCustomOrdered = cardOrder.length > 0

  const handleDragStart = useCallback((id) => setDragId(id), [])
  const handleDragOver  = useCallback((id) => setDragOverId(id), [])
  const handleDragEnd   = useCallback(() => { setDragId(null); setDragOverId(null) }, [])

  const handleDrop = useCallback((targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const ids     = sortedFiltered.map(p => p.id)
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

  const filterTabs = ['all', ...STATUS_ORDER]

  // Tab counts
  const countByStatus = useMemo(() => {
    const all = productions.filter(p => {
      const q = search.toLowerCase()
      return !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
    })
    const counts = { all: all.length }
    STATUS_ORDER.forEach(s => { counts[s] = all.filter(p => p.status === s).length })
    return counts
  }, [productions, search])

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-orbital-text">Productions</h1>
            {isCustomOrdered && (
              <button
                onClick={() => setCardOrder([])}
                className="flex items-center gap-1 text-[11px] text-orbital-subtle hover:text-orbital-text transition-colors"
                title="Reset to default sort order"
              >
                <RotateCcw size={11} />
                Reset order
              </button>
            )}
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/productions/new')} className="btn-primary">
                <Plus size={14} />
                <span className="hidden sm:inline">New Production</span>
                <span className="sm:hidden">New</span>
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-secondary text-xs"
                title="Quick add (minimal form)"
              >
                Quick Add
              </button>
            </div>
          )}
        </div>

        {/* ── Search + filter ── */}
        <div className="flex gap-3 mb-5 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle" />
            <input
              className="input pl-9"
              placeholder="Search productions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tab strip */}
          <div
            className="flex"
            style={{ borderBottom: '1px solid #27282e' }}
          >
            {filterTabs.map(s => {
              const isActive = statusFilter === s
              const accent   = s === 'all' ? '#3b82f6' : (STATUS_COLOR[s] || '#52525b')
              const count    = countByStatus[s] ?? 0
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5"
                  style={isActive ? {
                    color: accent,
                    borderBottom: `2px solid ${accent}`,
                    marginBottom: -1,
                  } : {
                    color: '#52525b',
                    borderBottom: '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {s === 'all' ? 'All' : s}
                  <span
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: isActive ? accent : '#3a3b42' }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Drag hint */}
        {!search && sortedFiltered.length > 1 && (
          <p className="text-[11px] text-orbital-dim mb-3 flex items-center gap-1.5">
            <GripVertical size={11} />
            {isCustomOrdered ? 'Custom order active · drag to adjust' : 'Drag to reorder'}
          </p>
        )}

        {/* ── Cards ── */}
        {sortedFiltered.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No productions found"
            description={search ? 'Try adjusting your search.' : 'Create your first production to get started.'}
            action={canCreate && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={14} /> New Production
              </button>
            )}
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
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

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorPicker({ currentColor, onSelect, onClose }) {
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [onClose])

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 p-2.5"
      style={{
        background: '#1a1b1e',
        border: '1px solid #27282e',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <p className="text-[10px] text-orbital-subtle mb-2">Card colour</p>
      <div className="grid grid-cols-5 gap-1">
        {CARD_COLORS.map(({ label, value }) => (
          <button
            key={label}
            title={label}
            onClick={() => { onSelect(value); onClose() }}
            className="w-6 h-6 flex items-center justify-center transition-opacity hover:opacity-80"
            style={value
              ? { backgroundColor: `${value}28`, border: `1px solid ${value}70` }
              : { background: '#27282e', border: '1px solid #35363e' }
            }
          >
            {currentColor === value && (
              <Check size={10} style={{ color: value || '#6e6f78' }} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Production card ───────────────────────────────────────────────────────────
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

  const prodTasks      = tasks.filter(t => t.productionId === prod.id)
  const completedTasks = prodTasks.filter(t => t.status === TASK_STATUS.VERIFIED).length
  const memberIds      = prod.assignedMembers.map(m => m.userId)
  const stageManager   = prod.stageManagerId ? getContractor(prod.stageManagerId) : null
  const health         = computeRoadmapHealth(prod.roadmap)
  const canCustomize   = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR

  const accent      = prod.cardColor || null
  const borderColor = accent || STATUS_COLOR[prod.status] || '#52525b'
  const pct         = prodTasks.length > 0 ? (completedTasks / prodTasks.length) * 100 : 0

  const locationLabel = prod.locationType === 'In-House (Orbital Studios)'
    ? 'Orbital Studios'
    : prod.locationAddress || 'Mobile'

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
        isDragging && 'opacity-40 scale-[0.97]',
        isDragOver && !isDragging && 'scale-[1.01]',
      )}
    >
      {/* Drop target outline */}
      {isDragOver && !isDragging && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ outline: '2px solid rgba(59,130,246,0.5)', outlineOffset: 2 }}
        />
      )}

      {/* Hover controls: drag handle + color picker */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canCustomize && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setPickerOpen(o => !o) }}
              className="p-1 transition-colors"
              style={{
                background: '#1a1b1e',
                border: '1px solid #27282e',
                color: '#6e6f78',
              }}
              title="Card colour"
            >
              <Palette size={11} />
              {accent && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
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
        <div
          className="p-1 cursor-grab active:cursor-grabbing"
          style={{ background: '#1a1b1e', border: '1px solid #27282e', color: '#6e6f78' }}
          title="Drag to reorder"
        >
          <GripVertical size={11} />
        </div>
      </div>

      {/* Card body */}
      <button
        onClick={onClick}
        className="card text-left w-full hover:bg-orbital-panel transition-colors overflow-hidden"
        style={{ borderLeft: `2px solid ${borderColor}` }}
      >
        {/* Row 1: type pill + name + status badge */}
        <div className="px-3 pt-2.5 pb-0 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 pr-10">
            <p className="text-sm font-semibold text-orbital-text leading-snug truncate">{prod.name}</p>
            <p className="text-[11px] text-orbital-subtle truncate mt-0.5">{prod.client}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1 mt-0.5">
            <StatusBadge status={prod.status} />
            {health !== 'On Track' && HEALTH_CONFIG[health] && (
              <span
                className="text-[10px] font-medium px-1.5 py-px"
                style={{
                  color: '#fb923c',
                  background: 'rgba(251,146,60,0.1)',
                  border: '1px solid rgba(251,146,60,0.25)',
                }}
              >
                {health}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: metadata — location, dates, stage manager */}
        <div className="px-3 pt-2 pb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[11px] text-orbital-subtle">
            <MapPin size={10} className="flex-shrink-0" />
            <span className="truncate max-w-[120px]">{locationLabel}</span>
          </span>
          {prod.startDate && (
            <span className="flex items-center gap-1 text-[11px] text-orbital-subtle font-mono">
              <Calendar size={10} className="flex-shrink-0" />
              {format(parseISO(prod.startDate), 'MMM d')}
              {prod.endDate && ` – ${format(parseISO(prod.endDate), 'MMM d')}`}
            </span>
          )}
          {stageManager && (
            <span className="text-[11px] text-orbital-subtle truncate">
              SM: {stageManager.name}
            </span>
          )}
        </div>

        {/* Row 3: avatars + task progress */}
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ borderTop: '1px solid #27282e' }}
        >
          <AvatarGroup userIds={memberIds} size="sm" />
          {prodTasks.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="w-20 h-0.5" style={{ background: '#27282e' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: borderColor }}
                />
              </div>
              <span className="text-[11px] text-orbital-subtle font-mono tabular-nums">
                {completedTasks}/{prodTasks.length}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-orbital-dim">No tasks</span>
          )}
        </div>
      </button>
    </div>
  )
}
