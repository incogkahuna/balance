import { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import {
  PRODUCTIONS, RESOURCES, COMMITMENTS, KIND_META,
  WINDOW_START, WINDOW_DAYS, dayIndex, dateAtDayIndex,
} from './sampleData.js'

const KIND_ORDER = ['people', 'gear', 'locations']

// Resource name column width — same across every row so the tracks all
// start at the same x.
const NAME_COL_W = 180

// Each conflict lane within a row is this many pixels tall; the row sizes
// itself to fit max(lanes, 1).
const LANE_H = 16
const LANE_GAP = 2

// Per-commitment assignment to a vertical lane so simultaneous commitments
// stack neatly instead of overlapping. Returns an array parallel to
// `commitments` with { laneIdx, lanesUsed } annotations.
function assignLanes(commitments) {
  const sorted = [...commitments].sort((a, b) => a.start - b.start)
  const lanes = []  // each lane = end-day-index of the last commitment placed in it
  const placed = sorted.map(c => {
    const startIdx = dayIndex(c.start)
    const endIdx   = dayIndex(c.end)
    let laneIdx = lanes.findIndex(end => end < startIdx)
    if (laneIdx === -1) {
      laneIdx = lanes.length
      lanes.push(endIdx)
    } else {
      lanes[laneIdx] = endIdx
    }
    return { ...c, laneIdx, startIdx, endIdx }
  })
  return { placed, lanesUsed: Math.max(1, lanes.length) }
}

export function ResourceRiver() {
  const [scrubDay, setScrubDay] = useState(7)
  const [hoveredProd, setHoveredProd] = useState(null)
  const scrubDate = dateAtDayIndex(scrubDay)

  return (
    <div className="px-6 py-5">
      <Header scrubDate={scrubDate} />

      <div className="card-elevated mt-4 overflow-hidden">
        <Legend hoveredProd={hoveredProd} setHoveredProd={setHoveredProd} />
        <TimelineAxis />
        <Lanes hoveredProd={hoveredProd} scrubDay={scrubDay} />
        <Scrubber day={scrubDay} setDay={setScrubDay} />
      </div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ scrubDate }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="hud-label mb-1">RESOURCE RIVER</p>
        <h1 className="text-2xl font-semibold text-orbital-text tracking-tight">
          Who's on what, when
        </h1>
        <p className="text-sm text-orbital-subtle mt-0.5">
          One row per resource. Where blocks stack, that resource is double-booked.
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

// ── Legend strip — production chips, hover to spotlight ────────────────────
function Legend({ hoveredProd, setHoveredProd }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--orbital-border)' }}>
      <span className="hud-label mr-2">PRODUCTIONS</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRODUCTIONS.map(p => {
          const dim = hoveredProd && hoveredProd !== p.id
          return (
            <button key={p.id}
              onMouseEnter={() => setHoveredProd(p.id)}
              onMouseLeave={() => setHoveredProd(null)}
              className="inline-flex items-center gap-1.5 px-2 py-1 transition-opacity"
              style={{
                border: `1px solid ${p.color}55`,
                background: `${p.color}10`,
                opacity: dim ? 0.35 : 1,
              }}>
              <span className="w-1.5 h-1.5" style={{ background: p.color, boxShadow: `0 0 5px ${p.glow}` }} />
              <span className="font-telemetry text-[10px] tracking-[0.18em]" style={{ color: p.color }}>
                {p.code}
              </span>
              <span className="text-[11px] text-orbital-subtle">{p.name}</span>
              <span className="font-telemetry text-[9px] text-orbital-dim tracking-wider ml-1">
                {format(p.start, 'MMM d')}–{format(p.end, 'MMM d')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week-label axis above the tracks ───────────────────────────────────────
function TimelineAxis() {
  return (
    <div className="flex"
      style={{ borderBottom: '1px solid var(--orbital-border)' }}>
      <div style={{ width: NAME_COL_W, flexShrink: 0 }} />
      <div className="relative flex-1 h-7">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}
            className="absolute top-1.5 -translate-x-1/2 font-telemetry text-[9px] text-orbital-subtle tracking-[0.18em]"
            style={{ left: `${(i / 6) * 100}%` }}>
            {format(dateAtDayIndex(i * 7), 'MMM d').toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Sectioned list of rows + a single global playhead line ─────────────────
function Lanes({ hoveredProd, scrubDay }) {
  return (
    <div className="relative">
      {KIND_ORDER.map(kind => (
        <Section key={kind}
          kind={kind}
          resources={RESOURCES.filter(r => r.kind === kind)}
          hoveredProd={hoveredProd} />
      ))}
      {/* Global playhead — positioned within the track column only */}
      <div className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `calc(${NAME_COL_W}px + (100% - ${NAME_COL_W}px) * ${scrubDay / WINDOW_DAYS})`,
          width: 1,
          background: 'rgba(255,255,255,0.85)',
          mixBlendMode: 'difference',
          boxShadow: '0 0 6px rgba(255,255,255,0.6)',
        }} />
    </div>
  )
}

function Section({ kind, resources, hoveredProd }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-1.5"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid var(--orbital-border)',
          borderBottom: '1px solid var(--orbital-border)',
        }}>
        <span className="hud-label">{KIND_META[kind].label}</span>
        <span className="font-telemetry text-[9px] text-orbital-dim tracking-[0.18em]">
          {resources.length}
        </span>
      </div>
      {resources.map(r => (
        <Row key={r.id} resource={r} hoveredProd={hoveredProd} />
      ))}
    </div>
  )
}

function Row({ resource, hoveredProd }) {
  const myCommitments = COMMITMENTS.filter(c => c.resourceId === resource.id)
  const { placed, lanesUsed } = assignLanes(myCommitments)
  const trackHeight = lanesUsed * LANE_H + (lanesUsed - 1) * LANE_GAP + 8
  const hasConflict = lanesUsed > 1

  return (
    <div className="flex items-stretch"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: NAME_COL_W, flexShrink: 0 }}
        className="px-4 py-2 flex items-center gap-2">
        {hasConflict && (
          <span className="w-1 self-stretch"
            style={{ background: '#ef4444', boxShadow: '0 0 4px rgba(239,68,68,0.6)' }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-orbital-text leading-tight truncate">{resource.name}</p>
          <p className="font-telemetry text-[9px] text-orbital-dim tracking-wider truncate">
            {resource.role}
          </p>
        </div>
      </div>
      <div className="relative flex-1" style={{ height: trackHeight }}>
        {placed.map((c, i) => {
          const prod = PRODUCTIONS.find(p => p.id === c.productionId)
          const left   = (c.startIdx / WINDOW_DAYS) * 100
          const width  = ((c.endIdx - c.startIdx + 1) / WINDOW_DAYS) * 100
          const top    = 4 + c.laneIdx * (LANE_H + LANE_GAP)
          const dim    = hoveredProd && hoveredProd !== prod.id
          return (
            <div key={i}
              className="absolute transition-opacity"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top, height: LANE_H,
                background: `linear-gradient(90deg, ${prod.color}aa, ${prod.color}55)`,
                borderLeft:  `2px solid ${prod.color}`,
                opacity: dim ? 0.18 : 1,
              }}
              title={`${prod.name} · ${format(c.start, 'MMM d')}–${format(c.end, 'MMM d')}`}>
              <span className="font-telemetry text-[9px] tracking-[0.18em] pl-1 leading-none"
                style={{
                  color: '#0a0c10',
                  textShadow: '0 0 1px rgba(255,255,255,0.4)',
                  lineHeight: `${LANE_H}px`,
                }}>
                {prod.code}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Scrubber ───────────────────────────────────────────────────────────────
// Same drag-anywhere-on-track UX as the Constellation scrubber.
function Scrubber({ day, setDay }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)

  const dayFromClient = useCallback((cx) => {
    const box = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (cx - box.left) / box.width))
    return Math.round(ratio * WINDOW_DAYS)
  }, [])

  const onDown = (e) => {
    dragging.current = true
    setDay(dayFromClient(e.clientX ?? e.touches?.[0]?.clientX))
  }
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      setDay(dayFromClient(e.clientX ?? e.touches?.[0]?.clientX))
    }
    const onUp = () => { dragging.current = false }
    globalThis.addEventListener('mousemove', onMove)
    globalThis.addEventListener('mouseup', onUp)
    globalThis.addEventListener('touchmove', onMove)
    globalThis.addEventListener('touchend', onUp)
    return () => {
      globalThis.removeEventListener('mousemove', onMove)
      globalThis.removeEventListener('mouseup', onUp)
      globalThis.removeEventListener('touchmove', onMove)
      globalThis.removeEventListener('touchend', onUp)
    }
  }, [dayFromClient, setDay])

  return (
    <div className="px-6 pt-3 pb-5"
      style={{ borderTop: '1px solid var(--orbital-border)' }}>
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
        style={{ height: 24 }}>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={{ height: 2, background: 'var(--orbital-border)' }} />
        <div className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: 0,
            width: `${(day / WINDOW_DAYS) * 100}%`,
            height: 2, background: '#3b82f6',
            boxShadow: '0 0 6px rgba(59,130,246,0.7)',
          }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            left: `${(day / WINDOW_DAYS) * 100}%`,
            width: 12, height: 12,
            background: '#3b82f6',
            border: '2px solid #fff',
            boxShadow: '0 0 10px rgba(59,130,246,0.8)',
          }} />
      </div>
    </div>
  )
}
