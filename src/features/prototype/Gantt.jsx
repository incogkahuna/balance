import { useState, useMemo, useEffect, useLayoutEffect, useRef, createContext, useContext } from 'react'
import { format, addDays } from 'date-fns'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import { usePrototypeData } from './dataSource.js'

// ── Visual dimensions (constant regardless of data) ─────────────────────────
const NAME_COL_W = 220
const BASE_DAY_W = 22                    // base px per day at zoom = 1.0
const ROW_H      = 48                    // bumped from 42 — gives bars more presence
const ROW_GAP    = 2
const AXIS_H     = 56
const DOT_SIZE   = 8                     // avatar dot diameter for in-bar resources

// Zoom bounds + multiplicative step. 1.0 = base; <1 zooms out (more days
// fit, narrower bars); >1 zooms in (fewer days visible, wider bars).
const ZOOM_MIN  = 0.4
const ZOOM_MAX  = 4.0
const ZOOM_STEP = 1.5

// File-scope context — holds the live (or seed-fallback) dataset and the
// derived layout dimensions. Sub-components pull from this rather than
// importing constants.
const GanttCtx = createContext(null)
const useGantt = () => useContext(GanttCtx)

const FILTER_OPTIONS = [
  { id: 'all',       label: 'ALL'       },
  { id: 'people',    label: 'PEOPLE'    },
  { id: 'gear',      label: 'GEAR'      },
  { id: 'locations', label: 'LOCATIONS' },
]

const GROUPBY_OPTIONS = [
  { id: 'production', label: 'BY PRODUCTION' },
  { id: 'resource',   label: 'BY RESOURCE'   },
]

