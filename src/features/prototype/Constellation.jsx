import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect, Fragment } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, RotateCcw, Home, ArrowLeft, Filter } from 'lucide-react'
import {
  PRODUCTIONS, RESOURCES, COMMITMENTS,
  WINDOW_DAYS, dateAtDayIndex, dayIndex,
  productionsForResource, hasConflict, commitmentLoad,
} from './sampleData.js'

// ── Layout constants ──────────────────────────────────────────────────────
const VIEW_W = 1280
const VIEW_H = 720
const CENTER = { x: 640, y: 360 }
const HOME_RADIUS = 110
const PLANET_RADIUS = 58
const ORBIT_R_PEOPLE = 95
const ORBIT_R_GEAR   = 132
// Home icons sit INSIDE the planet body, on a single arc per kind.
// Top hemisphere = people, bottom hemisphere = gear.
const HOME_INSIDE_R  = 72

const SMOOTH_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// ── Production planet positions — compass corners ────────────────────────
const PLANET_POS = {
  apex:    { x: CENTER.x - 215, y: CENTER.y - 215 },  // NW
  lunar:   { x: CENTER.x + 215, y: CENTER.y - 215 },  // NE
  neon:    { x: CENTER.x + 215, y: CENTER.y + 215 },  // SE
  halcyon: { x: CENTER.x - 215, y: CENTER.y + 215 },  // SW
}

// People + gear orbit. Locations are shown as labels on planets, not as orbiters.
const ORBITERS = RESOURCES.filter(r => r.kind === 'people' || r.kind === 'gear')

// Stable per-orbiter phase offset so siblings don't pile on top of each other.
const ORBITER_PHASE = (() => {
  const out = {}
  ORBITERS.forEach((r, i) => {
    out[r.id] = (i / ORBITERS.length) * Math.PI * 2
  })
  return out
})()

// Locations indexed by id → resource (used for planet labels)
const LOCATIONS_BY_ID = Object.fromEntries(
  RESOURCES.filter(r => r.kind === 'locations').map(r => [r.id, r])
)

// Each production has at most one location commitment. Resolve it once.
const PRODUCTION_LOCATION = (() => {
  const out = {}
  PRODUCTIONS.forEach(p => {
    const c = COMMITMENTS.find(c =>
      c.productionId === p.id && LOCATIONS_BY_ID[c.resourceId]
    )
    if (c) out[p.id] = LOCATIONS_BY_ID[c.resourceId]
  })
  return out
})()

function shortLocationLabel(loc) {
  if (!loc) return null
  if (loc.id === 'l1') return 'HOME BASE'
  return loc.name.toUpperCase().replace(' STAGE ', ' ')
}

// Mock skill profiles (used by the expanded tooltip). When real data lands,
// these would come from the people/contractors records.
const ROLE_SKILLS = {
  'Producer':       ['BUDGET', 'SCHEDULING', 'LOGISTICS', 'CLIENT REL.'],
  'Stage Manager':  ['CREW MGMT', 'SAFETY LEAD', 'LOAD-IN', 'EQUIPMENT'],
  'DP':             ['LIGHTING', 'CAMERA OPS', 'COLOR SCI.', 'LENS PKG'],
  'LED Tech':       ['PIXEL MAP', 'DISGUISE VX', 'CALIBRATION', 'ROE BP2'],
  'LED Operator':   ['DISGUISE', 'NOTCH', 'UNREAL 5', 'COLOR PIPE'],
  'DIT':            ['COLOR MGMT', 'DATA WRANGLE', 'ON-SET QC', 'CODEX VAULT'],
}

// Extra gear telemetry shown in the expanded tooltip.
const GEAR_DETAILS = {
  g1: { Dim: '24ft × 14ft', Pitch: '2.84 mm', Acquired: '2024' },
  g2: { Dim: '16ft × 9ft',  Pitch: '2.84 mm', Acquired: '2024' },
  g3: { Mount: 'Mo-Sys L40', Payload: '40 kg', Acquired: '2024' },
  g4: { Type: 'vx 4+', Outputs: '8× 12G-SDI', Acquired: '2023' },
  g5: { Type: 'vx 4+', Outputs: '8× 12G-SDI', Acquired: '2024' },
  g6: { Reach: '32 ft', Capacity: '500 lb', Acquired: '2022' },
  g7: { Length: '20 ft', Boxes: '12', Acquired: '2023' },
}

// ── Position helpers ─────────────────────────────────────────────────────
// Home icons sit inside the planet, split horizontally:
//  - people  → upper hemisphere (sin(angle) < 0)
//  - gear    → lower hemisphere (sin(angle) > 0)
// Centered on each arc, leaving 12° padding from the equator on each side.
function homeSurfacePosition(idx, total, kind) {
  const n = Math.max(1, total)
  const padding = (12 / 180) * Math.PI       // 12° gap from the equator
  const span = Math.PI - padding * 2
  // For 1 item we want it centered; for n items we space evenly across the arc.
  const t = n === 1 ? 0.5 : idx / (n - 1)
  let angle
  if (kind === 'gear') {
    // Bottom semicircle, going right → bottom → left
    angle = padding + t * span
  } else {
    // Top semicircle, going left → top → right (so reading order matches L-to-R)
    angle = -Math.PI + padding + t * span
  }
  return {
    x: CENTER.x + Math.cos(angle) * HOME_INSIDE_R,
    y: CENTER.y + Math.sin(angle) * HOME_INSIDE_R,
  }
}

function orbitPosition(planet, kind, phase, t) {
  const radius = kind === 'gear' ? ORBIT_R_GEAR : ORBIT_R_PEOPLE
  // Gear orbits in the opposite direction so the two rings feel distinct
  const dir = kind === 'gear' ? -1 : 1
  return {
    x: planet.x + Math.cos(dir * t + phase) * radius,
    y: planet.y + Math.sin(dir * t + phase) * radius,
  }
}

function midpointPosition(planets, phase, t) {
  const cx = planets.reduce((s, p) => s + p.x, 0) / planets.length
  const cy = planets.reduce((s, p) => s + p.y, 0) / planets.length
  // Slow lazy figure-8 wobble while torn between projects
  return {
    x: cx + Math.cos(t * 0.6 + phase) * 16,
    y: cy + Math.sin(t * 1.2 + phase) * 10,
  }
}

// ── Scene state for one orbiter across [rangeStart, rangeEnd] ──────────
// In day mode, rangeStart === rangeEnd. The "active" set is every commitment
// that intersects the range. Mode is:
//   home     → no commitments touch the range
//   orbit    → exactly one production touched
//   multi    → multiple productions, but their date ranges don't overlap
//              within the window (sequential work, not torn)
//   conflict → at least two commitments overlap each other in the window
function computeResourceState(resource, rangeStart, rangeEnd) {
  const matches = COMMITMENTS.filter(c =>
    c.resourceId === resource.id && c.start <= rangeEnd && rangeStart <= c.end
  )
  const productions = [...new Set(matches.map(c => c.productionId))]
  if (productions.length === 0) return { mode: 'home', activeProds: [] }
  if (productions.length === 1) return { mode: 'orbit', activeProds: productions }
  // Check whether any pair of intersecting commitments themselves overlap
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      if (matches[i].productionId === matches[j].productionId) continue
      if (matches[i].start <= matches[j].end && matches[j].start <= matches[i].end) {
        return { mode: 'conflict', activeProds: productions }
      }
    }
  }
  return { mode: 'multi', activeProds: productions }
}

const FILTER_OPTIONS = [
  { id: 'all',       label: 'ALL'       },
  { id: 'people',    label: 'PEOPLE'    },
  { id: 'gear',      label: 'GEAR'      },
  { id: 'locations', label: 'LOCATIONS' },
]

