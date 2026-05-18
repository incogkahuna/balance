import { useState, useMemo, createContext, useContext } from 'react'
import { format, addDays } from 'date-fns'
import { usePrototypeData } from './dataSource.js'

// ── Visual dimensions (constant regardless of data) ─────────────────────────
const NAME_COL_W = 220
const DAY_W      = 22
const ROW_H      = 42
const ROW_GAP    = 2
const AXIS_H     = 56

// File-scope context — holds the live (or seed-fallback) dataset and the
// derived layout dimensions. Sub-components pull from this rather than
// importing constants.
const GanttCtx = createContext(null)
const useGantt = () => useContext(GanttCtx)

// ── Public component ─────────────────────────────────────────────────────────
export function Gantt() {
  const data = usePrototypeData()
  const { productions, commitments, resources, dayIndex, dateAtDayIndex, windowDays } = data

  const [hoveredProd, setHoveredProd] = useState(null)
  const [scrubDay, setScrubDay]       = useState(0)

  // Layout dimensions that depend on windowDays
  const TIMELINE_W = windowDays * DAY_W
  const TOTAL_W    = NAME_COL_W + TIMELINE_W

  // Sort productions by start date for a diagonal cascade top→down, left→right
  const sortedProds = useMemo(
    () => [...productions].sort((a, b) => a.start - b.start),
    [productions]
  )

  const scrubDate = dateAtDayIndex(scrubDay)

  // Today index — for the live indicator line. Null when today is outside
  // the visible window.
  const todayIdx = useMemo(() => {
    const idx = dayIndex(new Date())
    return idx >= 0 && idx <= windowDays ? idx : null
  }, [dayIndex, windowDays])

  const ctxValue = {
    productions: sortedProds,
    commitments,
    resources,
    dayIndex,
    dateAtDayIndex,
    windowDays,
    TIMELINE_W,
    TOTAL_W,
    source: data.source,
  }

  return (
    <GanttCtx.Provider value={ctxValue}>
      <div className="px-6 py-5">
        <Header scrubDate={scrubDate} />

        {sortedProds.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="card-elevated mt-4 overflow-hidden">
            <Legend hoveredProd={hoveredProd} setHoveredProd={setHoveredProd} />

            <div className="overflow-x-auto">
              <svg
                width={TOTAL_W}
                height={AXIS_H + sortedProds.length * (ROW_H + ROW_GAP)}
                style={{ display: 'block', background: 'var(--orbital-panel)' }}
              >
                <Grid rowCount={sortedProds.length} />
                <TimelineAxis />
                {todayIdx !== null && <NowLine idx={todayIdx} />}
                <ScrubLine idx={scrubDay} />

                {sortedProds.map((prod, i) => (
                  <Row
                    key={prod.id}
                    prod={prod}
                    rowIdx={i}
                    dimmed={hoveredProd && hoveredProd !== prod.id}
                    onHover={() => setHoveredProd(prod.id)}
                    onUnhover={() => setHoveredProd(null)}
                    scrubDay={scrubDay}
                  />
                ))}
              </svg>
            </div>

            <Scrubber day={scrubDay} setDay={setScrubDay} />
            <SummaryStrip scrubDate={scrubDate} />
          </div>
        )}
      </div>
    </GanttCtx.Provider>
  )
}