// ── Public component ─────────────────────────────────────────────────────────
export function Gantt() {
  const data = usePrototypeData()
  const { productions, commitments, resources, dayIndex, dateAtDayIndex, windowDays } = data

  const [hoveredProd, setHoveredProd] = useState(null)
  const [scrubDay, setScrubDay]       = useState(0)
  const [groupBy, setGroupBy]         = useState('production')
  const [filter, setFilter]           = useState('all')
  const [zoomLevel, setZoomLevel]     = useState(1)

  // Chart height: null = auto-fit all rows. A number = explicit pixel
  // height the user dragged the bottom handle to. Persisted per-browser so
  // the user's preferred size survives a refresh.
  const CHART_HEIGHT_KEY = 'balance_gantt_chart_height'
  const [chartHeight, setChartHeight] = useState(() => {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(CHART_HEIGHT_KEY)
    const n = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(n) ? n : null
  })
  useEffect(() => {
    if (chartHeight === null) {
      try { window.localStorage.removeItem(CHART_HEIGHT_KEY) } catch { /* noop */ }
    } else {
      try { window.localStorage.setItem(CHART_HEIGHT_KEY, String(chartHeight)) } catch { /* noop */ }
    }
  }, [chartHeight])

  // Dynamic day width drives the entire timeline scale. Bumped/dropped by
  // the zoom controls in the toolbar (and the +/- keyboard shortcuts).
  const dayW       = BASE_DAY_W * zoomLevel
  const TIMELINE_W = windowDays * dayW
  const TOTAL_W    = NAME_COL_W + TIMELINE_W

  // ── Zoom anchoring ──────────────────────────────────────────────────────
  // The horizontal-scroll wrapper around the SVG. Tracked so zoom changes
  // can re-center the viewport on the scrub line (the day the user is
  // "addressing"), instead of letting the playhead drift off-screen as the
  // timeline width changes underneath them.
  const scrollWrapperRef = useRef(null)
  // After each zoom change, this layout effect runs once and shifts
  // scrollLeft so that the playhead lands at its previous on-screen
  // position (or as close as the scroll bounds allow). Sentinel keeps it
  // from firing on the very first paint, when there's no "previous" zoom.
  const prevDayWRef = useRef(null)
  const zoomAnchorRef = useRef(null)  // { day, screenOffset } captured pre-zoom

  const captureZoomAnchor = () => {
    const wrapper = scrollWrapperRef.current
    if (!wrapper) { zoomAnchorRef.current = null; return }
    const playheadXInTimeline = NAME_COL_W + scrubDay * dayW + dayW / 2
    const offsetFromScroll = playheadXInTimeline - wrapper.scrollLeft
    // Visible viewport excludes the fixed name column on the left.
    const visibleStart = NAME_COL_W
    const visibleEnd   = wrapper.clientWidth
    // If the playhead is currently visible, preserve its on-screen offset
    // (keeps the user's spatial reference). If it's off-screen, center it
    // in the viewport so the zoom brings it into view — matches the user's
    // expectation of "zoom in on the blue line."
    const visible = offsetFromScroll >= visibleStart && offsetFromScroll <= visibleEnd
    const screenOffset = visible
      ? offsetFromScroll
      : (visibleStart + visibleEnd) / 2
    zoomAnchorRef.current = { day: scrubDay, screenOffset }
  }

  const zoomIn  = () => { captureZoomAnchor(); setZoomLevel(z => Math.min(ZOOM_MAX, +(z * ZOOM_STEP).toFixed(3))) }
  const zoomOut = () => { captureZoomAnchor(); setZoomLevel(z => Math.max(ZOOM_MIN, +(z / ZOOM_STEP).toFixed(3))) }
  const zoomReset = () => { captureZoomAnchor(); setZoomLevel(1) }

  useLayoutEffect(() => {
    // First paint or no anchor → nothing to restore
    if (prevDayWRef.current === null) { prevDayWRef.current = dayW; return }
    if (dayW === prevDayWRef.current) return
    prevDayWRef.current = dayW

    const wrapper = scrollWrapperRef.current
    const anchor  = zoomAnchorRef.current
    zoomAnchorRef.current = null
    if (!wrapper || !anchor) return

    // Where is the anchored day in the new (zoomed) timeline?
    const newPlayheadX = NAME_COL_W + anchor.day * dayW + dayW / 2
    // Target scrollLeft puts the anchored day at the same screen offset
    // it had before zoom. Centering happens naturally when the original
    // anchor was near the centre of the viewport.
    const target = newPlayheadX - anchor.screenOffset
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth
    wrapper.scrollLeft = Math.max(0, Math.min(maxScroll, target))
  }, [dayW, scrubDay])

  // ── Vertical resize handle ──────────────────────────────────────────────
  // Drag the bar at the bottom of the chart area up/down to constrain the
  // visible chart height. Inside that height, the SVG scrolls vertically
  // (and horizontally as before) so the user can pin the chart to whatever
  // viewport size they like and scroll around within it.
  const MIN_CHART_HEIGHT = 160
  const resizeStartRef = useRef(null)  // { startY, startHeight } while dragging

  const startResize = (e) => {
    e.preventDefault()
    const wrapper = scrollWrapperRef.current
    if (!wrapper) return
    const startHeight = chartHeight ?? wrapper.getBoundingClientRect().height
    const startY = e.clientY ?? e.touches?.[0]?.clientY
    resizeStartRef.current = { startY, startHeight }
    // Visual feedback while dragging
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  // Double-click on the handle resets to auto-fit (null height).
  const resetHeight = () => setChartHeight(null)

  useEffect(() => {
    const onMove = (e) => {
      const start = resizeStartRef.current
      if (!start) return
      const cy = e.clientY ?? e.touches?.[0]?.clientY
      const dy = cy - start.startY
      const next = Math.max(MIN_CHART_HEIGHT, start.startHeight + dy)
      setChartHeight(next)
    }
    const onUp = () => {
      if (!resizeStartRef.current) return
      resizeStartRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
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
  }, [])

  // Keyboard shortcuts — + / - zoom, 0 resets. Skipped when typing in an
  // input so we never fight a form (even though the prototype has none).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '+' || (e.key === '=' && e.shiftKey)) { e.preventDefault(); zoomIn() }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut() }
      else if (e.key === '0') { e.preventDefault(); zoomReset() }
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubDay, dayW])

  // Sort productions by start date so the diagonal cascade reads top→down left→right
  const sortedProds = useMemo(
    () => [...productions].sort((a, b) => a.start - b.start),
    [productions]
  )

  // Filtered resource list for resource-mode rows AND for in-bar dots in
  // production mode. Filter "all" → everything; otherwise just that kind.
  const filteredResources = useMemo(
    () => filter === 'all' ? resources : resources.filter(r => r.kind === filter),
    [resources, filter]
  )

  // Resource rows: sort by kind then name so people cluster together
  const sortedResources = useMemo(
    () => [...filteredResources].sort((a, b) => {
      if (a.kind !== b.kind) {
        const order = { people: 0, gear: 1, locations: 2 }
        return (order[a.kind] ?? 9) - (order[b.kind] ?? 9)
      }
      return a.name.localeCompare(b.name)
    }),
    [filteredResources]
  )

  const scrubDate = dateAtDayIndex(scrubDay)

  // Today index — for the live indicator line. Null when today is outside
  // the visible window.
  const todayIdx = useMemo(() => {
    const idx = dayIndex(new Date())
    return idx >= 0 && idx <= windowDays ? idx : null
  }, [dayIndex, windowDays])

  // Which rows we render depends on groupBy mode.
  const rows = groupBy === 'production' ? sortedProds : sortedResources
  const svgHeight = AXIS_H + Math.max(rows.length, 1) * (ROW_H + ROW_GAP)

  const ctxValue = {
    productions: sortedProds,
    commitments,
    resources,
    filteredResources,
    dayIndex,
    dateAtDayIndex,
    windowDays,
    dayW,
    TIMELINE_W,
    TOTAL_W,
    filter,
    groupBy,
    source: data.source,
  }

  return (
    <GanttCtx.Provider value={ctxValue}>
      <div className="px-3 sm:px-6 py-4 sm:py-5">
        <Header scrubDate={scrubDate} />

        {sortedProds.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="card-elevated mt-4 overflow-hidden">
            <Toolbar
              groupBy={groupBy} setGroupBy={setGroupBy}
              filter={filter} setFilter={setFilter}
              zoomLevel={zoomLevel}
              zoomIn={zoomIn} zoomOut={zoomOut} zoomReset={zoomReset}
            />
            <Legend hoveredProd={hoveredProd} setHoveredProd={setHoveredProd} />

            <div
              ref={scrollWrapperRef}
              className="overflow-x-auto"
              style={chartHeight !== null
                ? { height: chartHeight, overflowY: 'auto' }
                : undefined}
            >
              <svg
                width={TOTAL_W}
                height={svgHeight}
                style={{ display: 'block', background: 'var(--orbital-panel)' }}
              >
                <Grid rowCount={rows.length} />
                <TimelineAxis />
                {todayIdx !== null && <NowLine idx={todayIdx} rowCount={rows.length} />}
                <ScrubLine idx={scrubDay} rowCount={rows.length} />

                {groupBy === 'production'
                  ? sortedProds.map((prod, i) => (
                      <ProductionRow
                        key={prod.id}
                        prod={prod}
                        rowIdx={i}
                        dimmed={hoveredProd && hoveredProd !== prod.id}
                        onHover={() => setHoveredProd(prod.id)}
                        onUnhover={() => setHoveredProd(null)}
                        scrubDay={scrubDay}
                      />
                    ))
                  : sortedResources.map((res, i) => (
                      <ResourceRow
                        key={res.id}
                        resource={res}
                        rowIdx={i}
                        dimmed={hoveredProd && !commitments.some(c => c.resourceId === res.id && c.productionId === hoveredProd)}
                        onHover={() => {}}
                        onUnhover={() => {}}
                        scrubDay={scrubDay}
                      />
                    ))
                }

                {rows.length === 0 && (
                  <text
                    x={NAME_COL_W + TIMELINE_W / 2}
                    y={AXIS_H + 60}
                    fill="var(--orbital-dim)"
                    fontSize={12}
                    textAnchor="middle"
                  >
                    No {filter === 'all' ? 'resources' : filter} match the current filter.
                  </text>
                )}
              </svg>
            </div>

            <ResizeHandle
              onMouseDown={startResize}
              onTouchStart={startResize}
              onDoubleClick={resetHeight}
              isCustom={chartHeight !== null}
            />

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
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-4">
      <div>
        <p className="hud-label mb-1">PROJECT GANTT</p>
        <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">
          Every production on one timeline
        </h1>
        <p className="text-sm text-orbital-subtle mt-0.5">
          One row per production. Bars are date ranges. Overlap reveals where the studio is stacked.
        </p>
      </div>
      <div className="sm:text-right">
        <p className="hud-label mb-1">PLAYHEAD</p>
        <p className="font-telemetry text-sm text-orbital-text tracking-wider">
          {format(scrubDate, 'EEE · MMM d, yyyy').toUpperCase()}
        </p>
      </div>
    </div>
  )
}

// ── Resize handle — drag to set chart height, double-click to auto-fit ─────
function ResizeHandle({ onMouseDown, onTouchStart, onDoubleClick, isCustom }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isCustom ? 'Drag to resize · double-click to auto-fit' : 'Drag to resize the chart'}
      className="relative w-full flex items-center justify-center select-none"
      style={{
        height: 8,
        cursor: 'ns-resize',
        background: hover ? 'rgba(59,130,246,0.18)' : 'transparent',
        borderTop: '1px solid var(--orbital-border)',
        borderBottom: '1px solid var(--orbital-border)',
        transition: 'background 120ms ease-out',
      }}
    >
      {/* Two short stacked lines as the visual grip */}
      <div className="flex flex-col gap-0.5 pointer-events-none">
        <span
          className="block"
          style={{
            width: 24,
            height: 1,
            background: hover ? '#60a5fa' : (isCustom ? 'var(--orbital-subtle)' : 'var(--orbital-chrome)'),
          }}
        />
        <span
          className="block"
          style={{
            width: 24,
            height: 1,
            background: hover ? '#60a5fa' : (isCustom ? 'var(--orbital-subtle)' : 'var(--orbital-chrome)'),
          }}
        />
      </div>
    </div>
  )
}