// ══════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════
export function Constellation() {
  const [scrubMode, setScrubMode] = useState('day')           // 'day' | 'range'
  const [scrubDay, setScrubDay] = useState(7)
  const [scrubRange, setScrubRange] = useState({ start: 4, end: 18 })
  const [hoveredPersonId, setHoveredPersonId] = useState(null)
  const [selectedPlanet, setSelectedPlanet] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [filter, setFilter] = useState('all')
  // Manual assignments override the scheduled commitments for the session.
  // Map<resourceId, productionId | 'home'>. When real data is wired later,
  // dragging should call into the commitments API instead of setting state here
  // (e.g. addCommitment(resourceId, productionId, scrubStart, scrubEnd)) so
  // the production card reflects the new assignment.
  const [manualAssignments, setManualAssignments] = useState({})
  const [draggingId, setDraggingId] = useState(null)         // visible-during-drag flag for re-render
  const [dragHoverPlanet, setDragHoverPlanet] = useState(null)

  // Resolved date range — same value for start/end in day mode.
  const scrubStartDay = scrubMode === 'day' ? scrubDay : scrubRange.start
  const scrubEndDay   = scrubMode === 'day' ? scrubDay : scrubRange.end
  const scrubStart = dateAtDayIndex(scrubStartDay)
  const scrubEnd   = dateAtDayIndex(scrubEndDay)

  // Toggle that re-centers the other state so the view stays anchored where
  // the user was just looking.
  const switchScrubMode = useCallback((next) => {
    if (next === scrubMode) return
    if (next === 'range') {
      const span = scrubRange.end - scrubRange.start
      const half = Math.floor(span / 2)
      let start = Math.max(0, scrubDay - half)
      let end = Math.min(WINDOW_DAYS, start + span)
      if (end - start < span) start = Math.max(0, end - span)
      setScrubRange({ start, end })
    } else {
      setScrubDay(Math.round((scrubRange.start + scrubRange.end) / 2))
    }
    setScrubMode(next)
  }, [scrubMode, scrubDay, scrubRange.start, scrubRange.end])

  // ── Derive per-orbiter state (people + gear) ─────────────────────────
  // Manual assignments take priority — once a user drags someone to a planet,
  // they stay there until dragged elsewhere or the view is reset.
  const orbiterStates = useMemo(() => {
    return ORBITERS.map(resource => {
      const manual = manualAssignments[resource.id]
      let state
      if (manual === 'home') {
        state = { mode: 'home', activeProds: [], manual: true }
      } else if (manual) {
        state = { mode: 'orbit', activeProds: [manual], manual: true }
      } else {
        state = { ...computeResourceState(resource, scrubStart, scrubEnd), manual: false }
      }
      return { resource, ...state }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubStartDay, scrubEndDay, manualAssignments])

  // Index into the home-surface ring, separate per kind so people and
  // gear sit on their own concentric rings
  const onHomeIndex = useMemo(() => {
    const totals = { people: 0, gear: 0 }
    orbiterStates.forEach(s => {
      if (s.mode === 'home') totals[s.resource.kind]++
    })
    const out = {}
    const counters = { people: 0, gear: 0 }
    orbiterStates.forEach(s => {
      if (s.mode === 'home') {
        const kind = s.resource.kind
        out[s.resource.id] = { idx: counters[kind]++, total: totals[kind] }
      }
    })
    return out
  }, [orbiterStates])

  const onHomeCount = orbiterStates.filter(s => s.mode === 'home').length

  // ── Conflicting planet pairs (for filaments between contested planets) ─
  const conflictPairs = useMemo(() => {
    const pairs = new Map()
    orbiterStates.forEach(s => {
      if (s.mode !== 'conflict') return
      for (let i = 0; i < s.activeProds.length; i++) {
        for (let j = i + 1; j < s.activeProds.length; j++) {
          const key = [s.activeProds[i], s.activeProds[j]].sort().join('-')
          pairs.set(key, (pairs.get(key) ?? 0) + 1)
        }
      }
    })
    return Array.from(pairs.entries()).map(([key, count]) => {
      const [a, b] = key.split('-')
      return { a, b, count }
    })
  }, [orbiterStates])

  // ── rAF orbit animation ─────────────────────────────────────────────
  const orbiterStatesRef = useRef(orbiterStates)
  const onHomeIndexRef = useRef(onHomeIndex)
  const hoveredIdRef = useRef(hoveredPersonId)
  const selectedPersonRef = useRef(selectedPerson)
  useEffect(() => { orbiterStatesRef.current = orbiterStates }, [orbiterStates])
  useEffect(() => { onHomeIndexRef.current = onHomeIndex }, [onHomeIndex])
  useEffect(() => { hoveredIdRef.current = hoveredPersonId }, [hoveredPersonId])
  useEffect(() => { selectedPersonRef.current = selectedPerson }, [selectedPerson])

  const orbiterRefs = useRef({})          // id -> SVG <g>
  const orbiterPositions = useRef({})     // id -> {x, y}
  const orbitTimeRef = useRef(0)

  // ── Drag-and-drop refs ─────────────────────────────────────────────
  const cameraRef = useRef(null)          // SVG <g> wrapper for camera
  const pendingDragRef = useRef(null)     // { resourceId, startX, startY, hasDragged }
  const dragRef = useRef(null)            // { resourceId, x, y } (in user-space) while dragging
  const justDraggedRef = useRef(false)    // suppresses canvas click after a drag-drop

  // Convert a mouse/touch event's client coords into the camera's local
  // (user-space) coords — accounts for SVG viewBox AND the camera transform.
  const toLocalPoint = useCallback((e) => {
    const camera = cameraRef.current
    if (!camera) return { x: CENTER.x, y: CENTER.y }
    const svg = camera.ownerSVGElement
    if (!svg) return { x: CENTER.x, y: CENTER.y }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX ?? e.touches?.[0]?.clientX
    pt.y = e.clientY ?? e.touches?.[0]?.clientY
    const ctm = camera.getScreenCTM()
    if (!ctm) return { x: CENTER.x, y: CENTER.y }
    return pt.matrixTransform(ctm.inverse())
  }, [])

  // Find the closest valid drop target for a given local-space point.
  // Returns 'home', a production id, or null.
  const findDropTarget = useCallback((x, y) => {
    let best = null
    let bestDist = Infinity
    // Production planets — buffer a little outside the body for forgiving drops
    for (const p of PRODUCTIONS) {
      const pos = PLANET_POS[p.id]
      const d = Math.hypot(pos.x - x, pos.y - y)
      if (d < PLANET_RADIUS + 60 && d < bestDist) { best = p.id; bestDist = d }
    }
    // Home planet (larger, but lower priority — only counts if cursor is well inside)
    const dHome = Math.hypot(CENTER.x - x, CENTER.y - y)
    if (dHome < HOME_RADIUS + 30 && dHome < bestDist) { best = 'home'; bestDist = dHome }
    return best
  }, [])

  // Window-level mousemove/mouseup handlers for drag-and-drop
  useEffect(() => {
    const onMove = (e) => {
      const pending = pendingDragRef.current
      if (!pending) return
      const cx = e.clientX ?? e.touches?.[0]?.clientX
      const cy = e.clientY ?? e.touches?.[0]?.clientY
      // Promote to active drag once movement exceeds the threshold
      if (!pending.hasDragged) {
        const dx = cx - pending.startClientX
        const dy = cy - pending.startClientY
        if (Math.hypot(dx, dy) > 5) {
          pending.hasDragged = true
          setDraggingId(pending.resourceId)
        } else {
          return
        }
      }
      const local = toLocalPoint(e)
      dragRef.current = { resourceId: pending.resourceId, x: local.x, y: local.y }
      const target = findDropTarget(local.x, local.y)
      setDragHoverPlanet(target)
    }
    const onUp = (e) => {
      const pending = pendingDragRef.current
      if (!pending) return
      if (pending.hasDragged) {
        const local = toLocalPoint(e)
        const target = findDropTarget(local.x, local.y)
        if (target) {
          setManualAssignments(prev => {
            const next = { ...prev }
            // 'home' keeps icon at home; productionId pins to that planet.
            // FUTURE: when wired to real data, this should call into the
            // commitments API instead, e.g.:
            //   addCommitment({
            //     resourceId: pending.resourceId,
            //     productionId: target,         // or remove all if 'home'
            //     start: scrubStart, end: scrubEnd,
            //   })
            next[pending.resourceId] = target
            return next
          })
        }
        justDraggedRef.current = true
      }
      pendingDragRef.current = null
      dragRef.current = null
      setDraggingId(null)
      setDragHoverPlanet(null)
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
  }, [toLocalPoint, findDropTarget])

  const computeTarget = useCallback((resource) => {
    const states = orbiterStatesRef.current
    const state = states.find(s => s.resource.id === resource.id)
    if (!state) return { x: CENTER.x, y: CENTER.y }
    const phase = ORBITER_PHASE[resource.id] ?? 0
    const t = orbitTimeRef.current
    if (state.mode === 'home') {
      const home = onHomeIndexRef.current[resource.id] ?? { idx: 0, total: 1 }
      return homeSurfacePosition(home.idx, home.total, resource.kind)
    }
    if (state.mode === 'orbit') {
      return orbitPosition(PLANET_POS[state.activeProds[0]], resource.kind, phase, t)
    }
    return midpointPosition(state.activeProds.map(id => PLANET_POS[id]), phase, t)
  }, [])

  // ── Initial position before paint, so nothing flashes at (0,0) ───────
  useLayoutEffect(() => {
    ORBITERS.forEach(resource => {
      const target = computeTarget(resource)
      orbiterPositions.current[resource.id] = target
      const el = orbiterRefs.current[resource.id]
      if (el) el.setAttribute('transform', `translate(${target.x} ${target.y})`)
    })
  }, [computeTarget])

  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      orbitTimeRef.current += dt * 0.08    // ~78s full orbit

      const lerp = 0.13
      const drag = dragRef.current
      const frozenId = hoveredIdRef.current ?? selectedPersonRef.current
      ORBITERS.forEach(resource => {
        // While dragging, snap directly to cursor position — feels instant.
        if (drag && drag.resourceId === resource.id) {
          orbiterPositions.current[resource.id] = { x: drag.x, y: drag.y }
          const el = orbiterRefs.current[resource.id]
          if (el) el.setAttribute('transform', `translate(${drag.x} ${drag.y})`)
          return
        }
        // While hovered or selected, freeze the orbiter so the user can study
        // it without it sliding. The lerp picks back up when un-frozen.
        if (frozenId === resource.id) return
        const target = computeTarget(resource)
        const cur = orbiterPositions.current[resource.id] ?? target
        const dx = target.x - cur.x
        const dy = target.y - cur.y
        const next = { x: cur.x + dx * lerp, y: cur.y + dy * lerp }
        orbiterPositions.current[resource.id] = next
        const el = orbiterRefs.current[resource.id]
        if (el) el.setAttribute('transform', `translate(${next.x} ${next.y})`)
      })

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [computeTarget])

  // ── Production "currently active" status — its date range intersects
  //    the scrubber window (single day in DAY mode, the full window in RANGE).
  const productionActive = useMemo(() => {
    const out = {}
    PRODUCTIONS.forEach(p => {
      out[p.id] = p.start <= scrubEnd && scrubStart <= p.end
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubStartDay, scrubEndDay])

  // ── Camera — focal point + zoom level driven by selectedPlanet ───────
  const camera = useMemo(() => {
    if (!selectedPlanet) return { x: CENTER.x, y: CENTER.y, zoom: 1 }
    if (selectedPlanet === 'home') return { x: CENTER.x, y: CENTER.y, zoom: 1.55 }
    const pos = PLANET_POS[selectedPlanet]
    if (!pos) return { x: CENTER.x, y: CENTER.y, zoom: 1 }
    return { x: pos.x, y: pos.y, zoom: 1.95 }
  }, [selectedPlanet])

  const cameraTransform = `translate(${VIEW_W/2 - camera.x * camera.zoom}px, ${VIEW_H/2 - camera.y * camera.zoom}px) scale(${camera.zoom})`

  const focusedProduction = selectedPlanet && selectedPlanet !== 'home'
    ? PRODUCTIONS.find(p => p.id === selectedPlanet)
    : null

  // ── Highlight logic ──────────────────────────────────────────────────
  const isOrbiterDimmed = (rid) => {
    if (selectedPerson)  return selectedPerson !== rid
    if (selectedPlanet) {
      const state = orbiterStates.find(s => s.resource.id === rid)
      return !state?.activeProds.includes(selectedPlanet)
    }
    if (hoveredPersonId) return hoveredPersonId !== rid
    return false
  }

  const isPlanetDimmed = (prodId) => {
    if (selectedPlanet) return selectedPlanet !== prodId
    if (selectedPerson) {
      const state = orbiterStates.find(s => s.resource.id === selectedPerson)
      return !state?.activeProds.includes(prodId)
    }
    return false
  }

  const resetView = () => {
    setSelectedPlanet(null)
    setSelectedPerson(null)
    setScrubMode('day')
    setScrubDay(7)
    setScrubRange({ start: 4, end: 18 })
    setFilter('all')
    setManualAssignments({})
  }

  // Resource currently being dragged (for the banner UI)
  const draggingResource = draggingId ? RESOURCES.find(r => r.id === draggingId) : null

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-5">
      <Header />

      <div className="card-elevated mt-4 overflow-hidden">
        <Toolbar
          scrubMode={scrubMode}
          scrubStart={scrubStart}
          scrubEnd={scrubEnd}
          scrubStartDay={scrubStartDay}
          scrubEndDay={scrubEndDay}
          orbiterStates={orbiterStates}
          conflictPairs={conflictPairs}
          onReset={resetView}
          filter={filter}
          setFilter={setFilter}
        />

        <div
          className="relative select-none"
          style={{
            background: 'radial-gradient(ellipse at center, #0a0e1f 0%, #050608 70%)',
            height: 720,
            cursor: draggingId ? 'grabbing' : undefined,
          }}
          onClick={() => {
            if (justDraggedRef.current) { justDraggedRef.current = false; return }
            setSelectedPlanet(null); setSelectedPerson(null)
          }}
        >
          <Starfield />
          <NebulaBackground />

          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="relative w-full h-full"
          >
            <PlanetDefs />

            {/* ── Camera wrapper: smooth zoom + pan to focused planet ── */}
            <g
              ref={cameraRef}
              style={{
                transform: cameraTransform,
                transition: `transform 1100ms ${SMOOTH_EASE}`,
                transformOrigin: '0 0',
              }}>

            {/* ── Conflict filaments — drawn beneath planets ──────── */}
            {conflictPairs.map(({ a, b, count }) => {
              const pa = PLANET_POS[a], pb = PLANET_POS[b]
              if (!pa || !pb) return null
              return (
                <line
                  key={`${a}-${b}`}
                  x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.45}
                  strokeDasharray="6 5"
                  style={{
                    animation: 'conflict-dash 1.2s linear infinite',
                    filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))',
                  }}
                />
              )
            })}

            {/* ── Orbit rings beneath planets (people inner, gear outer) ─ */}
            {PRODUCTIONS.map(p => {
              const pos = PLANET_POS[p.id]
              const dim = isPlanetDimmed(p.id) || !productionActive[p.id]
              const ringStyle = {
                animation: 'orbit-trail 60s linear infinite',
                transition: `stroke-opacity 600ms ${SMOOTH_EASE}`,
              }
              return (
                <Fragment key={`rings-${p.id}`}>
                  <circle
                    cx={pos.x} cy={pos.y} r={ORBIT_R_PEOPLE}
                    fill="none" stroke={p.color}
                    strokeOpacity={dim ? 0.05 : 0.25}
                    strokeWidth={1}
                    strokeDasharray="3 4"
                    style={ringStyle}
                  />
                  <circle
                    cx={pos.x} cy={pos.y} r={ORBIT_R_GEAR}
                    fill="none" stroke={p.color}
                    strokeOpacity={dim ? 0.04 : 0.15}
                    strokeWidth={0.8}
                    strokeDasharray="2 5"
                    style={ringStyle}
                  />
                </Fragment>
              )
            })}

            {/* ── Project planets ─────────────────────────────────── */}
            {PRODUCTIONS.map(p => (
              <ProjectPlanet
                key={p.id}
                production={p}
                pos={PLANET_POS[p.id]}
                radius={PLANET_RADIUS}
                isActive={productionActive[p.id]}
                isSelected={selectedPlanet === p.id}
                isDimmed={isPlanetDimmed(p.id)}
                location={PRODUCTION_LOCATION[p.id]}
                highlightLocation={filter === 'locations'}
                dropTargeted={dragHoverPlanet === p.id}
                activeCount={orbiterStates.filter(s =>
                  s.activeProds.includes(p.id)
                ).length}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPlanet(s => s === p.id ? null : p.id)
                  setSelectedPerson(null)
                }}
              />
            ))}

            {/* ── Home planet (Orbital Studio) ─────────────────────── */}
            <HomePlanet
              pos={CENTER}
              radius={HOME_RADIUS}
              onStation={orbiterStates.filter(s => s.mode === 'home' && s.resource.kind === 'people').length}
              gearOnStation={orbiterStates.filter(s => s.mode === 'home' && s.resource.kind === 'gear').length}
              isSelected={selectedPlanet === 'home'}
              highlightLocation={filter === 'locations'}
              dropTargeted={dragHoverPlanet === 'home'}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPlanet(s => s === 'home' ? null : 'home')
                setSelectedPerson(null)
              }}
            />

            {/* ── Orbiters: people + gear (positions driven by rAF) ── */}
            {orbiterStates.map(({ resource, mode, manual }) => {
              const visibleByFilter =
                filter === 'all' ||
                (filter === 'people' && resource.kind === 'people') ||
                (filter === 'gear'   && resource.kind === 'gear')
              const isBeingDragged = draggingId === resource.id
              return (
                <g
                  key={resource.id}
                  ref={el => { if (el) orbiterRefs.current[resource.id] = el }}
                  style={{
                    cursor: !visibleByFilter ? 'default' : (isBeingDragged ? 'grabbing' : 'grab'),
                    opacity: !visibleByFilter ? 0
                      : isBeingDragged ? 1
                      : (isOrbiterDimmed(resource.id) ? 0.2 : 1),
                    pointerEvents: visibleByFilter ? 'auto' : 'none',
                    transition: `opacity 350ms ${SMOOTH_EASE}`,
                  }}
                  onMouseDown={(e) => {
                    if (!visibleByFilter) return
                    e.stopPropagation()
                    pendingDragRef.current = {
                      resourceId: resource.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      hasDragged: false,
                    }
                  }}
                  onTouchStart={(e) => {
                    if (!visibleByFilter) return
                    e.stopPropagation()
                    const t = e.touches?.[0]
                    if (!t) return
                    pendingDragRef.current = {
                      resourceId: resource.id,
                      startClientX: t.clientX,
                      startClientY: t.clientY,
                      hasDragged: false,
                    }
                  }}
                  onMouseEnter={() => setHoveredPersonId(resource.id)}
                  onMouseLeave={() => setHoveredPersonId(null)}
                  onClick={(e) => {
                    if (justDraggedRef.current) {
                      justDraggedRef.current = false
                      e.stopPropagation()
                      return
                    }
                    e.stopPropagation()
                    // Selecting a person closes any active planet card so the
                    // expanded resource tooltip doesn't collide with it at the
                    // same bottom-left position.
                    setSelectedPlanet(null)
                    setSelectedPerson(s => s === resource.id ? null : resource.id)
                  }}
                >
                  <ResourceGlyph
                    resource={resource}
                    mode={mode}
                    dragging={isBeingDragged}
                    manual={manual}
                    hovered={hoveredPersonId === resource.id || selectedPerson === resource.id}
                  />
                </g>
              )
            })}
            </g>{/* end camera wrapper */}
          </svg>

          {/* ── Focus lock HUD (when a planet is selected) ─────────── */}
          {selectedPlanet && !draggingResource && (
            <FocusLock
              focusedProduction={focusedProduction}
              isHome={selectedPlanet === 'home'}
              onReturn={(e) => { e.stopPropagation(); setSelectedPlanet(null) }}
            />
          )}

          {/* ── Drag banner (during drag) ────────────────────────── */}
          {draggingResource && (
            <DragBanner
              resource={draggingResource}
              targetId={dragHoverPlanet}
            />
          )}

          {/* ── Hovered orbiter tooltip ─────────────────────────────── */}
          {/* Suppress hover-preview when a planet is selected — the
              production card takes that space. Click-pinned resource
              tooltip still shows. */}
          <ResourceTooltip
            resourceId={selectedPerson || (selectedPlanet ? null : hoveredPersonId)}
            states={orbiterStates}
            scrubMode={scrubMode}
            scrubStart={scrubStart}
            scrubEnd={scrubEnd}
            scrubStartDay={scrubStartDay}
            scrubEndDay={scrubEndDay}
            expanded={!!selectedPerson}
            onClose={() => setSelectedPerson(null)}
          />

          {/* ── Production card ─────────────────────────────────────── */}
          {selectedPlanet && (
            <ProductionCard
              planetId={selectedPlanet}
              orbiterStates={orbiterStates}
              scrubStart={scrubStart}
              scrubEnd={scrubEnd}
              scrubStartDay={scrubStartDay}
              scrubEndDay={scrubEndDay}
              scrubMode={scrubMode}
              onClose={() => setSelectedPlanet(null)}
            />
          )}

          <SceneStats orbiterStates={orbiterStates} conflictPairs={conflictPairs} />
        </div>

        <TimeScrubber
          mode={scrubMode}
          setMode={switchScrubMode}
          day={scrubDay}
          setDay={setScrubDay}
          range={scrubRange}
          setRange={setScrubRange}
        />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Header & toolbar
