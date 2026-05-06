import { useState, useRef, useLayoutEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { User, HardHat, Camera, Server, Square, Users, MapPin, Layers, AlertTriangle } from 'lucide-react'
import {
  PRODUCTIONS, RESOURCES, COMMITMENTS, KIND_META,
  WINDOW_START, WINDOW_DAYS, dayIndex, dateAtDayIndex,
  productionsForResource, hasConflict, statusAtDay,
} from './sampleData.js'

const KIND_ORDER = ['people', 'gear', 'locations']

const ICONS = {
  people: User,
  gear:   Layers,
  locations: MapPin,
}

const STATUS = {
  available:      { dot: '#22c55e', label: 'AVAILABLE',      glow: 'rgba(34,197,94,0.6)'  },
  committed:      { dot: '#f59e0b', label: 'COMMITTED',      glow: 'rgba(245,158,11,0.6)' },
  overcommitted: { dot: '#ef4444', label: 'OVERCOMMITTED',  glow: 'rgba(239,68,68,0.7)'  },
}

export function ResourceRiver() {
  const [scrubDay, setScrubDay] = useState(7)               // 0..WINDOW_DAYS
  const [hoveredProd, setHoveredProd] = useState(null)
  const [hoveredRes, setHoveredRes]   = useState(null)
  const [selectedProd, setSelectedProd] = useState(null)
  const [selectedRes, setSelectedRes]   = useState(null)

  // What's "active" for highlighting — selected wins, else hover
  const activeProd = selectedProd || hoveredProd
  const activeRes  = selectedRes  || hoveredRes

  // ── Layout refs for SVG thread routing ─────────────────────────────────
  const containerRef = useRef(null)
  const bandRefs = useRef({})      // productionId -> HTMLDivElement
  const cardRefs = useRef({})      // resourceId   -> HTMLDivElement
  const [tick, setTick] = useState(0)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => setTick(t => t + 1))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Recompute thread paths whenever layout could change.
  const threads = useMemo(() => {
    if (!containerRef.current) return []
    const cBox = containerRef.current.getBoundingClientRect()
    return COMMITMENTS.map((c, i) => {
      const band = bandRefs.current[c.productionId]
      const card = cardRefs.current[c.resourceId]
      if (!band || !card) return null
      const bBox = band.getBoundingClientRect()
      const kBox = card.getBoundingClientRect()
      const totalDays = (c.end - c.start) / 86400000
      const midOffset = ((c.start - WINDOW_START) / 86400000 + totalDays / 2) / WINDOW_DAYS
      // Source x: mid of the band slice spanning the commitment, mapped from page-wide band track
      const trackBox = band.parentElement.getBoundingClientRect()
      const sx = trackBox.left - cBox.left + trackBox.width * midOffset
      const sy = bBox.bottom - cBox.top
      const tx = kBox.left + kBox.width / 2 - cBox.left
      const ty = kBox.top - cBox.top
      const prod = PRODUCTIONS.find(p => p.id === c.productionId)
      return {
        id: `${c.resourceId}-${c.productionId}-${i}`,
        sx, sy, tx, ty,
        color: prod.color,
        productionId: c.productionId,
        resourceId: c.resourceId,
      }
    }).filter(Boolean)
    // tick included to recompute on resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, scrubDay])

  // ── Thread visibility logic ────────────────────────────────────────────
  const isThreadDimmed = useCallback((t) => {
    if (!activeProd && !activeRes) return false
    if (activeProd && t.productionId !== activeProd) return true
    if (activeRes  && t.resourceId   !== activeRes)  return true
    return false
  }, [activeProd, activeRes])

  // Threads where the resource has multiple overlapping commitments → red
  const conflictedThreadIds = useMemo(() => {
    const ids = new Set()
    RESOURCES.forEach(r => {
      if (hasConflict(r.id)) {
        threads.forEach(t => { if (t.resourceId === r.id) ids.add(t.id) })
      }
    })
    return ids
  }, [threads])

  // ── Resources grouped by kind ──────────────────────────────────────────
  const grouped = useMemo(() => {
    return KIND_ORDER.reduce((acc, kind) => {
      acc[kind] = RESOURCES.filter(r => r.kind === kind)
      return acc
    }, {})
  }, [])

  const scrubDate = dateAtDayIndex(scrubDay)

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-5">
      <RiverHeader scrubDate={scrubDate} />

      <div
        ref={containerRef}
        className="relative mt-4 card-elevated"
        style={{ minHeight: 720 }}
      >
        {/* ── Production bands ─────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">PRODUCTIONS · 6-WEEK WINDOW</span>
            <div className="flex items-center gap-3 text-[10px] text-orbital-subtle font-telemetry tracking-wider">
              <span>{format(WINDOW_START, 'MMM d')}</span>
              <span>→</span>
              <span>{format(dateAtDayIndex(WINDOW_DAYS), 'MMM d, yyyy')}</span>
            </div>
          </div>
          <div className="space-y-2">
            {PRODUCTIONS.map(p => (
              <ProductionBand
                key={p.id}
                production={p}
                bandRef={el => { if (el) bandRefs.current[p.id] = el }}
                scrubDay={scrubDay}
                isDimmed={activeProd && activeProd !== p.id}
                isActive={activeProd === p.id}
                onMouseEnter={() => setHoveredProd(p.id)}
                onMouseLeave={() => setHoveredProd(null)}
                onClick={() => setSelectedProd(s => s === p.id ? null : p.id)}
              />
            ))}
          </div>
        </div>

        {/* ── SVG thread layer ─────────────────────────────────────────── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {PRODUCTIONS.map(p => (
              <linearGradient key={p.id} id={`grad-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={p.color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={p.color} stopOpacity="0.25" />
              </linearGradient>
            ))}
          </defs>
          {threads.map(t => {
            const dimmed = isThreadDimmed(t)
            const isConflict = conflictedThreadIds.has(t.id)
            const cy = (t.sy + t.ty) / 2
            const path = `M ${t.sx} ${t.sy} C ${t.sx} ${cy}, ${t.tx} ${cy}, ${t.tx} ${t.ty}`
            return (
              <g key={t.id} style={{ opacity: dimmed ? 0.06 : 1, transition: 'opacity 200ms' }}>
                <path
                  d={path}
                  fill="none"
                  stroke={isConflict ? '#ef4444' : `url(#grad-${t.productionId})`}
                  strokeWidth={isConflict ? 2 : 1.4}
                  strokeLinecap="round"
                />
                {isConflict && (
                  <path
                    d={path}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={5}
                    strokeOpacity={0.18}
                    strokeLinecap="round"
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* ── Resource swim lanes ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 px-6 pt-12 pb-6">
          {KIND_ORDER.map(kind => (
            <ResourceLane
              key={kind}
              kind={kind}
              resources={grouped[kind]}
              cardRefs={cardRefs}
              scrubDay={scrubDay}
              activeProd={activeProd}
              activeRes={activeRes}
              onResourceHover={setHoveredRes}
              onResourceClick={(id) => setSelectedRes(s => s === id ? null : id)}
            />
          ))}
        </div>

        {/* ── Bottom scrubber ──────────────────────────────────────────── */}
        <Scrubber day={scrubDay} setDay={setScrubDay} />
      </div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────
function RiverHeader({ scrubDate }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="hud-label mb-1">RESOURCE RIVER</p>
        <h1 className="text-2xl font-semibold text-orbital-text tracking-tight">
          Real-time allocation flow
        </h1>
        <p className="text-sm text-orbital-subtle mt-0.5">
          Productions claim resources. Where threads cross, conflicts surface.
        </p>
      </div>
      <div className="text-right">
        <p className="hud-label mb-1">PLAYHEAD</p>
        <p className="font-telemetry text-sm text-orbital-text tracking-wider">
          {format(scrubDate, 'EEE · MMM d, yyyy').toUpperCase()}
        </p>
      </div>
    </div>
  )
}

// ── Production band ────────────────────────────────────────────────────────
function ProductionBand({ production, bandRef, scrubDay, isDimmed, isActive, onMouseEnter, onMouseLeave, onClick }) {
  const startIdx = dayIndex(production.start)
  const endIdx   = dayIndex(production.end)
  const left  = (startIdx / WINDOW_DAYS) * 100
  const width = ((endIdx - startIdx + 1) / WINDOW_DAYS) * 100
  const playheadInside = scrubDay >= startIdx && scrubDay <= endIdx

  return (
    <div className="relative w-full" style={{ height: 28 }}>
      {/* Track baseline */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(120,120,140,0.06)',
          borderTop:  '1px solid var(--orbital-border)',
          borderBottom: '1px solid var(--orbital-border)',
        }}
      />
      {/* Day grid markers */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0"
          style={{
            left: `${(i / 6) * 100}%`,
            width: 1,
            background: 'var(--orbital-border)',
            opacity: 0.6,
          }}
        />
      ))}
      {/* Band */}
      <div
        ref={bandRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        className="absolute top-0 bottom-0 cursor-pointer transition-all"
        style={{
          left:  `${left}%`,
          width: `${width}%`,
          background: `linear-gradient(90deg, ${production.color}33, ${production.color}66, ${production.color}33)`,
          borderLeft:  `2px solid ${production.color}`,
          borderRight: `2px solid ${production.color}`,
          boxShadow: isActive ? `0 0 18px ${production.glow}` : 'none',
          opacity: isDimmed ? 0.25 : 1,
        }}
      >
        <div className="h-full flex items-center px-2.5 gap-2">
          <span
            className="font-telemetry text-[9px] tracking-[0.18em]"
            style={{ color: production.color, textShadow: `0 0 6px ${production.glow}` }}
          >
            {production.code}
          </span>
          <span className="text-[11px] font-medium text-orbital-text truncate">
            {production.name}
          </span>
          <span className="text-[10px] text-orbital-subtle ml-auto whitespace-nowrap font-telemetry">
            {format(production.start, 'MMM d')} – {format(production.end, 'MMM d')}
          </span>
        </div>
      </div>
      {/* Playhead crosshair if inside this band */}
      {playheadInside && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `calc(${(scrubDay / WINDOW_DAYS) * 100}% - 1px)`,
            width: 2,
            background: '#fff',
            mixBlendMode: 'difference',
          }}
        />
      )}
    </div>
  )
}

