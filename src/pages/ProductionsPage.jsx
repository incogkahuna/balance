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

// Status → accent color for card left border
const STATUS_COLOR = {
  [PRODUCTION_STATUS.ACTIVE]:    '#4ade80',
  [PRODUCTION_STATUS.INCOMING]:  '#60a5fa',
  [PRODUCTION_STATUS.WRAP]:      '#fbbf24',
  [PRODUCTION_STATUS.COMPLETED]: '#475569',
}

// Production type → accent color
const TYPE_COLOR = {
  'LED Volume':   '#c084fc',
  'Mobile Build': '#22d3ee',
  'Other':        '#7090a8',
}

export function ProductionsPage() {
  const { currentUser, productions, addProduction } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const [cardOrder, setCardOrder] = useLocalStorage('balance_card_order', [])
  const [dragId, setDragId]       = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

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
    const ids      = sortedFiltered.map(p => p.id)
    const fromIdx  = ids.indexOf(dragId)
    const toIdx    = ids.indexOf(targetId)
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

  // Filter tabs: "all" + each status in order
  const filterTabs = ['all', ...STATUS_ORDER]

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-0.5 h-4 flex-shrink-0" style={{ background: 'rgba(14,165,233,0.65)' }} />
              <h1 className="font-telemetry text-[11px] tracking-[0.22em]" style={{ color: '#d4e2f0' }}>
                PRODUCTIONS
              </h1>
            </div>
            {isCustomOrdered && (
              <button
                onClick={() => setCardOrder([])}
                className="flex items-center gap-1 transition-colors font-telemetry text-[8px] tracking-[0.1em]"
                style={{ color: '#4d6a82' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7090a8' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#4d6a82' }}
                title="Reset to default order"
              >
                <RotateCcw size={10} /> RESET ORDER
              </button>
            )}
          </div>

          {canCreate && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/productions/new')} className="btn-primary">
                <Plus size={15} />
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

        {/* ── Search + filter controls ── */}
        <div className="flex gap-3 mb-5 flex-col sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle" />
            <input className="input pl-9" placeholder="Search productions..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Status selector — instrument panel tab strip */}
          <div className="flex"
            style={{ border: '1px solid #1e3248', background: 'rgba(4,9,15,0.8)' }}
          >
            {filterTabs.map(s => {
              const isActive = statusFilter === s
              const col      = s === 'all' ? '#7090a8' : (STATUS_COLOR[s] || '#7090a8')
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="font-telemetry text-[9px] tracking-[0.12em] px-3 py-2 transition-all whitespace-nowrap"
                  style={isActive ? {
                    color: col,
                    background: `${col}12`,
                    borderBottom: `2px solid ${col}`,
                    borderTop: '2px solid transparent',
                    marginBottom: -1,
                  } : {
                    color: '#4d6a82',
                    borderBottom: '2px solid transparent',
                    borderTop: '2px solid transparent',
                  }}
                >
                  {s === 'all' ? 'ALL' : s.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Drag hint */}
        {!search && sortedFiltered.length > 0 && (
          <p className="font-telemetry text-[8px] tracking-[0.1em] mb-4 flex items-center gap-1.5 opacity-50" style={{ color: '#5a7a92' }}>
            <GripVertical size={11} />
            {isCustomOrdered
              ? 'CUSTOM ORDER ACTIVE · DRAG TO ADJUST'
              : 'DRAG TO REORDER · HOVER TO CUSTOMISE'}
          </p>
        )}

        {/* ── Grid ── */}
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
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
      className="absolute top-full left-0 mt-1 z-50 p-3 shadow-2xl"
      style={{
        background: '#080f18',
        border: '1px solid #1e3248',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <p className="font-telemetry text-[8px] tracking-[0.15em] mb-2" style={{ color: '#5a7a92' }}>
        CARD COLOUR
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {CARD_COLORS.map(({ label, value }) => (
          <button
            key={label}
            title={label}
            onClick={() => { onSelect(value); onClose() }}
            className="w-7 h-7 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            style={value
              ? { backgroundColor: `${value}25`, border: `1px solid ${value}80` }
              : { background: '#0f1e2e', border: '1px solid #1e3248' }
            }
          >
            {currentColor === value && (
              <Check size={11} style={{ color: value || '#7090a8' }} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Production card — instrument panel layout ─────────────────────────────────
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
  const statusColor = accent || STATUS_COLOR[prod.status] || '#475569'
  const typeColor   = TYPE_COLOR[prod.productionType] || '#7090a8'
  const pct         = prodTasks.length > 0 ? (completedTasks / prodTasks.length) * 100 : 0

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
        isDragOver  && !isDragging && 'scale-[1.01]'
      )}
    >
      {/* Drop indicator */}
      {isDragOver && !isDragging && (
        <div className="absolute inset-0 pointer-events-none z-10"
          style={{ outline: '2px solid rgba(14,165,233,0.6)', outlineOffset: 2 }} />
      )}

      {/* Hover controls */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          className="p-1 cursor-grab active:cursor-grabbing"
          style={{
            background: 'rgba(8,15,24,0.9)',
            border: '1px solid #1e3248',
            color: '#7090a8',
          }}
          title="Drag to reorder"
        >
          <GripVertical size={12} />
        </div>
        {canCustomize && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setPickerOpen(o => !o) }}
              className="p-1 transition-colors"
              style={{
                background: 'rgba(8,15,24,0.9)',
                border: `1px solid ${pickerOpen ? '#274660' : '#1e3248'}`,
                color: pickerOpen ? '#d4e2f0' : '#7090a8',
              }}
              title="Customise card colour"
            >
              <Palette size={12} />
              {accent && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: accent, border: '1px solid #060e1a' }}
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

      {/* Card */}
      <button
        onClick={onClick}
        className="card text-left w-full transition-all active:scale-[0.98] overflow-hidden"
        style={{
          borderLeft: `2px solid ${statusColor}`,
          ...(accent ? {
            borderColor: `${accent}45`,
            background: `linear-gradient(150deg, ${accent}07 0%, transparent 45%)`,
          } : {}),
        }}
      >

        {/* ── System header: type + status + health ── */}
        <div
          className="px-4 pt-3 pb-2.5 flex items-center justify-between gap-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.045)' }}
        >
          <span
            className="font-telemetry text-[8px] tracking-[0.15em] flex items-center gap-1.5"
            style={{ color: typeColor }}
          >
            <Film size={9} />
            {(prod.productionType || 'OTHER').toUpperCase().replace(' ', '-')}
          </span>

          <div className="flex items-center gap-1.5">
            {health !== 'On Track' && HEALTH_CONFIG[health] && (
              <span
                className="font-telemetry text-[8px] tracking-[0.1em]"
                style={{
                  color: '#f97316',
                  border: '1px solid rgba(249,115,22,0.35)',
                  padding: '1px 5px',
                }}
              >
                {health.toUpperCase()}
              </span>
            )}
            <StatusBadge status={prod.status} />
          </div>
        </div>

        {/* ── Identity ── */}
        <div className="px-4 py-3">
          <h3
            className="font-semibold text-sm leading-tight transition-colors"
            style={{ color: accent || '#d4e2f0' }}
          >
            {prod.name}
          </h3>
          <p className="font-telemetry text-[8px] tracking-[0.1em] mt-1" style={{ color: '#5a7a92' }}>
            {(prod.client || '').toUpperCase()}
          </p>
        </div>

        {/* ── Telemetry data rows ── */}
        <div
          className="px-4 pb-3 space-y-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.045)' }}
        >
          {stageManager && (
            <div className="flex items-center gap-2 pt-2">
              <span className="font-telemetry text-[8px] tracking-[0.1em] w-7 flex-shrink-0" style={{ color: '#4d6a82' }}>SM</span>
              <span className="text-[11px]" style={{ color: '#94afc8' }}>{stageManager.name}</span>
            </div>
          )}
          <div className={clsx('flex items-center gap-2', !stageManager && 'pt-2')}>
            <MapPin size={9} className="flex-shrink-0" style={{ color: '#4d6a82' }} />
            <span className="text-[11px] truncate" style={{ color: '#7090a8' }}>
              {prod.locationType === 'In-House (Orbital Studios)'
                ? 'Orbital Studios'
                : prod.locationAddress || 'Mobile'}
            </span>
          </div>
          {prod.startDate && (
            <div className="flex items-center gap-2">
              <Calendar size={9} className="flex-shrink-0" style={{ color: '#4d6a82' }} />
              <span className="font-telemetry text-[9px] tracking-[0.07em]" style={{ color: '#7090a8' }}>
                {format(parseISO(prod.startDate), 'MMM d').toUpperCase()}
                {prod.endDate && ` → ${format(parseISO(prod.endDate), 'MMM d').toUpperCase()}`}
              </span>
            </div>
          )}
        </div>

        {/* ── Footer: avatars + task gauge ── */}
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.045)' }}
        >
          <AvatarGroup userIds={memberIds} size="sm" />
          {prodTasks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-0.5 bg-orbital-muted overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${statusColor}, ${statusColor}99)`,
                    boxShadow: `0 0 4px ${statusColor}60`,
                  }}
                />
              </div>
              <span className="font-telemetry text-[8px]" style={{ color: '#4d6a82' }}>
                {completedTasks}/{prodTasks.length}
              </span>
            </div>
          )}
        </div>

      </button>
    </div>
  )
}