// ══════════════════════════════════════════════════════════════════════════
function Header() {
  return (
    <div>
      <p className="hud-label mb-1">CONSTELLATION VIEW</p>
      <h1 className="text-2xl font-semibold text-orbital-text tracking-tight">
        The studio's gravitational map
      </h1>
      <p className="text-sm text-orbital-subtle mt-0.5">
        People orbit the productions they're committed to. When two productions need them at once, they're stuck at the midpoint — torn.
      </p>
    </div>
  )
}

function Toolbar({ scrubMode, scrubStart, scrubEnd, scrubStartDay, scrubEndDay, orbiterStates, conflictPairs, onReset, filter, setFilter }) {
  const conflictCount = orbiterStates.filter(s => s.mode === 'conflict').length
  const multiCount    = orbiterStates.filter(s => s.mode === 'multi').length
  const orbitCount    = orbiterStates.filter(s => s.mode === 'orbit').length
  return (
    <div style={{ borderBottom: '1px solid var(--orbital-border)' }}>
      {/* Row 1 — playhead/window + status badges + reset */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-4">
        <div className="flex items-center gap-3">
          {scrubMode === 'day' ? (
            <>
              <span className="hud-label">PLAYHEAD</span>
              <span className="font-telemetry text-[12px] text-orbital-text tracking-wider">
                {format(scrubStart, 'EEE · MMM d, yyyy').toUpperCase()}
              </span>
            </>
          ) : (
            <>
              <span className="hud-label">WINDOW</span>
              <span className="font-telemetry text-[12px] text-orbital-text tracking-wider">
                {format(scrubStart, 'MMM d').toUpperCase()} → {format(scrubEnd, 'MMM d').toUpperCase()}
              </span>
              <span className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.18em]">
                · {scrubEndDay - scrubStartDay} DAYS
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <BadgeStat label="ON STATION" value={orbiterStates.filter(s => s.mode === 'home').length}
            color="#60a5fa" />
          <BadgeStat label="DEPLOYED" value={orbitCount}
            color="#34d399" />
          {scrubMode === 'range' && (
            <BadgeStat label="MULTI" value={multiCount}
              color={multiCount > 0 ? '#fbbf24' : '#71717a'} />
          )}
          <BadgeStat label="TORN" value={conflictCount}
            color={conflictCount > 0 ? '#ef4444' : '#71717a'} pulse={conflictCount > 0} />
          <button onClick={onReset}
            className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-widest font-telemetry transition-colors"
            style={{
              color: 'var(--orbital-subtle)',
              border: '1px solid var(--orbital-border)',
              background: 'transparent',
            }}>
            <RotateCcw size={10} /> RESET
          </button>
        </div>
      </div>

      {/* Row 2 — filter pills */}
      <div className="flex items-center gap-2 px-4 py-2"
        style={{ borderTop: '1px dashed var(--orbital-border)' }}>
        <Filter size={11} className="text-orbital-subtle" />
        <span className="hud-label">FILTER</span>
        <div className="flex items-center gap-1 ml-1">
          {FILTER_OPTIONS.map(opt => (
            <FilterPill key={opt.id}
              active={filter === opt.id}
              onClick={() => setFilter(opt.id)}>
              {opt.label}
            </FilterPill>
          ))}
        </div>
        <span className="ml-auto font-telemetry text-[9px] text-orbital-dim tracking-[0.18em]">
          {filter === 'all' && 'ALL RESOURCES VISIBLE'}
          {filter === 'people' && 'SHOWING PEOPLE ONLY'}
          {filter === 'gear' && 'SHOWING GEAR ONLY'}
          {filter === 'locations' && 'SHOWING PLANET LOCATIONS'}
        </span>
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[10px] font-medium tracking-[0.15em] transition-all"
      style={{
        background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'rgba(59,130,246,0.5)' : 'var(--orbital-border)',
        color: active ? '#60a5fa' : 'var(--orbital-subtle)',
        boxShadow: active ? '0 0 10px rgba(59,130,246,0.25)' : 'none',
      }}>
      {children}
    </button>
  )
}

function BadgeStat({ label, value, color, pulse }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--orbital-border)',
      }}>
      <span
        className={pulse ? 'animate-indicator-pulse' : ''}
        style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span className="font-telemetry text-[8px] text-orbital-subtle tracking-[0.2em]">{label}</span>
      <span className="font-telemetry text-[12px] text-orbital-text tracking-wider">{value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Planet rendering
// ══════════════════════════════════════════════════════════════════════════

// Lighten/darken helpers (color must be hex #rrggbb)
function adjustColor(hex, percent) {
  const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + 255 * percent)))
  const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + 255 * percent)))
  const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + 255 * percent)))
  return `rgb(${r},${g},${b})`
}