// ── Toolbar: group-by toggle + resource filter chips + zoom controls ───────
function Toolbar({ groupBy, setGroupBy, filter, setFilter, zoomLevel, zoomIn, zoomOut, zoomReset }) {
  const zoomPct = Math.round(zoomLevel * 100)
  const atMax = zoomLevel >= ZOOM_MAX - 0.001
  const atMin = zoomLevel <= ZOOM_MIN + 0.001
  return (
    <div
      className="flex items-center justify-between gap-4 px-3 py-2 flex-wrap"
      style={{ borderBottom: '1px solid var(--orbital-border)' }}
    >
      {/* Group-by toggle */}
      <div className="flex items-center gap-2">
        <span className="hud-label">GROUP</span>
        <div
          className="inline-flex"
          style={{ border: '1px solid var(--orbital-border)', background: 'var(--orbital-muted)' }}
        >
          {GROUPBY_OPTIONS.map(opt => {
            const active = groupBy === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setGroupBy(opt.id)}
                className="px-2.5 py-1 font-telemetry text-[10px] tracking-wider transition-colors"
                style={{
                  background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
                  color: active ? '#60a5fa' : 'var(--orbital-subtle)',
                  boxShadow: active ? 'inset 0 0 8px rgba(59,130,246,0.25)' : 'none',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="hud-label">FILTER</span>
        {FILTER_OPTIONS.map(opt => {
          const active = filter === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 font-telemetry text-[10px] tracking-wider transition-colors"
              style={{
                background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
                border: `1px solid ${active ? 'rgba(59,130,246,0.55)' : 'var(--orbital-border)'}`,
                color: active ? 'var(--orbital-text)' : 'var(--orbital-subtle)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <span className="hud-label">ZOOM</span>
        <div
          className="inline-flex items-center"
          style={{ border: '1px solid var(--orbital-border)', background: 'var(--orbital-muted)' }}
        >
          <button
            onClick={zoomOut}
            disabled={atMin}
            className="px-2 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: atMin ? 'var(--orbital-dim)' : 'var(--orbital-subtle)' }}
            title="Zoom out (−)"
          >
            <Minus size={11} />
          </button>
          <span
            className="px-2 font-telemetry text-[10px] tracking-wider text-orbital-text tabular-nums select-none"
            style={{ minWidth: 42, textAlign: 'center' }}
          >
            {zoomPct}%
          </span>
          <button
            onClick={zoomIn}
            disabled={atMax}
            className="px-2 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: atMax ? 'var(--orbital-dim)' : 'var(--orbital-subtle)' }}
            title="Zoom in (+)"
          >
            <Plus size={11} />
          </button>
        </div>
        <button
          onClick={zoomReset}
          disabled={zoomLevel === 1}
          className="inline-flex items-center gap-1 px-2 py-1 font-telemetry text-[10px] tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            border: '1px solid var(--orbital-border)',
            color: 'var(--orbital-subtle)',
          }}
          title="Reset zoom (0)"
        >
          <Maximize2 size={10} />
          FIT
        </button>
      </div>
    </div>
  )
}

// Empty-state card for when usePrototypeData() returned 0 productions
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
  const { windowDays, TOTAL_W, dayW } = useGantt()
  const weekCount = Math.ceil(windowDays / 7)
  const weekLines = []
  for (let w = 0; w <= weekCount; w++) {
    const x = NAME_COL_W + Math.min(w * 7, windowDays) * dayW
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
  const { groupBy, productions, filteredResources, windowDays, dateAtDayIndex, TOTAL_W, dayW } = useGantt()
  const weekCount = Math.ceil(windowDays / 7)
  const weekLabels = []
  for (let w = 0; w < weekCount; w++) {
    const startDate = dateAtDayIndex(w * 7)
    const x = NAME_COL_W + w * 7 * dayW
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

  // Day number labels above the ticks. Density adapts to zoom: at high
  // zoom every day is labelled; at low zoom we skip days to keep labels
  // from overlapping. MIN_LABEL_SPACING ≈ 14px is enough for a 2-digit
  // number in our font without crowding.
  const MIN_LABEL_SPACING = 14
  const labelStep = Math.max(1, Math.ceil(MIN_LABEL_SPACING / dayW))
  const dayLabels = []
  for (let d = 0; d <= windowDays; d++) {
    // Always show on week boundaries even if the step would skip — keeps
    // a date visible at each WEEK column for orientation.
    const isWeekBoundary = d % 7 === 0
    if (!isWeekBoundary && d % labelStep !== 0) continue
    const x = NAME_COL_W + d * dayW + dayW / 2
    dayLabels.push(
      <text
        key={`dn${d}`}
        x={x} y={48}
        fill={isWeekBoundary ? 'var(--orbital-subtle)' : 'var(--orbital-dim)'}
        fontSize={9}
        fontFamily="'Space Mono', monospace"
        textAnchor="middle"
      >
        {format(dateAtDayIndex(d), 'd')}
      </text>
    )
  }

  const dayTicks = []
  for (let d = 0; d <= windowDays; d++) {
    const x = NAME_COL_W + d * dayW
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

  const label  = groupBy === 'production' ? 'PRODUCTION' : 'RESOURCE'
  const sub    = groupBy === 'production' ? `${productions.length} ACTIVE` : `${filteredResources.length} SHOWING`

  return (
    <g>
      <text
        x={14} y={18}
        fill="var(--orbital-subtle)"
        fontSize={10}
        fontFamily="'Space Mono', monospace"
        letterSpacing={1.5}
      >
        {label}
      </text>
      <text
        x={14} y={34}
        fill="var(--orbital-dim)"
        fontSize={9}
        fontFamily="'Space Mono', monospace"
      >
        {sub}
      </text>
      {weekLabels}
      {dayLabels}
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
function NowLine({ idx, rowCount }) {
  const { dayW } = useGantt()
  const x = NAME_COL_W + idx * dayW + dayW / 2
  const bottom = AXIS_H + rowCount * (ROW_H + ROW_GAP)
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
function ScrubLine({ idx, rowCount }) {
  const { dayW } = useGantt()
  const x = NAME_COL_W + idx * dayW + dayW / 2
  const bottom = AXIS_H + rowCount * (ROW_H + ROW_GAP)
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

// ── Production row (group-by-production mode) ──────────────────────────────
// Each row is one production. Bar spans its start→end dates. Mini avatar
// dots inside the bar represent committed resources (filtered by the toolbar
// chip), giving an at-a-glance read of "who's on this".
function ProductionRow({ prod, rowIdx, dimmed, onHover, onUnhover, scrubDay }) {
  const { commitments, resources, filteredResources, dayIndex, filter, dayW } = useGantt()
  const y = AXIS_H + rowIdx * (ROW_H + ROW_GAP)
  const startIdx = dayIndex(prod.start)
  const endIdx   = dayIndex(prod.end)
  const barX     = NAME_COL_W + startIdx * dayW
  const barW     = (endIdx - startIdx + 1) * dayW
  const barY     = y + 10
  const barH     = ROW_H - 20

  const isLive   = scrubDay >= startIdx && scrubDay <= endIdx

  // All resources committed to this production, filtered by toolbar chip
  const committedHere = useMemo(() => {
    const ids = new Set(commitments.filter(c => c.productionId === prod.id).map(c => c.resourceId))
    return filteredResources.filter(r => ids.has(r.id))
  }, [commitments, filteredResources, prod.id])

  // Full counts (regardless of filter) for the subtitle
  const peopleCount = commitments.filter(c => c.productionId === prod.id && resources.find(r => r.id === c.resourceId)?.kind === 'people').length
  const gearCount   = commitments.filter(c => c.productionId === prod.id && resources.find(r => r.id === c.resourceId)?.kind === 'gear').length
  const durDays     = endIdx - startIdx + 1

  // How many dots can we fit inside the bar?
  const dotPad      = 4
  const dotSpacing  = DOT_SIZE + 2
  const maxDots     = Math.max(0, Math.floor((barW - dotPad * 2 - 30) / dotSpacing))
  const dotsToRender = committedHere.slice(0, maxDots)
  const overflow    = Math.max(0, committedHere.length - maxDots)

  // Subtitle counts react to the active filter
  const countLabel = filter === 'all'
    ? `${peopleCount}p${gearCount > 0 ? ` · ${gearCount}g` : ''}`
    : `${committedHere.length} ${filter}`

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
        x={14} y={y + 34}
        fill="var(--orbital-subtle)"
        fontSize={10}
        fontFamily="'Space Mono', monospace"
        letterSpacing={1}
      >
        {prod.code} · {durDays}d · {countLabel}
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
        opacity={0.65}
      />

      {/* Bar label — date range, only when there's room AND no dots crowd it */}
      {barW > 100 && committedHere.length === 0 && (
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

      {/* In-bar avatar dots */}
      {dotsToRender.map((r, i) => (
        <g key={r.id}>
          <circle
            cx={barX + dotPad + DOT_SIZE / 2 + i * dotSpacing}
            cy={barY + barH / 2}
            r={DOT_SIZE / 2}
            fill={r.color || '#fff'}
            stroke="#0d0f12"
            strokeWidth={1}
          />
          <title>{r.name}{r.role ? ` · ${r.role}` : ''}</title>
        </g>
      ))}
      {overflow > 0 && (
        <text
          x={barX + dotPad + dotsToRender.length * dotSpacing + 2}
          y={barY + barH / 2 + 3.5}
          fill="rgba(255,255,255,0.85)"
          fontSize={9}
          fontFamily="'Space Mono', monospace"
          letterSpacing={0.5}
        >
          +{overflow}
        </text>
      )}

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
    </g>
  )
}

// ── Resource row (group-by-resource mode) ──────────────────────────────────
// Each row is one resource. Bars are commitments — one per production this
// resource is on, colored by that production. Overlapping commitments earn a
// red conflict marker on the name column.
function ResourceRow({ resource, rowIdx, dimmed, scrubDay }) {
  const { commitments, productions, dayIndex, dayW } = useGantt()
  const y = AXIS_H + rowIdx * (ROW_H + ROW_GAP)

  const myCommitments = useMemo(
    () => commitments.filter(c => c.resourceId === resource.id),
    [commitments, resource.id]
  )

  // Conflict = any two of my commitments have overlapping date ranges.
  const hasConflict = useMemo(() => {
    for (let i = 0; i < myCommitments.length; i++) {
      for (let j = i + 1; j < myCommitments.length; j++) {
        const a = myCommitments[i], b = myCommitments[j]
        if (a.productionId === b.productionId) continue
        if (a.start <= b.end && b.start <= a.end) return true
      }
    }
    return false
  }, [myCommitments])

  // Is the resource committed to ANY production at the scrub date?
  const isLive = useMemo(() => {
    const scrubDate = dayIndex(new Date()) // unused; we want scrubDay-relative
    return myCommitments.some(c => {
      const s = dayIndex(c.start)
      const e = dayIndex(c.end)
      return scrubDay >= s && scrubDay <= e
    })
  }, [myCommitments, scrubDay, dayIndex])

  return (
    <g
      style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 200ms ease' }}
    >
      {/* Conflict accent on the name column */}
      {hasConflict && (
        <rect
          x={0} y={y}
          width={3} height={ROW_H}
          fill="#ef4444"
          opacity={0.9}
        />
      )}

      <text
        x={14} y={y + 18}
        fill={isLive ? 'var(--orbital-text)' : 'var(--orbital-subtle)'}
        fontSize={13}
        fontWeight={600}
      >
        {resource.name}
      </text>
      <text
        x={14} y={y + 34}
        fill="var(--orbital-dim)"
        fontSize={10}
        fontFamily="'Space Mono', monospace"
        letterSpacing={1}
      >
        {(resource.kind || '').toUpperCase()}
        {resource.role ? ` · ${resource.role}` : ''}
        {hasConflict ? ' · ⚠ CONFLICT' : ''}
      </text>

      {/* Commitment bars */}
      {myCommitments.map((c, i) => {
        const prod = productions.find(p => p.id === c.productionId)
        if (!prod) return null
        const startIdx = dayIndex(c.start)
        const endIdx   = dayIndex(c.end)
        const barX = NAME_COL_W + startIdx * dayW
        const barW = (endIdx - startIdx + 1) * dayW
        const barY = y + 12
        const barH = ROW_H - 24
        return (
          <g key={i}>
            <rect
              x={barX} y={barY}
              width={barW} height={barH}
              fill={`${prod.color}33`}
              stroke={prod.color}
              strokeWidth={1}
            />
            <rect
              x={barX} y={barY}
              width={barW} height={barH}
              fill={prod.color}
              opacity={0.7}
            />
            {barW > 50 && (
              <text
                x={barX + 6}
                y={barY + barH / 2 + 4}
                fill="#0d0f12"
                fontSize={10}
                fontWeight={700}
                fontFamily="'Space Mono', monospace"
                letterSpacing={1}
              >
                {prod.code}
              </text>
            )}
            <title>{prod.name} · {format(c.start, 'MMM d')}–{format(c.end, 'MMM d')}</title>
          </g>
        )
      })}
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
// In production mode shows # of active productions. In resource mode shows
// # of resources currently committed (across any production) at the scrub.
function SummaryStrip({ scrubDate }) {
  const { groupBy, productions, commitments, filteredResources } = useGantt()
  if (groupBy === 'production') {
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

  // Resource mode summary
  const filteredIds = new Set(filteredResources.map(r => r.id))
  const activeResourceIds = new Set(
    commitments
      .filter(c => filteredIds.has(c.resourceId) && c.start <= scrubDate && scrubDate <= c.end)
      .map(c => c.resourceId)
  )
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        borderTop: '1px solid var(--orbital-border)',
        background: 'var(--orbital-panel)',
      }}
    >
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">COMMITTED</span>
      <span className="font-telemetry text-base tabular-nums text-orbital-text">
        {String(activeResourceIds.size).padStart(2, '0')}
      </span>
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">/ {filteredResources.length}</span>
    </div>
  )
}