// ── Resource lane ──────────────────────────────────────────────────────────
function ResourceLane({ kind, resources, cardRefs, scrubDay, activeProd, activeRes, onResourceHover, onResourceClick }) {
  const Icon = ICONS[kind]
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3" style={{ background: '#3b82f6' }} />
        <Icon size={11} className="text-orbital-subtle" />
        <span className="hud-label">{KIND_META[kind].label}</span>
        <span className="text-[10px] text-orbital-dim ml-auto font-telemetry">
          {resources.length}
        </span>
      </div>
      <div className="space-y-2">
        {resources.map(r => {
          const status = statusAtDay(r.id, scrubDay)
          const conflict = hasConflict(r.id)
          const dimmed = activeProd
            ? !productionsForResource(r.id).some(p => p.id === activeProd)
            : activeRes && activeRes !== r.id
          return (
            <ResourceCard
              key={r.id}
              resource={r}
              status={status}
              conflict={conflict}
              dimmed={dimmed}
              cardRef={el => { if (el) cardRefs.current[r.id] = el }}
              onMouseEnter={() => onResourceHover(r.id)}
              onMouseLeave={() => onResourceHover(null)}
              onClick={() => onResourceClick(r.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Resource card ──────────────────────────────────────────────────────────
function ResourceCard({ resource, status, conflict, dimmed, cardRef, onMouseEnter, onMouseLeave, onClick }) {
  const meta = STATUS[status]
  const productions = productionsForResource(resource.id)
  return (
    <div
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="relative card cursor-pointer transition-all"
      style={{
        padding: '8px 10px',
        opacity: dimmed ? 0.3 : 1,
        borderColor: conflict ? '#ef4444' : 'var(--orbital-border)',
        boxShadow: conflict ? '0 0 0 1px rgba(239,68,68,0.3), 0 0 14px rgba(239,68,68,0.15)' : 'none',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`status-dot flex-shrink-0 ${conflict ? 'animate-indicator-pulse' : ''}`}
          style={{
            background: meta.dot,
            boxShadow: `0 0 6px ${meta.glow}`,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium text-orbital-text truncate">
              {resource.name}
            </span>
            {resource.contractor && (
              <span className="font-telemetry text-[8px] text-orbital-subtle tracking-widest">EXT</span>
            )}
          </div>
          <p className="text-[10px] text-orbital-subtle truncate leading-tight">
            {resource.role}
          </p>
        </div>
        {conflict && (
          <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />
        )}
      </div>
      {/* Mini production strip */}
      {productions.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          {productions.map(p => (
            <span
              key={p.id}
              className="h-0.5 flex-1"
              style={{ background: p.color, boxShadow: `0 0 4px ${p.glow}` }}
              title={p.name}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        <span
          className="font-telemetry text-[8px] tracking-[0.18em]"
          style={{ color: meta.dot, opacity: 0.85 }}
        >
          {meta.label}
        </span>
        <span className="font-telemetry text-[8px] text-orbital-dim tracking-wider">
          {productions.length} PROD
        </span>
      </div>
    </div>
  )
}

// ── Bottom scrubber ────────────────────────────────────────────────────────
function Scrubber({ day, setDay }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)

  const dayFromEvent = useCallback((e) => {
    const box = trackRef.current.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - box.left
    const ratio = Math.max(0, Math.min(1, x / box.width))
    return Math.round(ratio * WINDOW_DAYS)
  }, [])

  const onDown = (e) => {
    dragging.current = true
    setDay(dayFromEvent(e))
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
  }
  const onMove = (e) => {
    if (!dragging.current) return
    setDay(dayFromEvent(e))
  }
  const onUp = () => {
    dragging.current = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onUp)
  }

  const weeks = Array.from({ length: 7 }).map((_, i) => i)

  return (
    <div className="px-6 pt-2 pb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="hud-label">TIMELINE</span>
        <span className="font-telemetry text-[10px] text-orbital-subtle tracking-wider">
          DAY {String(day).padStart(2, '0')} / {WINDOW_DAYS}
        </span>
      </div>
      <div
        ref={trackRef}
        onMouseDown={onDown}
        onTouchStart={onDown}
        className="relative cursor-pointer select-none"
        style={{ height: 36 }}
      >
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={{ height: 2, background: 'var(--orbital-border)' }}
        />
        {weeks.map(i => (
          <div key={i}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${(i / 6) * 100}%`,
              width: 1, height: 8, background: 'var(--orbital-chrome)',
            }}
          />
        ))}
        {/* Track labels */}
        {weeks.map(i => (
          <span key={i}
            className="absolute -bottom-1 -translate-x-1/2 font-telemetry text-[9px] text-orbital-subtle tracking-wider"
            style={{ left: `${(i / 6) * 100}%` }}
          >
            {format(dateAtDayIndex(i * 7), 'MMM d')}
          </span>
        ))}
        {/* Filled portion */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: 0,
            width: `${(day / WINDOW_DAYS) * 100}%`,
            height: 2, background: '#3b82f6',
            boxShadow: '0 0 8px rgba(59,130,246,0.8)',
          }}
        />
        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            left: `${(day / WINDOW_DAYS) * 100}%`,
            width: 14, height: 14, borderRadius: 0,
            background: '#3b82f6',
            border: '2px solid #fff',
            boxShadow: '0 0 12px rgba(59,130,246,0.9)',
          }}
        />
      </div>
    </div>
  )
}