function PlanetDefs() {
  return (
    <defs>
      {/* ── Home planet gradients ─────────────────────────────────── */}
      <radialGradient id="home-atm" cx="50%" cy="50%" r="50%">
        <stop offset="58%" stopColor="rgba(75,180,220,0)" />
        <stop offset="78%" stopColor="rgba(75,180,220,0.28)" />
        <stop offset="100%" stopColor="rgba(75,180,220,0)" />
      </radialGradient>
      <radialGradient id="home-body" cx="35%" cy="32%" r="75%">
        <stop offset="0%"  stopColor="#7ec1e0" />
        <stop offset="40%" stopColor="#3a7a9a" />
        <stop offset="80%" stopColor="#1a4060" />
        <stop offset="100%" stopColor="#08213a" />
      </radialGradient>
      <radialGradient id="home-shade" cx="80%" cy="50%" r="60%">
        <stop offset="0%"  stopColor="rgba(0,0,0,0.55)" />
        <stop offset="60%" stopColor="rgba(0,0,0,0.0)" />
      </radialGradient>
      <linearGradient id="home-equator" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stopColor="rgba(120,180,210,0)" />
        <stop offset="50%" stopColor="rgba(120,180,210,0.15)" />
        <stop offset="100%" stopColor="rgba(120,180,210,0)" />
      </linearGradient>

      {/* ── Per-production planet gradients ─────────────────────── */}
      {PRODUCTIONS.map(p => (
        <Fragment key={p.id}>
          <radialGradient id={`atm-${p.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor={p.color} stopOpacity="0" />
            <stop offset="78%" stopColor={p.color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`body-${p.id}`} cx="35%" cy="30%" r="80%">
            <stop offset="0%"  stopColor={adjustColor(p.color, 0.22)} />
            <stop offset="50%" stopColor={p.color} />
            <stop offset="100%" stopColor={adjustColor(p.color, -0.55)} />
          </radialGradient>
          <radialGradient id={`shade-${p.id}`} cx="82%" cy="50%" r="60%">
            <stop offset="0%"  stopColor="rgba(0,0,0,0.55)" />
            <stop offset="60%" stopColor="rgba(0,0,0,0.0)" />
          </radialGradient>
        </Fragment>
      ))}

      {/* Planet body clip — used to clip surface details inside a circle */}
      {PRODUCTIONS.map(p => (
        <clipPath key={`clip-${p.id}`} id={`clip-${p.id}`}>
          <circle r={PLANET_RADIUS} />
        </clipPath>
      ))}
      <clipPath id="clip-home">
        <circle r={HOME_RADIUS} />
      </clipPath>
    </defs>
  )
}

function HomePlanet({ pos, radius, onStation, gearOnStation, isSelected, highlightLocation, dropTargeted, onClick }) {
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}>
      {/* Atmospheric halo */}
      <circle r={radius * 1.55} fill="url(#home-atm)" />

      {/* Body */}
      <circle r={radius} fill="url(#home-body)" />

      {/* Slowly rotating cloud + landmass overlay (clipped to body) */}
      <g clipPath="url(#clip-home)">
        <g>
          {/* Faux continents */}
          <ellipse cx={-radius * 0.32} cy={-radius * 0.18}
            rx={radius * 0.4} ry={radius * 0.16}
            fill="#0c2438" opacity={0.6}
            transform="rotate(-22)" />
          <ellipse cx={radius * 0.18} cy={radius * 0.28}
            rx={radius * 0.45} ry={radius * 0.13}
            fill="#0c2438" opacity={0.55}
            transform="rotate(12)" />
          <ellipse cx={radius * 0.42} cy={-radius * 0.32}
            rx={radius * 0.22} ry={radius * 0.1}
            fill="#0c2438" opacity={0.5} />
          {/* Cloud bands */}
          <ellipse cx={0} cy={-radius * 0.45}
            rx={radius * 1.05} ry={radius * 0.12}
            fill="white" opacity={0.13} />
          <ellipse cx={0} cy={radius * 0.05}
            rx={radius * 1.0} ry={radius * 0.08}
            fill="white" opacity={0.08} />
          <ellipse cx={0} cy={radius * 0.5}
            rx={radius * 0.95} ry={radius * 0.1}
            fill="white" opacity={0.11} />
          <animateTransform attributeName="transform" type="rotate"
            from="0 0 0" to="360 0 0" dur="240s" repeatCount="indefinite" />
        </g>
      </g>

      {/* Day/night terminator */}
      <circle r={radius} fill="url(#home-shade)" />

      {/* Equatorial polish */}
      <ellipse rx={radius} ry={radius * 0.45} fill="url(#home-equator)" />

      {/* Specular highlight */}
      <ellipse cx={-radius * 0.35} cy={-radius * 0.4}
        rx={radius * 0.45} ry={radius * 0.22}
        fill="rgba(255,255,255,0.22)" />

      {/* Body outline ring */}
      <circle r={radius} fill="none"
        stroke={dropTargeted ? '#fbbf24' : (isSelected ? '#7ec1e0' : 'rgba(125,180,210,0.35)')}
        strokeWidth={dropTargeted ? 2 : (isSelected ? 1.2 : 0.6)}
        style={{
          filter: dropTargeted ? 'drop-shadow(0 0 14px rgba(251,191,36,0.7))' : undefined,
          transition: 'all 220ms ease-out',
        }} />

      {/* Drop-target pulse ring */}
      {dropTargeted && (
        <circle r={radius + 8} fill="none" stroke="#fbbf24" strokeOpacity={0.7} strokeWidth={1}>
          <animate attributeName="r" values={`${radius + 4};${radius + 18};${radius + 4}`}
            dur="1s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.7;0.1;0.7"
            dur="1s" repeatCount="indefinite" />
        </circle>
      )}

      {/* ── Hemisphere divider — splits PPL (top) from GEAR (bottom) ── */}
      <g clipPath="url(#clip-home)">
        {/* Subtle filled band that sells the segmentation */}
        <rect x={-radius} y={-1.5} width={radius * 2} height={3}
          fill="rgba(126,193,224,0.18)" />
        {/* Sharp dashed equator line */}
        <line x1={-radius} y1={0} x2={radius} y2={0}
          stroke="rgba(180,225,245,0.65)" strokeWidth={0.8}
          strokeDasharray="3 4"
          style={{ filter: 'drop-shadow(0 0 3px rgba(126,193,224,0.7))' }} />
      </g>

      {/* Section labels — small chevrons just inside the rim */}
      <g pointerEvents="none">
        <text x={-radius * 0.9} y={-radius * 0.78}
          fontFamily="'Space Mono', monospace"
          fontSize={8.5} letterSpacing={2}
          fill="rgba(205,233,245,0.85)"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.6))' }}>
          ▲ PPL · {onStation}
        </text>
        <text x={-radius * 0.9} y={radius * 0.85}
          fontFamily="'Space Mono', monospace"
          fontSize={8.5} letterSpacing={2}
          fill="rgba(205,233,245,0.85)"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.6))' }}>
          ▼ GEAR · {gearOnStation}
        </text>
      </g>

      {/* Label */}
      <g transform={`translate(0 ${radius + 32})`}>
        <text textAnchor="middle"
          fill={highlightLocation ? '#cde9f5' : '#fff'}
          fontSize={highlightLocation ? 16 : 14}
          fontWeight={600}
          letterSpacing={highlightLocation ? 1.5 : 0.5}
          style={{
            filter: highlightLocation ? 'drop-shadow(0 0 10px rgba(126,193,224,0.7))' : undefined,
            transition: 'all 350ms ease-out',
          }}>
          ORBITAL STUDIO
        </text>
        <text textAnchor="middle" y={16}
          fill={highlightLocation ? '#7ec1e0' : '#5a8aa8'}
          fontFamily="'Space Mono', monospace" fontSize={9} letterSpacing={2}
          style={{ transition: 'fill 350ms ease-out' }}>
          {highlightLocation ? '◈ HOME BASE · IN-HOUSE LOCATION' : `HOME · ${onStation} PPL · ${gearOnStation} GEAR`}
        </text>
      </g>
    </g>
  )
}

function ProjectPlanet({ production, pos, radius, isActive, isSelected, isDimmed, location, highlightLocation, dropTargeted, activeCount, onClick }) {
  const p = production
  const opacity = isDimmed ? 0.35 : 1
  const desat = !isActive ? 'saturate(0.55) brightness(0.7)' : 'none'
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        opacity,
        filter: desat,
        transition: `opacity 500ms ${SMOOTH_EASE}, filter 500ms ${SMOOTH_EASE}`,
      }}>
      {/* Atmospheric halo */}
      <circle r={radius * 1.65} fill={`url(#atm-${p.id})`} />

      {/* Pulse ring (only when this production is currently active) */}
      {isActive && (
        <circle r={radius + 4} fill="none" stroke={p.color}
          strokeOpacity={0.4} strokeWidth={1}>
          <animate attributeName="r" from={radius + 2} to={radius + 26}
            dur="3.4s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" from="0.45" to="0"
            dur="3.4s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Body */}
      <circle r={radius} fill={`url(#body-${p.id})`} />

      {/* Surface bands (clipped) */}
      <g clipPath={`url(#clip-${p.id})`}>
        <g>
          <ellipse cx={0} cy={-radius * 0.45}
            rx={radius * 1.05} ry={radius * 0.1}
            fill={adjustColor(p.color, 0.2)} opacity={0.35} />
          <ellipse cx={0} cy={-radius * 0.1}
            rx={radius * 1.0} ry={radius * 0.07}
            fill={adjustColor(p.color, -0.3)} opacity={0.45} />
          <ellipse cx={0} cy={radius * 0.3}
            rx={radius * 0.98} ry={radius * 0.09}
            fill={adjustColor(p.color, 0.15)} opacity={0.4} />
          <ellipse cx={0} cy={radius * 0.55}
            rx={radius * 0.9} ry={radius * 0.08}
            fill={adjustColor(p.color, -0.4)} opacity={0.5} />
          <animateTransform attributeName="transform" type="rotate"
            from="0 0 0" to="360 0 0" dur="180s" repeatCount="indefinite" />
        </g>
      </g>

      {/* Day/night terminator */}
      <circle r={radius} fill={`url(#shade-${p.id})`} />

      {/* Specular highlight */}
      <ellipse cx={-radius * 0.32} cy={-radius * 0.35}
        rx={radius * 0.42} ry={radius * 0.2}
        fill="rgba(255,255,255,0.22)" />

      {/* Outline ring */}
      <circle r={radius} fill="none"
        stroke={dropTargeted ? '#fbbf24' : (isSelected ? p.color : `${p.color}55`)}
        strokeWidth={dropTargeted ? 2 : (isSelected ? 1.5 : 0.7)}
        style={{
          filter: dropTargeted ? 'drop-shadow(0 0 14px rgba(251,191,36,0.7))' : undefined,
          transition: 'all 220ms ease-out',
        }} />

      {/* Drop-target pulse ring */}
      {dropTargeted && (
        <circle r={radius + 6} fill="none" stroke="#fbbf24" strokeOpacity={0.7} strokeWidth={1}>
          <animate attributeName="r" values={`${radius + 2};${radius + 16};${radius + 2}`}
            dur="1s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.7;0.1;0.7"
            dur="1s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Label */}
      <g transform={`translate(0 ${radius + 26})`}>
        <text textAnchor="middle" fill="#e8eaee"
          fontSize={13} fontWeight={600}>
          {p.name}
        </text>
        <text textAnchor="middle" y={14} fill={p.color}
          fontFamily="'Space Mono', monospace" fontSize={9} letterSpacing={1.5}
          style={{ filter: `drop-shadow(0 0 4px ${p.glow})` }}>
          {p.code} · {activeCount} ACTIVE
        </text>
        {location && (
          <text textAnchor="middle" y={28}
            fill={highlightLocation ? '#fff' : '#6e6f78'}
            fontFamily="'Space Mono', monospace"
            fontSize={highlightLocation ? 11 : 8.5}
            fontWeight={highlightLocation ? 700 : 400}
            letterSpacing={highlightLocation ? 2 : 1.5}
            style={{
              filter: highlightLocation ? `drop-shadow(0 0 8px ${p.color})` : undefined,
              transition: 'all 350ms ease-out',
            }}>
            ◈ {shortLocationLabel(location)}
          </text>
        )}
      </g>
    </g>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Resource glyph — circle for people, hexagon for gear
// ══════════════════════════════════════════════════════════════════════════
function ResourceGlyph({ resource, mode, dragging, manual, hovered }) {
  const conflict = mode === 'conflict'
  const isGear = resource.kind === 'gear'
  const showNameLabel = mode !== 'home' || hovered || dragging
  // The PARENT <g> (set up in the orbiterStates.map) has its `transform`
  // attribute managed by rAF. This inner <g> uses a CSS transform so its
  // scale composes with the parent's translate without fighting it.
  return (
    <g
      style={{
        transform: dragging ? 'scale(1.25)' : 'scale(1)',
        transformOrigin: '0 0',
        transition: 'transform 180ms ease-out',
      }}
    >
      {/* Halo when dragging */}
      {dragging && (
        <circle r={22} fill="rgba(126,193,224,0.18)" stroke="rgba(126,193,224,0.5)" strokeWidth={1}>
          <animate attributeName="r" values="18;28;18" dur="1.1s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Hover ring — also visually signals the orbit is paused */}
      {hovered && !dragging && (
        <>
          <circle r={17} fill="none"
            stroke={resource.color} strokeOpacity={0.7} strokeWidth={1}
            strokeDasharray="3 2" />
          <circle r={20} fill="none"
            stroke={resource.color} strokeOpacity={0.18} strokeWidth={1} />
        </>
      )}
      {/* Pin marker when this orbiter has a manual assignment */}
      {manual && !dragging && (
        <circle r={14} fill="none" stroke="#fbbf24" strokeWidth={1} strokeOpacity={0.7}
          strokeDasharray="2 3" />
      )}
      {/* Conflict glow halo */}
      {conflict && (
        <>
          <ResourceShape kind={resource.kind} size={20} fill="rgba(239,68,68,0.18)">
            <animate attributeName="opacity" values="0.55;0.05;0.55" dur="1.5s" repeatCount="indefinite" />
          </ResourceShape>
          <ResourceShape kind={resource.kind} size={14} fill="rgba(239,68,68,0.15)" />
        </>
      )}

      {/* Subtle aura matching resource color */}
      <ResourceShape kind={resource.kind} size={13} fill={resource.color} opacity={0.15} />

      {/* Body */}
      <ResourceShape
        kind={resource.kind}
        size={9.5}
        fill={resource.color}
        stroke={conflict ? '#ef4444' : 'rgba(255,255,255,0.5)'}
        strokeWidth={1.4}
        style={{ filter: `drop-shadow(0 0 5px ${resource.color}aa)` }}
      />

      {/* Initial */}
      <text textAnchor="middle" dy={3.4} fill="#0a0c10"
        fontSize={isGear ? 7.5 : 10}
        fontWeight={800}
        fontFamily={isGear ? "'Space Mono', monospace" : undefined}>
        {resource.initial}
      </text>

      {/* Conflict warning badge */}
      {conflict && (
        <g transform="translate(8 -8)">
          <circle r={6.5} fill="#ef4444"
            stroke="#fff" strokeWidth={1.2} />
          <text textAnchor="middle" dy={2.6} fill="#fff"
            fontSize={9} fontWeight={800}>!</text>
        </g>
      )}

      {/* Name label below — hidden when at home (would crowd inside the planet),
          but always shown on hover/select/drag so the user can identify the
          icon they're studying. */}
      {showNameLabel && (
        <g>
          {/* Subtle pill background so the label reads against any planet surface */}
          <rect x={-resource.name.length * 3 - 4} y={15}
            width={resource.name.length * 6 + 8} height={11}
            fill="rgba(15,17,22,0.85)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5}
            rx={1} />
          <text textAnchor="middle" y={23} fill="#d6d8dd"
            fontSize={9.5} fontWeight={500}>
            {resource.name}
          </text>
        </g>
      )}
    </g>
  )
}

function ResourceShape({ kind, size, fill, stroke, strokeWidth, opacity, style, children }) {
  const props = { fill, stroke, strokeWidth, opacity, style }
  if (kind === 'gear') {
    const r = size
    const pts = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`)
    }
    return <polygon points={pts.join(' ')} {...props}>{children}</polygon>
  }
  // Default: people = circle
  return <circle r={size} {...props}>{children}</circle>
}

// ══════════════════════════════════════════════════════════════════════════
// Focus lock HUD — shown while camera is zoomed into a planet
// ══════════════════════════════════════════════════════════════════════════
function FocusLock({ focusedProduction, isHome, onReturn }) {
  const accent = isHome ? '#7ec1e0' : focusedProduction?.color
  const glow   = isHome ? 'rgba(126,193,224,0.55)' : focusedProduction?.glow
  const label  = isHome ? 'ORBITAL STUDIO · HOME BASE' : `${focusedProduction?.code} · ${focusedProduction?.name?.toUpperCase()}`
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 animate-hud-in">
      <button
        onClick={onReturn}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:text-white"
        style={{
          color: 'var(--orbital-subtle)',
          background: 'rgba(15,17,22,0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <ArrowLeft size={11} />
        <span className="font-telemetry text-[9px] tracking-[0.22em]">RETURN TO ORBIT</span>
      </button>
      <div className="inline-flex items-center gap-2 px-3 py-1.5"
        style={{
          background: 'rgba(15,17,22,0.85)',
          backdropFilter: 'blur(6px)',
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 14px ${glow}`,
        }}>
        {/* Targeting reticle corners */}
        <span className="relative inline-block" style={{ width: 10, height: 10 }}>
          <span className="absolute top-0 left-0" style={{ width: 4, height: 1, background: accent }} />
          <span className="absolute top-0 left-0" style={{ width: 1, height: 4, background: accent }} />
          <span className="absolute top-0 right-0" style={{ width: 4, height: 1, background: accent }} />
          <span className="absolute top-0 right-0" style={{ width: 1, height: 4, background: accent }} />
          <span className="absolute bottom-0 left-0" style={{ width: 4, height: 1, background: accent }} />
          <span className="absolute bottom-0 left-0" style={{ width: 1, height: 4, background: accent }} />
          <span className="absolute bottom-0 right-0" style={{ width: 4, height: 1, background: accent }} />
          <span className="absolute bottom-0 right-0" style={{ width: 1, height: 4, background: accent }} />
        </span>
        <span className="font-telemetry text-[9px] tracking-[0.22em] animate-indicator-pulse"
          style={{ color: accent, textShadow: `0 0 4px ${glow}` }}>
          FOCUS LOCK
        </span>
        <span className="font-telemetry text-[10px] tracking-[0.18em] text-orbital-text">
          {label}
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Drag banner — shown while a resource is being dragged
// ══════════════════════════════════════════════════════════════════════════
function DragBanner({ resource, targetId }) {
  const targetProd = targetId && targetId !== 'home'
    ? PRODUCTIONS.find(p => p.id === targetId)
    : null
  const isHome = targetId === 'home'
  const accent = isHome ? '#7ec1e0' : (targetProd?.color ?? '#fbbf24')
  const glow = isHome ? 'rgba(126,193,224,0.6)' : (targetProd?.glow ?? 'rgba(251,191,36,0.6)')
  const label = !targetId
    ? 'HOVER A PLANET TO DEPLOY · DROP IN SPACE TO CANCEL'
    : isHome
      ? `RELEASE TO SEND TO HOME BASE`
      : `RELEASE TO DEPLOY TO ${targetProd.name.toUpperCase()}`
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 animate-hud-in pointer-events-none">
      <div className="inline-flex items-center gap-2 px-3 py-1.5"
        style={{
          background: 'rgba(15,17,22,0.92)',
          backdropFilter: 'blur(6px)',
          border: `1px solid ${accent}66`,
          boxShadow: `0 0 14px ${glow}`,
        }}>
        <span className="w-1.5 h-1.5 rounded-full"
          style={{ background: resource.color, boxShadow: `0 0 6px ${resource.color}` }} />
        <span className="font-telemetry text-[10px] tracking-[0.18em] text-orbital-text">
          ASSIGNING · {resource.name.toUpperCase()}
        </span>
        <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <span className="font-telemetry text-[9px] tracking-[0.22em] animate-indicator-pulse"
          style={{ color: accent, textShadow: `0 0 4px ${glow}` }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Tooltip
// ══════════════════════════════════════════════════════════════════════════
function ResourceTooltip({ resourceId, states, scrubMode, scrubStart, scrubEnd, scrubStartDay, scrubEndDay, expanded, onClose }) {
  if (!resourceId) return null
  const state = states.find(s => s.resource.id === resourceId)
  if (!state) return null
  const r = state.resource
  const allProds = productionsForResource(resourceId)
  const homeLabel = r.kind === 'gear' ? 'IN STORAGE' : 'ON STATION'
  const myCommitments = COMMITMENTS.filter(c => c.resourceId === resourceId)
  const totalCommittedDays = myCommitments.reduce(
    (sum, c) => sum + (Math.round((c.end - c.start) / 86400000) + 1), 0
  )
  return (
    <div
      className={expanded ? '' : 'pointer-events-none'}
      style={{
        position: 'absolute',
        left: 16, bottom: 56,
        padding: expanded ? '22px 26px 24px' : '20px 24px',
        minWidth: expanded ? 580 : 420,
        maxWidth: expanded ? 640 : 480,
        maxHeight: expanded ? 'min(620px, calc(100% - 80px))' : 'auto',
        overflowY: expanded ? 'auto' : 'visible',
        background: 'rgba(11,13,18,0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03) inset',
        transition: 'min-width 320ms ease-out, max-width 320ms ease-out, padding 320ms ease-out',
      }}
    >
      {/* ── Header — name + kind + mode badge ─────────────────────── */}
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="w-2 h-2 rounded-full"
          style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} />
        <span className="text-[18px] font-semibold text-orbital-text tracking-tight">{r.name}</span>
        <span className="ml-1 font-telemetry text-[9px] text-orbital-dim tracking-widest">
          {r.kind === 'gear' ? 'GEAR' : 'PERSON'}
        </span>
        {state.mode === 'conflict' && (
          <ModeBadge accent="#ef4444" bg="rgba(239,68,68,0.18)" border="rgba(239,68,68,0.5)" color="#fca5a5">
            <AlertTriangle size={10} /> TORN
          </ModeBadge>
        )}
        {state.mode === 'multi' && (
          <ModeBadge accent="#fbbf24" bg="rgba(251,191,36,0.13)" border="rgba(251,191,36,0.4)" color="#fcd34d">
            MULTI
          </ModeBadge>
        )}
        {state.mode === 'home' && (
          <ModeBadge accent="#60a5fa" bg="rgba(96,165,250,0.13)" border="rgba(96,165,250,0.4)" color="#93c5fd">
            <Home size={9} /> {homeLabel}
          </ModeBadge>
        )}
        {state.mode === 'orbit' && state.activeProds[0] && (() => {
          const p = PRODUCTIONS.find(x => x.id === state.activeProds[0])
          return p && (
            <ModeBadge accent={p.color} bg={`${p.color}22`} border={`${p.color}77`} color={p.color}>
              ON {p.code}
            </ModeBadge>
          )
        })()}
      </div>

      <p className="text-[13px] text-orbital-subtle leading-snug mb-3">
        {r.role}
        {r.contractor && (
          <span className="ml-2 font-telemetry text-[10px] text-orbital-dim tracking-widest">EXT</span>
        )}
        {state.manual && (
          <span className="ml-2 font-telemetry text-[10px] tracking-widest"
            style={{ color: '#fbbf24' }}>· MANUALLY ASSIGNED</span>
        )}
      </p>

      {/* ── Stat row ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 pb-3 mb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <TipStat label="BOOKED" value={`${totalCommittedDays}d`} />
        <TipStat label="PROJECTS" value={allProds.length} />
        {state.activeProds.length > 0 && (
          <TipStat label={scrubMode === 'day' ? 'NOW' : 'IN WINDOW'} value={state.activeProds.length} />
        )}
      </div>

      {/* ── Mini-Gantt: shows where every commitment falls ─────── */}
      <MiniGantt
        resourceId={resourceId}
        scrubStartDay={scrubStartDay}
        scrubEndDay={scrubEndDay}
        scrubMode={scrubMode}
      />

      {/* ── Peers — who else is on the active production(s) ───── */}
      <PeersSection
        resourceId={resourceId}
        activeProds={state.activeProds}
      />

      {/* ── EXPANDED-ONLY SECTIONS ─────────────────────────────── */}
      {expanded && (
        <>
          <SectionDivider />
          <AssignmentsDetail
            resourceId={resourceId}
            activeProds={state.activeProds}
            scrubStart={scrubStart}
            scrubEnd={scrubEnd}
          />
          {state.mode === 'conflict' && (
            <>
              <SectionDivider />
              <ConflictsBreakdown resourceId={resourceId} />
            </>
          )}
          <SectionDivider />
          <UtilizationBar
            resourceId={resourceId}
            scrubStartDay={scrubStartDay}
            scrubEndDay={scrubEndDay}
          />
          <SectionDivider />
          <SkillsOrSpecs resource={r} />
        </>
      )}

      {/* ── Hint footer ────────────────────────────────────────── */}
      {!expanded && (
        <div className="mt-3 pt-2 flex items-center justify-end"
          style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
          <span className="font-telemetry text-[9px] text-orbital-dim tracking-[0.2em]">
            CLICK ICON TO EXPAND ▸
          </span>
        </div>
      )}

      {/* ── Close button (expanded only) ───────────────────────── */}
      {expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose?.() }}
          className="absolute top-3 right-3 inline-flex items-center justify-center transition-colors"
          style={{
            width: 22, height: 22,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--orbital-subtle)',
          }}
          title="Close (or click on empty space)"
        >
          <span className="text-[12px] leading-none">×</span>
        </button>
      )}
    </div>
  )
}

function SectionDivider() {
  return (
    <div className="my-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }} />
  )
}

// Detailed list of every commitment with date range, day count, location.
// At-scrubber status is annotated as ACTIVE / UPCOMING / WRAPPED.
function AssignmentsDetail({ resourceId, activeProds, scrubStart, scrubEnd }) {
  const myCommitments = COMMITMENTS
    .filter(c => c.resourceId === resourceId)
    .sort((a, b) => a.start - b.start)
  if (myCommitments.length === 0) return null

  return (
    <div>
      <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
        ASSIGNMENT DETAIL
      </p>
      <div className="space-y-2.5">
        {myCommitments.map((c, i) => {
          const prod = PRODUCTIONS.find(p => p.id === c.productionId)
          if (!prod) return null
          const days = Math.round((c.end - c.start) / 86400000) + 1
          const isActive = activeProds.includes(prod.id)
          const isPast = c.end < scrubStart
          const isFuture = c.start > scrubEnd
          const status = isActive ? 'ACTIVE' : isPast ? 'WRAPPED' : isFuture ? 'UPCOMING' : 'PARTIAL'
          const statusColor = isActive ? '#34d399' : isPast ? '#71717a' : isFuture ? '#60a5fa' : '#fbbf24'
          const location = PRODUCTION_LOCATION[prod.id]
          return (
            <div key={i} className="flex items-start gap-3"
              style={{ paddingLeft: 8, borderLeft: `2px solid ${prod.color}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-telemetry text-[10px] tracking-[0.18em]"
                    style={{ color: prod.color }}>
                    {prod.code}
                  </span>
                  <span className="text-[12px] font-medium text-orbital-text">
                    {prod.name}
                  </span>
                  <span className="ml-auto font-telemetry text-[9px] tracking-widest"
                    style={{ color: statusColor }}>
                    {status}
                  </span>
                </div>
                <div className="font-telemetry text-[10px] text-orbital-subtle tracking-wider mt-0.5">
                  {format(c.start, 'MMM d').toUpperCase()} → {format(c.end, 'MMM d').toUpperCase()} · {days}d
                  {location && <span className="ml-2">· {shortLocationLabel(location)}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Breakdown of every overlap pair for a TORN resource — which two productions
// contest them, the exact overlap window, and the duration.
function ConflictsBreakdown({ resourceId }) {
  const myCommitments = COMMITMENTS.filter(c => c.resourceId === resourceId)
  const overlaps = []
  for (let i = 0; i < myCommitments.length; i++) {
    for (let j = i + 1; j < myCommitments.length; j++) {
      const a = myCommitments[i], b = myCommitments[j]
      if (a.productionId === b.productionId) continue
      if (a.start <= b.end && b.start <= a.end) {
        const overlapStart = a.start > b.start ? a.start : b.start
        const overlapEnd = a.end < b.end ? a.end : b.end
        const days = Math.round((overlapEnd - overlapStart) / 86400000) + 1
        overlaps.push({ a, b, overlapStart, overlapEnd, days })
      }
    }
  }
  if (overlaps.length === 0) return null

  return (
    <div>
      <p className="font-telemetry text-[10px] tracking-[0.22em] mb-2"
        style={{ color: '#fca5a5' }}>
        ⚠ CONFLICTS · {overlaps.length} OVERLAP{overlaps.length > 1 ? 'S' : ''}
      </p>
      <div className="space-y-2">
        {overlaps.map((o, i) => {
          const pa = PRODUCTIONS.find(p => p.id === o.a.productionId)
          const pb = PRODUCTIONS.find(p => p.id === o.b.productionId)
          if (!pa || !pb) return null
          return (
            <div key={i} className="px-2.5 py-2"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5"
                  style={{ background: pa.color, boxShadow: `0 0 4px ${pa.glow}` }} />
                <span className="font-telemetry text-[10px] tracking-[0.18em]" style={{ color: pa.color }}>
                  {pa.code}
                </span>
                <span className="font-telemetry text-[10px] text-orbital-subtle">━━</span>
                <span className="w-1.5 h-1.5"
                  style={{ background: pb.color, boxShadow: `0 0 4px ${pb.glow}` }} />
                <span className="font-telemetry text-[10px] tracking-[0.18em]" style={{ color: pb.color }}>
                  {pb.code}
                </span>
              </div>
              <p className="font-telemetry text-[10px] text-orbital-text tracking-wider">
                {format(o.overlapStart, 'MMM d').toUpperCase()} — {format(o.overlapEnd, 'MMM d').toUpperCase()} ·
                <span className="ml-1.5" style={{ color: '#fca5a5' }}>{o.days} DAY OVERLAP</span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Visual utilization bar — what % of the current scrubber window this
// resource is committed for, with overcommitment shown as a red overflow.
function UtilizationBar({ resourceId, scrubStartDay, scrubEndDay }) {
  // For each day in the window, count active commitments
  const span = Math.max(1, scrubEndDay - scrubStartDay)
  let totalCommittedDays = 0
  let overlappingDays = 0
  for (let day = scrubStartDay; day <= scrubEndDay; day++) {
    const date = dateAtDayIndex(day)
    const active = COMMITMENTS.filter(c =>
      c.resourceId === resourceId && c.start <= date && date <= c.end
    ).length
    if (active >= 1) totalCommittedDays++
    if (active >= 2) overlappingDays++
  }
  const utilPct = Math.min(100, Math.round((totalCommittedDays / (span + 1)) * 100))
  const overlapPct = Math.round((overlappingDays / (span + 1)) * 100)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em]">
          UTILIZATION · IN WINDOW
        </p>
        <span className="font-telemetry text-[12px] text-orbital-text tracking-wider">
          {utilPct}%
        </span>
      </div>
      <div className="relative" style={{ height: 10, background: 'rgba(255,255,255,0.05)' }}>
        <div className="absolute top-0 bottom-0 left-0"
          style={{
            width: `${utilPct}%`,
            background: utilPct > 80
              ? 'linear-gradient(90deg, rgba(34,197,94,0.7), rgba(251,191,36,0.7))'
              : 'linear-gradient(90deg, rgba(96,165,250,0.55), rgba(34,197,94,0.65))',
            transition: 'width 350ms ease-out',
          }} />
        {overlapPct > 0 && (
          <div className="absolute top-0 bottom-0 left-0"
            style={{
              width: `${overlapPct}%`,
              background: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.4), rgba(239,68,68,0.4) 4px, rgba(239,68,68,0.7) 4px, rgba(239,68,68,0.7) 8px)',
              boxShadow: '0 0 8px rgba(239,68,68,0.5)',
            }} />
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5 font-telemetry text-[9px] text-orbital-subtle tracking-wider">
        <span>{totalCommittedDays} / {span + 1} DAYS BOOKED</span>
        {overlapPct > 0 && (
          <span style={{ color: '#fca5a5' }}>{overlappingDays} DAYS OVERLAP</span>
        )}
      </div>
    </div>
  )
}

// Skills (people) or specs (gear)
function SkillsOrSpecs({ resource }) {
  if (resource.kind === 'people') {
    const skills = ROLE_SKILLS[resource.role] ?? []
    if (skills.length === 0) return null
    return (
      <div>
        <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
          SKILLS
        </p>
        <div className="flex flex-wrap gap-1.5">
          {skills.map(s => (
            <span key={s}
              className="inline-flex items-center px-2 py-0.5 font-telemetry text-[10px] tracking-[0.12em]"
              style={{
                background: `${resource.color}1a`,
                border: `1px solid ${resource.color}55`,
                color: resource.color,
              }}>
              {s}
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (resource.kind === 'gear') {
    const details = GEAR_DETAILS[resource.id]
    return (
      <div>
        <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
          SPECS
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <SpecRow label="MODEL" value={resource.role} />
          {details && Object.entries(details).map(([k, v]) => (
            <SpecRow key={k} label={k.toUpperCase()} value={v} />
          ))}
        </div>
      </div>
    )
  }
  return null
}

function SpecRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.18em]">{label}</span>
      <span className="font-telemetry text-[11px] text-orbital-text tracking-wider truncate">{value}</span>
    </div>
  )
}

function ModeBadge({ accent, bg, border, color, children }) {
  return (
    <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      <span className="font-telemetry text-[10px] tracking-[0.18em]">{children}</span>
    </span>
  )
}

function TipStat({ label, value, color }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.2em]">{label}</span>
      <span className="font-telemetry text-[15px] tracking-wider"
        style={{ color: color ?? 'var(--orbital-text)' }}>{value}</span>
    </div>
  )
}

// Mini horizontal Gantt — one row per production this resource touches,
// commitment rendered as a colored bar inside the 6-week window track.
function MiniGantt({ resourceId, scrubStartDay, scrubEndDay, scrubMode }) {
  const myCommitments = COMMITMENTS.filter(c => c.resourceId === resourceId)
  const productions = [...new Set(myCommitments.map(c => c.productionId))]
    .map(id => PRODUCTIONS.find(p => p.id === id))
    .filter(Boolean)
  if (productions.length === 0) return null

  const W = 420
  const H_ROW = 22
  const total = WINDOW_DAYS

  return (
    <div className="mb-3">
      <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
        SCHEDULE · 6 WEEK WINDOW
      </p>
      <svg width={W} height={productions.length * H_ROW + 14} className="block overflow-visible">
        {/* Window highlight in the background */}
        <rect
          x={(scrubStartDay / total) * W}
          y={0}
          width={Math.max(3, ((scrubEndDay - scrubStartDay + (scrubMode === 'day' ? 0 : 0)) / total) * W)}
          height={productions.length * H_ROW}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={0.7}
          strokeDasharray="3 3"
        />
        {productions.map((p, i) => {
          const c = myCommitments.find(x => x.productionId === p.id)
          if (!c) return null
          const startPx = (dayIndex(c.start) / total) * W
          const endPx = ((dayIndex(c.end) + 1) / total) * W
          return (
            <g key={p.id} transform={`translate(0, ${i * H_ROW})`}>
              {/* track */}
              <rect x={0} y={9} width={W} height={3} fill="rgba(255,255,255,0.05)" />
              {/* commitment bar */}
              <rect x={startPx} y={5} width={Math.max(3, endPx - startPx)} height={11}
                fill={p.color} opacity={0.85}
                style={{ filter: `drop-shadow(0 0 5px ${p.glow})` }} />
              {/* code label inside bar */}
              <text x={startPx + 5} y={14}
                fontFamily="'Space Mono', monospace"
                fontSize={9.5}
                letterSpacing={1}
                fill="rgba(0,0,0,0.78)"
                fontWeight={700}>
                {p.code}
              </text>
              {/* day count to the right of the bar */}
              <text x={endPx + 6} y={14}
                fontFamily="'Space Mono', monospace"
                fontSize={9}
                fill="rgba(255,255,255,0.45)"
                letterSpacing={0.8}>
                {Math.round((c.end - c.start) / 86400000) + 1}d
              </text>
            </g>
          )
        })}
        {/* Week tick marks below */}
        {Array.from({ length: 7 }, (_, i) => i).map(i => (
          <line key={i}
            x1={(i / 6) * W} y1={productions.length * H_ROW}
            x2={(i / 6) * W} y2={productions.length * H_ROW + 5}
            stroke="rgba(255,255,255,0.25)" strokeWidth={0.7} />
        ))}
      </svg>
      <div className="flex justify-between font-telemetry text-[9px] text-orbital-dim tracking-wider mt-1">
        <span>{format(dateAtDayIndex(0), 'MMM d').toUpperCase()}</span>
        <span>{format(dateAtDayIndex(WINDOW_DAYS), 'MMM d').toUpperCase()}</span>
      </div>
    </div>
  )
}

// Peers — other resources on the same active production(s)
function PeersSection({ resourceId, activeProds }) {
  if (activeProds.length === 0) return null
  const blocks = activeProds.map(prodId => {
    const prod = PRODUCTIONS.find(p => p.id === prodId)
    if (!prod) return null
    const peers = RESOURCES.filter(r =>
      r.id !== resourceId &&
      (r.kind === 'people' || r.kind === 'gear') &&
      COMMITMENTS.some(c => c.resourceId === r.id && c.productionId === prodId)
    )
    return { prod, peers }
  }).filter(Boolean)
  if (!blocks.some(b => b.peers.length > 0)) return null

  return (
    <div>
      <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
        ALONGSIDE
      </p>
      <div className="space-y-2">
        {blocks.map(({ prod, peers }) => (
          <div key={prod.id} className="flex items-start gap-2.5">
            <div className="flex items-center gap-1.5 min-w-[88px] flex-shrink-0">
              <span className="w-2 h-2 flex-shrink-0"
                style={{ background: prod.color, boxShadow: `0 0 5px ${prod.glow}` }} />
              <span className="font-telemetry text-[10px] tracking-[0.15em]"
                style={{ color: prod.color }}>
                {prod.code}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {peers.length === 0 ? (
                <span className="font-telemetry text-[10px] text-orbital-dim tracking-widest">SOLO</span>
              ) : peers.map(peer => (
                <span key={peer.id}
                  className="inline-flex items-center justify-center font-telemetry font-bold"
                  style={{
                    width: 24, height: 20,
                    fontSize: peer.kind === 'gear' ? 9 : 11,
                    background: peer.color,
                    color: '#0a0c10',
                    boxShadow: `0 0 5px ${peer.color}88`,
                    clipPath: peer.kind === 'gear'
                      ? 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'
                      : undefined,
                    borderRadius: peer.kind === 'people' ? '50%' : 0,
                  }}
                  title={peer.name}>
                  {peer.initial}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Production card — shown when a planet is selected
// ══════════════════════════════════════════════════════════════════════════
function ProductionCard({ planetId, orbiterStates, scrubStart, scrubEnd, scrubStartDay, scrubEndDay, scrubMode, onClose }) {
  if (planetId === 'home') {
    return (
      <HomeBaseCard
        orbiterStates={orbiterStates}
        scrubStart={scrubStart}
        scrubEnd={scrubEnd}
        scrubStartDay={scrubStartDay}
        scrubEndDay={scrubEndDay}
        scrubMode={scrubMode}
        onClose={onClose}
      />
    )
  }
  const production = PRODUCTIONS.find(p => p.id === planetId)
  if (!production) return null

  // Status: ACTIVE / UPCOMING / WRAPPED relative to scrub time
  const isActive = production.start <= scrubEnd && scrubStart <= production.end
  const isPast   = production.end < scrubStart
  const status = isActive ? 'ACTIVE' : isPast ? 'WRAPPED' : 'UPCOMING'
  const statusColor = isActive ? '#34d399' : isPast ? '#71717a' : '#60a5fa'

  // Roster on this production
  const committedIds = new Set(
    COMMITMENTS.filter(c => c.productionId === production.id).map(c => c.resourceId)
  )
  const people   = RESOURCES.filter(r => r.kind === 'people'   && committedIds.has(r.id))
  const gear     = RESOURCES.filter(r => r.kind === 'gear'     && committedIds.has(r.id))
  const location = PRODUCTION_LOCATION[production.id]

  // Total person/gear days
  const totalPersonDays = COMMITMENTS
    .filter(c => c.productionId === production.id)
    .filter(c => RESOURCES.find(r => r.id === c.resourceId)?.kind === 'people')
    .reduce((s, c) => s + (Math.round((c.end - c.start) / 86400000) + 1), 0)

  // Conflicts ON this production: any of its committed resources who are TORN
  // because they have an overlapping commitment to another production.
  const productionConflicts = []
  for (const c of COMMITMENTS.filter(c => c.productionId === production.id)) {
    const overlapping = COMMITMENTS.filter(other =>
      other.resourceId === c.resourceId &&
      other.productionId !== production.id &&
      other.start <= c.end && c.start <= other.end
    )
    if (overlapping.length > 0) {
      productionConflicts.push({ commitment: c, overlapping })
    }
  }

  // Derive a "right now" headcount at scrub time
  const nowCount = orbiterStates.filter(s => s.activeProds.includes(production.id)).length

  const duration = Math.round((production.end - production.start) / 86400000) + 1

  return (
    <div
      className=""
      style={{
        position: 'absolute',
        left: 16, bottom: 56,
        padding: '22px 26px 24px',
        minWidth: 580,
        maxWidth: 640,
        maxHeight: 'min(620px, calc(100% - 80px))',
        overflowY: 'auto',
        background: 'rgba(11,13,18,0.96)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${production.color}55`,
        boxShadow: `0 12px 48px rgba(0,0,0,0.65), 0 0 24px ${production.glow}, 0 0 0 1px rgba(255,255,255,0.03) inset`,
      }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="w-2.5 h-2.5"
          style={{ background: production.color, boxShadow: `0 0 8px ${production.glow}` }} />
        <span className="font-telemetry text-[11px] tracking-[0.22em]"
          style={{ color: production.color, textShadow: `0 0 6px ${production.glow}` }}>
          {production.code}
        </span>
        <span className="text-[18px] font-semibold text-orbital-text tracking-tight">
          {production.name}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1"
          style={{
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}66`,
            color: statusColor,
          }}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusColor, boxShadow: `0 0 5px ${statusColor}` }} />
          <span className="font-telemetry text-[10px] tracking-[0.18em]">{status}</span>
        </span>
      </div>

      {/* ── Subhead — dates + summary ────────────────────────── */}
      <p className="font-telemetry text-[11px] text-orbital-subtle tracking-wider mb-1">
        {format(production.start, 'MMM d').toUpperCase()} → {format(production.end, 'MMM d, yyyy').toUpperCase()}
        <span className="ml-2 text-orbital-dim">· {duration} DAYS</span>
      </p>
      <p className="text-[13px] text-orbital-subtle leading-snug mb-3">
        {production.summary}
        {location && (
          <span className="ml-2 font-telemetry text-[10px] text-orbital-dim tracking-widest">
            · ◈ {shortLocationLabel(location)}
          </span>
        )}
      </p>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="flex items-center gap-6 pb-3 mb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <TipStat label="PEOPLE"  value={people.length} />
        <TipStat label="GEAR"    value={gear.length} />
        <TipStat label={scrubMode === 'day' ? 'NOW' : 'IN WINDOW'} value={nowCount} />
        <TipStat label="P-DAYS"  value={totalPersonDays} />
        <TipStat label="CONFLICTS"
          value={productionConflicts.length}
          color={productionConflicts.length > 0 ? '#fca5a5' : undefined} />
      </div>

      {/* ── Mini-Gantt — show this production's range against the window ─ */}
      <ProductionTimelineStrip production={production}
        scrubStartDay={scrubStartDay} scrubEndDay={scrubEndDay} scrubMode={scrubMode} />

      <SectionDivider />

      {/* ── Roster ───────────────────────────────────────── */}
      <RosterSection title="PEOPLE" resources={people} active={nowCount > 0
        ? new Set(orbiterStates.filter(s => s.activeProds.includes(production.id) && s.resource.kind === 'people').map(s => s.resource.id))
        : new Set()} />

      <SectionDivider />

      <RosterSection title="GEAR" resources={gear} active={
        new Set(orbiterStates.filter(s => s.activeProds.includes(production.id) && s.resource.kind === 'gear').map(s => s.resource.id))
      } />

      {/* ── Conflicts on this production ─────────────────── */}
      {productionConflicts.length > 0 && (
        <>
          <SectionDivider />
          <ProductionConflictsBlock production={production} conflicts={productionConflicts} />
        </>
      )}

      {/* ── Close button ─────────────────────────────────── */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose?.() }}
        className="absolute top-3 right-3 inline-flex items-center justify-center transition-colors"
        style={{
          width: 22, height: 22,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--orbital-subtle)',
        }}
        title="Close"
      >
        <span className="text-[12px] leading-none">×</span>
      </button>
    </div>
  )
}

function ProductionTimelineStrip({ production, scrubStartDay, scrubEndDay, scrubMode }) {
  const W = 530
  const H = 22
  const total = WINDOW_DAYS
  const startPx = (dayIndex(production.start) / total) * W
  const endPx   = ((dayIndex(production.end) + 1) / total) * W
  return (
    <div className="mb-1">
      <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
        TIMELINE · 6 WEEK WINDOW
      </p>
      <svg width={W} height={H + 14} className="block overflow-visible">
        {/* Track */}
        <rect x={0} y={H/2 - 1} width={W} height={2} fill="rgba(255,255,255,0.05)" />
        {/* Production bar */}
        <rect x={startPx} y={H/2 - 6} width={Math.max(3, endPx - startPx)} height={12}
          fill={production.color} opacity={0.85}
          style={{ filter: `drop-shadow(0 0 6px ${production.glow})` }} />
        <text x={startPx + 5} y={H/2 + 3.5}
          fontFamily="'Space Mono', monospace"
          fontSize={9.5}
          letterSpacing={1}
          fill="rgba(0,0,0,0.78)"
          fontWeight={700}>
          {production.code}
        </text>
        {/* Scrubber position: a window box in range mode, a playhead line in day mode */}
        {scrubMode === 'day' ? (
          <line
            x1={(scrubStartDay / total) * W} y1={-2}
            x2={(scrubStartDay / total) * W} y2={H + 2}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1.2}
            strokeDasharray="2 2"
          />
        ) : (
          <rect
            x={(scrubStartDay / total) * W}
            y={0}
            width={Math.max(3, ((scrubEndDay - scrubStartDay) / total) * W)}
            height={H}
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={0.7}
            strokeDasharray="3 3"
          />
        )}
        {/* Week tick marks */}
        {Array.from({ length: 7 }, (_, i) => i).map(i => (
          <line key={i}
            x1={(i / 6) * W} y1={H}
            x2={(i / 6) * W} y2={H + 5}
            stroke="rgba(255,255,255,0.25)" strokeWidth={0.7} />
        ))}
      </svg>
      <div className="flex justify-between font-telemetry text-[9px] text-orbital-dim tracking-wider mt-1">
        <span>{format(dateAtDayIndex(0), 'MMM d').toUpperCase()}</span>
        <span>{format(dateAtDayIndex(WINDOW_DAYS), 'MMM d').toUpperCase()}</span>
      </div>
    </div>
  )
}

// Roster grid: avatar chips for everyone committed, with a glow on those
// currently active at the playhead.
function RosterSection({ title, resources, active }) {
  if (resources.length === 0) {
    return (
      <div>
        <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
          {title}
        </p>
        <p className="font-telemetry text-[10px] text-orbital-dim tracking-widest">— NONE —</p>
      </div>
    )
  }
  return (
    <div>
      <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
        {title} · {resources.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {resources.map(r => {
          const isActiveNow = active.has(r.id)
          return (
            <div key={r.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1"
              style={{
                background: isActiveNow ? `${r.color}1c` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActiveNow ? r.color + '77' : 'rgba(255,255,255,0.08)'}`,
                opacity: isActiveNow ? 1 : 0.65,
                boxShadow: isActiveNow ? `0 0 8px ${r.color}55` : 'none',
              }}>
              <span className="inline-flex items-center justify-center font-telemetry font-bold"
                style={{
                  width: 18, height: 16,
                  fontSize: r.kind === 'gear' ? 8 : 10,
                  background: r.color,
                  color: '#0a0c10',
                  clipPath: r.kind === 'gear'
                    ? 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'
                    : undefined,
                  borderRadius: r.kind === 'people' ? '50%' : 0,
                }}>
                {r.initial}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] text-orbital-text">{r.name}</span>
                <span className="font-telemetry text-[8px] text-orbital-dim tracking-widest">{r.role}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProductionConflictsBlock({ production, conflicts }) {
  return (
    <div>
      <p className="font-telemetry text-[10px] tracking-[0.22em] mb-2"
        style={{ color: '#fca5a5' }}>
        ⚠ CONTESTED RESOURCES · {conflicts.length}
      </p>
      <div className="space-y-2">
        {conflicts.map((c, i) => {
          const r = RESOURCES.find(x => x.id === c.commitment.resourceId)
          return (
            <div key={i} className="px-2.5 py-2"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center font-telemetry font-bold"
                  style={{
                    width: 16, height: 14,
                    fontSize: r.kind === 'gear' ? 8 : 9.5,
                    background: r?.color, color: '#0a0c10',
                    clipPath: r?.kind === 'gear'
                      ? 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'
                      : undefined,
                    borderRadius: r?.kind === 'people' ? '50%' : 0,
                  }}>
                  {r?.initial}
                </span>
                <span className="text-[11px] font-medium text-orbital-text">{r?.name}</span>
                <span className="font-telemetry text-[9px] text-orbital-dim tracking-widest">
                  {r?.role}
                </span>
              </div>
              <p className="font-telemetry text-[10px] text-orbital-subtle tracking-wider">
                Also booked on{' '}
                {c.overlapping.map((o, oi) => {
                  const op = PRODUCTIONS.find(x => x.id === o.productionId)
                  return (
                    <span key={oi}>
                      <span style={{ color: op?.color }}>{op?.code}</span>
                      {oi < c.overlapping.length - 1 ? ', ' : ''}
                    </span>
                  )
                })}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Home base card — shown when the home planet is selected
// ══════════════════════════════════════════════════════════════════════════
function HomeBaseCard({ orbiterStates, scrubStart, scrubEnd, scrubStartDay, scrubEndDay, scrubMode, onClose }) {
  const onStation     = orbiterStates.filter(s => s.mode === 'home' && s.resource.kind === 'people')
  const inStorage     = orbiterStates.filter(s => s.mode === 'home' && s.resource.kind === 'gear')
  const peopleDeployed = orbiterStates.filter(s => s.mode !== 'home' && s.resource.kind === 'people').length
  const gearDeployed   = orbiterStates.filter(s => s.mode !== 'home' && s.resource.kind === 'gear').length
  // Productions hosted in-house (location = Orbital Studio)
  const inHouseProds = PRODUCTIONS.filter(p => PRODUCTION_LOCATION[p.id]?.id === 'l1')

  return (
    <div
      style={{
        position: 'absolute',
        left: 16, bottom: 56,
        padding: '22px 26px 24px',
        minWidth: 580,
        maxWidth: 640,
        maxHeight: 'min(620px, calc(100% - 80px))',
        overflowY: 'auto',
        background: 'rgba(11,13,18,0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(126,193,224,0.4)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.65), 0 0 24px rgba(126,193,224,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset',
      }}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="w-2.5 h-2.5"
          style={{ background: '#7ec1e0', boxShadow: '0 0 8px rgba(126,193,224,0.7)' }} />
        <span className="font-telemetry text-[11px] tracking-[0.22em]"
          style={{ color: '#7ec1e0', textShadow: '0 0 6px rgba(126,193,224,0.6)' }}>
          HOME · IN-HOUSE
        </span>
        <span className="text-[18px] font-semibold text-orbital-text tracking-tight">
          Orbital Studio
        </span>
      </div>
      <p className="text-[13px] text-orbital-subtle leading-snug mb-3">
        Home base · LA virtual production stage · {inHouseProds.length} production{inHouseProds.length === 1 ? '' : 's'} hosted in-house
      </p>

      <div className="flex items-center gap-6 pb-3 mb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <TipStat label="ON STATION"  value={onStation.length} />
        <TipStat label="IN STORAGE"  value={inStorage.length} />
        <TipStat label="DEPLOYED" value={peopleDeployed + gearDeployed} />
        <TipStat label="HOSTING"  value={inHouseProds.length} />
      </div>

      <RosterSection title="PEOPLE ON STATION" resources={onStation.map(s => s.resource)} active={new Set()} />
      <SectionDivider />
      <RosterSection title="GEAR IN STORAGE" resources={inStorage.map(s => s.resource)} active={new Set()} />

      {inHouseProds.length > 0 && (
        <>
          <SectionDivider />
          <div>
            <p className="font-telemetry text-[10px] text-orbital-subtle tracking-[0.22em] mb-2">
              IN-HOUSE PRODUCTIONS · {inHouseProds.length}
            </p>
            <div className="space-y-2">
              {inHouseProds.map(p => {
                const isActive = p.start <= scrubEnd && scrubStart <= p.end
                return (
                  <div key={p.id} className="flex items-center gap-2"
                    style={{ paddingLeft: 8, borderLeft: `2px solid ${p.color}` }}>
                    <span className="font-telemetry text-[10px] tracking-[0.18em]" style={{ color: p.color }}>
                      {p.code}
                    </span>
                    <span className="text-[12px] font-medium text-orbital-text">{p.name}</span>
                    <span className="ml-auto font-telemetry text-[9px] tracking-widest"
                      style={{ color: isActive ? '#34d399' : 'var(--orbital-subtle)' }}>
                      {isActive ? 'ACTIVE' : `${format(p.start, 'MMM d').toUpperCase()} → ${format(p.end, 'MMM d').toUpperCase()}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClose?.() }}
        className="absolute top-3 right-3 inline-flex items-center justify-center transition-colors"
        style={{
          width: 22, height: 22,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--orbital-subtle)',
        }}
        title="Close"
      >
        <span className="text-[12px] leading-none">×</span>
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Stats overlay
// ══════════════════════════════════════════════════════════════════════════
function SceneStats({ orbiterStates, conflictPairs }) {
  const peopleCount = orbiterStates.filter(s => s.resource.kind === 'people').length
  const gearCount   = orbiterStates.filter(s => s.resource.kind === 'gear').length
  const home  = orbiterStates.filter(s => s.mode === 'home').length
  const orbit = orbiterStates.filter(s => s.mode === 'orbit').length
  const torn  = orbiterStates.filter(s => s.mode === 'conflict').length
  return (
    <div className="absolute bottom-3 right-3"
      style={{
        padding: '6px 10px',
        background: 'rgba(15,17,22,0.85)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
      <div className="flex items-center gap-3">
        <Stat label="PPL"   value={peopleCount} />
        <Stat label="GEAR"  value={gearCount} />
        <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <Stat label="HOME"  value={home} />
        <Stat label="ORBIT" value={orbit} />
        <Stat label="TORN"  value={torn} color={torn > 0 ? '#ef4444' : undefined} />
        <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <Stat label="LINKS" value={conflictPairs.length} />
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-telemetry text-[8px] text-orbital-subtle tracking-[0.18em]">{label}</span>
      <span className="font-telemetry text-[11px] tracking-wider"
        style={{ color: color ?? '#d0d1d5' }}>{value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Time scrubber
// ══════════════════════════════════════════════════════════════════════════
const MIN_RANGE_SPAN = 1

function TimeScrubber({ mode, setMode, day, setDay, range, setRange }) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)        // 'day' | 'start' | 'end' | 'span' | null
  const spanDragOrigin = useRef(null) // { startX, startWindow } for span drag

  const dayFromX = useCallback((cx) => {
    const box = trackRef.current.getBoundingClientRect()
    const x = cx - box.left
    const ratio = Math.max(0, Math.min(1, x / box.width))
    return Math.round(ratio * WINDOW_DAYS)
  }, [])

  // ── Day mode handlers ────────────────────────────────────────────────
  const onDayDown = (e) => {
    if (mode !== 'day') return
    dragRef.current = 'day'
    const cx = e.clientX ?? e.touches?.[0]?.clientX
    setDay(dayFromX(cx))
  }

  // ── Range mode handlers ──────────────────────────────────────────────
  const onHandleDown = (which) => (e) => {
    e.stopPropagation()
    dragRef.current = which
  }

  const onSpanDown = (e) => {
    e.stopPropagation()
    dragRef.current = 'span'
    const cx = e.clientX ?? e.touches?.[0]?.clientX
    spanDragOrigin.current = { startX: cx, startWindow: { ...range } }
  }

  // Click on empty track in range mode jumps the nearest handle
  const onRangeTrackDown = (e) => {
    if (mode !== 'range') return
    const cx = e.clientX ?? e.touches?.[0]?.clientX
    const d = dayFromX(cx)
    if (Math.abs(d - range.start) < Math.abs(d - range.end)) {
      const next = Math.min(d, range.end - MIN_RANGE_SPAN)
      setRange({ start: Math.max(0, next), end: range.end })
      dragRef.current = 'start'
    } else {
      const next = Math.max(d, range.start + MIN_RANGE_SPAN)
      setRange({ start: range.start, end: Math.min(WINDOW_DAYS, next) })
      dragRef.current = 'end'
    }
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return
      const cx = e.clientX ?? e.touches?.[0]?.clientX
      if (dragRef.current === 'day') {
        setDay(dayFromX(cx))
      } else if (dragRef.current === 'start') {
        const d = Math.min(dayFromX(cx), range.end - MIN_RANGE_SPAN)
        setRange({ start: Math.max(0, d), end: range.end })
      } else if (dragRef.current === 'end') {
        const d = Math.max(dayFromX(cx), range.start + MIN_RANGE_SPAN)
        setRange({ start: range.start, end: Math.min(WINDOW_DAYS, d) })
      } else if (dragRef.current === 'span' && spanDragOrigin.current) {
        const trackWidth = trackRef.current.getBoundingClientRect().width
        const dx = cx - spanDragOrigin.current.startX
        const ddays = Math.round((dx / trackWidth) * WINDOW_DAYS)
        const w0 = spanDragOrigin.current.startWindow
        const length = w0.end - w0.start
        let start = Math.max(0, Math.min(WINDOW_DAYS - length, w0.start + ddays))
        setRange({ start, end: start + length })
      }
    }
    const onUp = () => {
      dragRef.current = null
      spanDragOrigin.current = null
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
  }, [dayFromX, setDay, setRange, range.start, range.end])

  const weeks = Array.from({ length: 7 }, (_, i) => i)
  const dayPct   = (day / WINDOW_DAYS) * 100
  const startPct = (range.start / WINDOW_DAYS) * 100
  const endPct   = (range.end / WINDOW_DAYS) * 100

  return (
    <div className="px-6 pt-4 pb-5"
      style={{ borderTop: '1px solid var(--orbital-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="hud-label">TIMELINE</span>
          {/* DAY / RANGE toggle */}
          <div className="inline-flex"
            style={{
              border: '1px solid var(--orbital-border)',
              background: 'var(--orbital-muted)',
            }}>
            <button onClick={() => setMode('day')}
              className="px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] transition-all"
              style={{
                background: mode === 'day' ? 'rgba(59,130,246,0.18)' : 'transparent',
                color: mode === 'day' ? '#60a5fa' : 'var(--orbital-subtle)',
                boxShadow: mode === 'day' ? 'inset 0 0 8px rgba(59,130,246,0.25)' : 'none',
              }}>
              DAY
            </button>
            <button onClick={() => setMode('range')}
              className="px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] transition-all"
              style={{
                background: mode === 'range' ? 'rgba(232,121,249,0.18)' : 'transparent',
                color: mode === 'range' ? '#e879f9' : 'var(--orbital-subtle)',
                boxShadow: mode === 'range' ? 'inset 0 0 8px rgba(232,121,249,0.25)' : 'none',
              }}>
              RANGE
            </button>
          </div>
        </div>
        <span className="font-telemetry text-[10px] text-orbital-subtle tracking-wider">
          {mode === 'day'
            ? `DAY ${String(day).padStart(2, '0')} / ${WINDOW_DAYS}`
            : `${range.end - range.start} DAYS · ${String(range.start).padStart(2, '0')}–${String(range.end).padStart(2, '0')}`}
        </span>
      </div>

      <div
        ref={trackRef}
        onMouseDown={mode === 'day' ? onDayDown : onRangeTrackDown}
        onTouchStart={mode === 'day' ? onDayDown : onRangeTrackDown}
        className="relative cursor-pointer select-none"
        style={{ height: 36 }}
      >
        {/* Base track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={{ height: 2, background: 'var(--orbital-border)' }} />

        {/* Week tick marks */}
        {weeks.map(i => (
          <div key={i}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${(i / 6) * 100}%`,
              width: 1, height: 8, background: 'var(--orbital-chrome)',
            }} />
        ))}

        {/* Date labels */}
        {weeks.map(i => (
          <span key={i}
            className="absolute -bottom-1 -translate-x-1/2 font-telemetry text-[9px] text-orbital-subtle tracking-wider"
            style={{ left: `${(i / 6) * 100}%` }}>
            {format(dateAtDayIndex(i * 7), 'MMM d')}
          </span>
        ))}

        {mode === 'day' ? (
          <>
            {/* Filled portion 0 → playhead */}
            <div className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: 0, width: `${dayPct}%`, height: 2,
                background: 'linear-gradient(90deg, rgba(59,130,246,0.6), rgba(232,121,249,0.6))',
                boxShadow: '0 0 10px rgba(59,130,246,0.7)',
                transition: dragRef.current === 'day' ? 'none' : 'width 200ms ease-out',
              }} />
            {/* Playhead handle */}
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${dayPct}%`,
                width: 14, height: 18,
                background: '#fff',
                boxShadow: '0 0 14px rgba(255,255,255,0.7), 0 0 0 1px rgba(59,130,246,0.5) inset',
                transition: dragRef.current === 'day' ? 'none' : 'left 200ms ease-out',
              }} />
          </>
        ) : (
          <>
            {/* Filled span between handles — also a drag handle for the whole window */}
            <div
              onMouseDown={onSpanDown}
              onTouchStart={onSpanDown}
              className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
              style={{
                left: `${startPct}%`,
                width: `${endPct - startPct}%`,
                height: 6,
                background: 'linear-gradient(90deg, rgba(59,130,246,0.55), rgba(232,121,249,0.55))',
                boxShadow: '0 0 12px rgba(155,130,240,0.5), inset 0 0 0 1px rgba(255,255,255,0.12)',
              }} />
            {/* Start handle */}
            <div
              onMouseDown={onHandleDown('start')}
              onTouchStart={onHandleDown('start')}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
              style={{
                left: `${startPct}%`,
                width: 12, height: 18,
                background: '#60a5fa',
                boxShadow: '0 0 12px rgba(96,165,250,0.8), 0 0 0 1px rgba(255,255,255,0.4) inset',
              }} />
            {/* End handle */}
            <div
              onMouseDown={onHandleDown('end')}
              onTouchStart={onHandleDown('end')}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
              style={{
                left: `${endPct}%`,
                width: 12, height: 18,
                background: '#e879f9',
                boxShadow: '0 0 12px rgba(232,121,249,0.8), 0 0 0 1px rgba(255,255,255,0.4) inset',
              }} />
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Background — starfield + nebulae
// ══════════════════════════════════════════════════════════════════════════
function Starfield() {
  const farStars  = useMemo(() => generateStars(120, 0.4, 1.1, 0.25, 0.55), [])
  const midStars  = useMemo(() => generateStars(60,  0.8, 1.8, 0.45, 0.75), [])
  const nearStars = useMemo(() => generateStars(22,  1.4, 2.6, 0.65, 0.95), [])
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <StarLayer stars={farStars}  duration="220s" />
      <StarLayer stars={midStars}  duration="120s" />
      <StarLayer stars={nearStars} duration="60s"  />
    </div>
  )
}

function StarLayer({ stars, duration }) {
  return (
    <div className="absolute top-0 left-0 h-full"
      style={{
        width: '200%',
        animation: `star-drift ${duration} linear infinite`,
        willChange: 'transform',
      }}>
      {[0, 1].map(half => (
        <div key={half} className="absolute top-0 h-full"
          style={{ left: `${half * 50}%`, width: '50%' }}>
          {stars.map((s, i) => (
            <span key={`${half}-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${s.x}%`, top: `${s.y}%`,
                width: s.r, height: s.r,
                background: '#fff',
                boxShadow: s.r > 2 ? `0 0 ${s.r * 1.6}px rgba(255,255,255,0.4)` : undefined,
                animation: `star-twinkle ${4 + s.tDelay * 6}s ease-in-out ${s.tDelay}s infinite`,
                '--star-base': s.oBase,
                '--star-peak': s.oPeak,
              }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function generateStars(count, rMin, rMax, oBaseMin, oPeakMax) {
  let seed = count * 9301 + 49297
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  return Array.from({ length: count }).map(() => ({
    x: rand() * 100, y: rand() * 100,
    r: rMin + rand() * (rMax - rMin),
    oBase: oBaseMin + rand() * 0.15,
    oPeak: 0.6 + rand() * (oPeakMax - 0.6),
    tDelay: rand() * 5,
  }))
}

function NebulaBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute"
        style={{
          left: '30%', top: '40%', width: 700, height: 700,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(59,130,246,0.16), transparent 65%)',
          filter: 'blur(20px)',
          animation: 'nebula-pulse 14s ease-in-out infinite',
        }} />
      <div className="absolute"
        style={{
          left: '75%', top: '30%', width: 600, height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(232,121,249,0.12), transparent 65%)',
          filter: 'blur(22px)',
          animation: 'nebula-pulse-slow 18s ease-in-out infinite',
        }} />
      <div className="absolute"
        style={{
          left: '60%', top: '75%', width: 500, height: 500,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(34,211,238,0.10), transparent 65%)',
          filter: 'blur(20px)',
          animation: 'nebula-pulse 22s ease-in-out infinite',
        }} />
    </div>
  )
}