// ── Header (top of page) ─────────────────────────────────────────────────────
function Header({ scrubDate }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="hud-label mb-1">PROJECT GANTT</p>
        <h1 className="text-2xl font-semibold text-orbital-text tracking-tight">
          Every production on one timeline
        </h1>
        <p className="text-sm text-orbital-subtle mt-0.5">
          One row per production. Bars are date ranges. Overlap reveals where the studio is stacked.
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

// Empty-state card for when usePrototypeData() returned 0 productions
// (live mode with nothing in Supabase, no fallback to seed).
function EmptyState() {
  return (
    <div className="card-elevated mt-4 px-6 py-12 text-center">
      <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle mb-2">
        NO PRODUCTIONS WITH DATE BOUNDS
      </p>
      <p className="text-sm text-orbital-dim max-w-md mx-auto">
        Add a production with start and end dates to see it on the Gantt. The view
        auto-fits the timeline window to your real production dates.
      </p>
    </div>
  )
}

// ── Top legend (clickable production chips) ─────────────────────────────────
function Legend({ hoveredProd, setHoveredProd }) {
  const { productions } = useGantt()
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 flex-wrap"
      style={{ borderBottom: '1px solid var(--orbital-border)' }}
    >
      <span className="hud-label">PRODUCTIONS</span>
      {productions.map(p => {
        const active = hoveredProd === p.id
        return (
          <button
            key={p.id}
            onMouseEnter={() => setHoveredProd(p.id)}
            onMouseLeave={() => setHoveredProd(null)}
            className="inline-flex items-center gap-1.5 px-2 py-1 transition-colors"
            style={{
              background: active ? `${p.color}22` : 'transparent',
              border: `1px solid ${active ? p.color : 'var(--orbital-border)'}`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.glow}` }} />
            <span className="font-telemetry text-[10px] tracking-wider" style={{ color: active ? p.color : 'var(--orbital-subtle)' }}>
              {p.code}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Background grid: vertical lines every week, horizontal rows ─────────────
function Grid({ rowCount }) {
  const { windowDays, TOTAL_W } = useGantt()
  const weekCount = Math.ceil(windowDays / 7)
  const weekLines = []
  for (let w = 0; w <= weekCount; w++) {
    const x = NAME_COL_W + Math.min(w * 7, windowDays) * DAY_W
    weekLines.push(
      <line
        key={`w${w}`}
        x1={x} x2={x}
        y1={0} y2={AXIS_H + rowCount * (ROW_H + ROW_GAP)}
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
      />
    )
  }
  const rowSeparators = []
  for (let r = 0; r < rowCount; r++) {
    const y = AXIS_H + r * (ROW_H + ROW_GAP) + ROW_H
    rowSeparators.push(
      <line
        key={`r${r}`}
        x1={0} x2={TOTAL_W}
        y1={y} y2={y}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={1}
      />
    )
  }
  return (
    <g>
      <rect x={0} y={0} width={NAME_COL_W} height={AXIS_H + rowCount * (ROW_H + ROW_GAP)}
        fill="rgba(0,0,0,0.18)" />
      {weekLines}
      {rowSeparators}
    </g>
  )
}

// ── Timeline axis: week labels + day ticks ──────────────────────────────────
function TimelineAxis() {
  const { productions, windowDays, dateAtDayIndex, TOTAL_W } = useGantt()
  const weekCount = Math.ceil(windowDays / 7)
  const weekLabels = []
  for (let w = 0; w < weekCount; w++) {
    const startDate = dateAtDayIndex(w * 7)
    const x = NAME_COL_W + w * 7 * DAY_W
    weekLabels.push(
      <g key={`wl${w}`}>
        <text
          x={x + 6} y={18}
          fill="var(--orbital-subtle)"
          fontSize={10}
          fontFamily="'Space Mono', monospace"
          letterSpacing={1.5}
        >
          WEEK {w + 1}
        </text>
        <text
          x={x + 6} y={34}
          fill="var(--orbital-dim)"
          fontSize={9}
          fontFamily="'Space Mono', monospace"
        >
          {format(startDate, 'MMM d').toUpperCase()}
        </text>
      </g>
    )
  }

  const dayTicks = []
  for (let d = 0; d <= windowDays; d++) {
    const x = NAME_COL_W + d * DAY_W
    const major = d % 7 === 0
    dayTicks.push(
      <line
        key={`d${d}`}
        x1={x} x2={x}
        y1={AXIS_H - (major ? 8 : 4)} y2={AXIS_H}
        stroke={major ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}
        strokeWidth={1}
      />
    )
  }

  return (
    <g>
      <text
        x={14} y={18}
        fill="var(--orbital-subtle)"
        fontSize={10}
        fontFamily="'Space Mono', monospace"
        letterSpacing={1.5}
      >
        PRODUCTION
      </text>
      <text
        x={14} y={34}
        fill="var(--orbital-dim)"
        fontSize={9}
        fontFamily="'Space Mono', monospace"
      >
        {productions.length} ACTIVE
      </text>
      {weekLabels}
      {dayTicks}
      <line
        x1={0} x2={TOTAL_W}
        y1={AXIS_H} y2={AXIS_H}
        stroke="rgba(255,255,255,0.12)" strokeWidth={1}
      />
    </g>
  )
}

// ── Now line — vertical accent at today's column ────────────────────────────
function NowLine({ idx }) {
  const { productions } = useGantt()
  const x = NAME_COL_W + idx * DAY_W + DAY_W / 2
  const bottom = AXIS_H + productions.length * (ROW_H + ROW_GAP)
  return (
    <g>
      <line
        x1={x} x2={x}
        y1={AXIS_H - 12} y2={bottom}
        stroke="#fbbf24"
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.7}
      />
      <text
        x={x + 4} y={AXIS_H - 4}
        fill="#fbbf24"
        fontSize={9}
        fontFamily="'Space Mono', monospace"
        letterSpacing={1.5}
      >
        TODAY
      </text>
    </g>
  )
}

// ── Scrub line — vertical line at the playhead day ──────────────────────────
function ScrubLine({ idx }) {
  const { productions } = useGantt()
  const x = NAME_COL_W + idx * DAY_W + DAY_W / 2
  const bottom = AXIS_H + productions.length * (ROW_H + ROW_GAP)
  return (
    <line
      x1={x} x2={x}
      y1={0} y2={bottom}
      stroke="#60a5fa"
      strokeWidth={1.5}
      opacity={0.85}
    />
  )
}

// ── Production row: name column + bar ───────────────────────────────────────
function Row({ prod, rowIdx, dimmed, onHover, onUnhover, scrubDay }) {
  const { commitments, resources, dayIndex } = useGantt()
  const y = AXIS_H + rowIdx * (ROW_H + ROW_GAP)
  const startIdx = dayIndex(prod.start)
  const endIdx   = dayIndex(prod.end)
  const barX     = NAME_COL_W + startIdx * DAY_W
  const barW     = (endIdx - startIdx + 1) * DAY_W
  const barY     = y + 8
  const barH     = ROW_H - 16

  const isLive   = scrubDay >= startIdx && scrubDay <= endIdx

  const peopleCount = commitments.filter(c => c.productionId === prod.id && resources.find(r => r.id === c.resourceId)?.kind === 'people').length
  const gearCount   = commitments.filter(c => c.productionId === prod.id && resources.find(r => r.id === c.resourceId)?.kind === 'gear').length
  const durDays     = endIdx - startIdx + 1

  return (
    <g
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1, transition: 'opacity 200ms ease' }}
    >
      <text
        x={14} y={y + 18}
        fill="var(--orbital-text)"
        fontSize={13}
        fontWeight={600}
      >
        {prod.name}
      </text>
      <text
        x={14} y={y + 32}
        fill="var(--orbital-subtle)"
        fontSize={10}
        fontFamily="'Space Mono', monospace"
        letterSpacing={1}
      >
        {prod.code} · {durDays}d · {peopleCount}p{gearCount > 0 ? ` · ${gearCount}g` : ''}
      </text>

      <rect
        x={barX} y={barY}
        width={barW} height={barH}
        fill={`${prod.color}22`}
        stroke={prod.color}
        strokeWidth={1}
      />
      <rect
        x={barX} y={barY}
        width={barW} height={barH}
        fill={prod.color}
        opacity={0.78}
      />

      {isLive && (
        <rect
          x={barX - 1} y={barY - 1}
          width={barW + 2} height={barH + 2}
          fill="none"
          stroke="#fff"
          strokeWidth={1}
          opacity={0.5}
        />
      )}

      {barW > 70 && (
        <text
          x={barX + 8}
          y={barY + barH / 2 + 4}
          fill="#0d0f12"
          fontSize={11}
          fontWeight={700}
          fontFamily="'Space Mono', monospace"
          letterSpacing={1}
        >
          {format(prod.start, 'MMM d').toUpperCase()} → {format(prod.end, 'MMM d').toUpperCase()}
        </text>
      )}
    </g>
  )
}

// ── Scrubber — drag a date through the window ───────────────────────────────
function Scrubber({ day, setDay }) {
  const { windowDays } = useGantt()
  return (
    <div
      className="flex items-center gap-4 px-4 py-3"
      style={{
        borderTop: '1px solid var(--orbital-border)',
        background: 'var(--orbital-bg)',
      }}
    >
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-subtle whitespace-nowrap">SCRUB</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={windowDays}
          step={1}
          value={day}
          onChange={(e) => setDay(parseInt(e.target.value, 10))}
          className="w-full accent-blue-500"
        />
      </div>
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-text whitespace-nowrap tabular-nums">
        DAY {String(day).padStart(2, '0')} / {windowDays}
      </span>
    </div>
  )
}

// ── Bottom summary — what's active at the scrub date ────────────────────────
function SummaryStrip({ scrubDate }) {
  const { productions } = useGantt()
  const active = productions.filter(p => p.start <= scrubDate && scrubDate <= p.end)
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        borderTop: '1px solid var(--orbital-border)',
        background: 'var(--orbital-panel)',
      }}
    >
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">ACTIVE</span>
      <span className="font-telemetry text-base tabular-nums text-orbital-text">
        {String(active.length).padStart(2, '0')}
      </span>
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">/ {productions.length}</span>
      {active.length > 0 && (
        <div className="flex items-center gap-2 ml-2 flex-wrap">
          {active.map(p => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 font-telemetry text-[10px] tracking-wider"
              style={{
                background: `${p.color}1f`,
                border: `1px solid ${p.color}55`,
                color: p.color,
              }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: p.color }} />
              {p.code}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
