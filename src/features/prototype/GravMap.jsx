import { useMemo, useRef, useState, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { MapPin, Calendar as CalIcon, AlertTriangle, ArrowRight, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { USERS, TASK_STATUS } from '../../data/models.js'
import { MiniCalendar } from '../../components/ui/MiniCalendar.jsx'
import { usePrototypeData } from './dataSource.js'

// ─────────────────────────────────────────────────────────────────────────────
// GravMap — 3D production visualisation (iteration 1).
//
// Replaces the 2D Constellation's role as the "studio at a glance" view, but
// in 3D space using three.js / react-three-fiber. Preserves all the
// analytical concepts of the 2D version (productions as central bodies,
// resources committed to productions, conflicts as visual flares, time
// scrubber drives state), so it remains a real organisation tool — not just
// eye candy.
//
// Layout: productions sit on a horizontal ring around a central "studio"
// core. Resources orbit their committed production at a radius proportional
// to how recently the commitment is. Lines connect resources to their
// productions for the day under the scrubber. Doubled-up commitments (a
// resource on two productions in the same window) glow red.
//
// Iteration 1 ships the scene + scrubber + basic interactivity. Conflict
// flares, click-to-zoom, post-processing bloom, etc. come in later passes
// per the iteration plan we agreed on.
// ─────────────────────────────────────────────────────────────────────────────

// Visual constants. Kept here so future iterations can tune the look from
// one spot. Distances are in three.js world units.
const STUDIO_CORE_RADIUS = 0.6
const PROD_RING_RADIUS   = 6
const PROD_BODY_RADIUS   = 0.55
const RESOURCE_RADIUS    = 0.12
const ORBIT_DISTANCE     = 1.6   // resources orbit this far from their production
const FILTER_OPTIONS = [
  { id: 'all',    label: 'ALL' },
  { id: 'people', label: 'PEOPLE' },
  { id: 'gear',   label: 'GEAR' },
]

export function GravMap() {
  const data = usePrototypeData()
  const { productions, resources, commitments, windowDays, dayIndex, dateAtDayIndex } = data
  // Full production records from AppContext — needed to feed
  // ProductionQuickView with the rich shape (roadmap, addons, concerns,
  // assigned crew, etc). The prototype's projection only has the visual
  // fields, so we look up the real record by id when a planet is clicked.
  const { productions: appProductions } = useApp()
  const navigate = useNavigate()

  const [scrubDay, setScrubDay]   = useState(0)
  const [filter, setFilter]       = useState('all')
  const [clickedProd, setClickedProd] = useState(null)
  const [calOpen, setCalOpen]         = useState(false)

  // Days with at least one production scheduled — drives the blue-dot
  // indicators in the MiniCalendar so the user can see "busy" weeks at a
  // glance from the picker.
  const eventDays = useMemo(() => {
    const set = new Set()
    productions.forEach(p => {
      const start = new Date(p.start); start.setHours(12, 0, 0, 0)
      const end   = new Date(p.end);   end.setHours(12, 0, 0, 0)
      const cursor = new Date(start)
      while (cursor <= end) {
        set.add(format(cursor, 'yyyy-MM-dd'))
        cursor.setDate(cursor.getDate() + 1)
      }
    })
    return set
  }, [productions])

  const jumpToDate = (date) => {
    if (!date) return
    const idx = dayIndex(date)
    const clamped = Math.max(0, Math.min(windowDays, idx))
    setScrubDay(clamped)
    setCalOpen(false)
  }

  // Filter resources by the active chip. People/Gear/Locations — same
  // language as the 2D Constellation + Gantt so the mental model carries.
  const filteredResources = useMemo(
    () => filter === 'all' ? resources : resources.filter(r => r.kind === filter),
    [resources, filter]
  )

  // Compute production positions on a horizontal ring. Evenly spaced by
  // angle; cyclic so the count doesn't matter (unlike the 2D 4-corner
  // hardcoded layout). Angles stored alongside positions because the ring
  // rotation calc needs them.
  const prodLayout = useMemo(() => {
    const map = new Map()
    productions.forEach((prod, i) => {
      const angle = (i / Math.max(productions.length, 1)) * Math.PI * 2
      map.set(prod.id, {
        angle,
        position: [
          Math.cos(angle) * PROD_RING_RADIUS,
          0,
          Math.sin(angle) * PROD_RING_RADIUS,
        ],
      })
    })
    return map
  }, [productions])
  const prodPositions = useMemo(() => {
    const m = new Map()
    prodLayout.forEach((v, k) => m.set(k, v.position))
    return m
  }, [prodLayout])

  // For each resource, which productions are they committed to at the
  // scrub date? Drives both the orbit position and the conflict flare.
  const scrubDate = dateAtDayIndex(scrubDay)
  const activeCommitments = useMemo(() => {
    return commitments.filter(c => c.start <= scrubDate && scrubDate <= c.end)
  }, [commitments, scrubDate])

  // Pick the "feature" production for the scrub date — the one whose date
  // window midpoint is closest. That production rotates to the front of
  // the ring so the camera looks straight at it. Per Wilder: "the selected
  // date comes to the front."
  const featureProdId = useMemo(() => {
    let best = null
    for (const p of productions) {
      const mid = (p.start.getTime() + p.end.getTime()) / 2
      const dist = Math.abs(mid - scrubDate.getTime())
      if (!best || dist < best.dist) best = { id: p.id, dist }
    }
    return best?.id || null
  }, [productions, scrubDate])

  // Target ring rotation that puts the feature production at the front of
  // the camera. Camera sits at +Z so "front" is the +Z side of the ring
  // (sin θ = 1 → θ = π/2). Rotating the ring by (π/2 - featureAngle) does it.
  const targetRingRotation = useMemo(() => {
    if (!featureProdId) return 0
    const entry = prodLayout.get(featureProdId)
    if (!entry) return 0
    return Math.PI / 2 - entry.angle
  }, [featureProdId, prodLayout])

  // ── Click-a-planet → ProductionQuickView popup ───────────────────────────
  // Look up the FULL Production record from AppContext since the prototype
  // projection only carries visual fields. Same pattern Gantt uses.
  const clickedFullProd = useMemo(
    () => clickedProd ? appProductions.find(p => p.id === clickedProd) : null,
    [clickedProd, appProductions]
  )

  // Conflicts for the clicked prod: which resources committed here are also
  // committed to another production during overlapping dates. Surfaced in
  // ProductionQuickView's red panel. Lifted from Gantt's same calculation.
  const clickedConflicts = useMemo(() => {
    if (!clickedProd) return []
    const myCs = commitments.filter(c => c.productionId === clickedProd)
    const out  = []
    const seen = new Set()
    for (const c of myCs) {
      const others = commitments.filter(o =>
        o.resourceId === c.resourceId &&
        o.productionId !== clickedProd &&
        c.start <= o.end && o.start <= c.end
      )
      for (const o of others) {
        const key = `${c.resourceId}:${o.productionId}`
        if (seen.has(key)) continue
        seen.add(key)
        const resource = resources.find(r => r.id === c.resourceId)
        const otherProd = productions.find(p => p.id === o.productionId)
        if (!resource || !otherProd) continue
        out.push({
          resourceName:        resource.name,
          otherProductionName: otherProd.name,
        })
      }
    }
    return out
  }, [clickedProd, commitments, resources, productions])

  const resourceActiveProds = useMemo(() => {
    const map = new Map()
    for (const c of activeCommitments) {
      if (!map.has(c.resourceId)) map.set(c.resourceId, [])
      map.get(c.resourceId).push(c.productionId)
    }
    return map
  }, [activeCommitments])

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-5">
      <Header
        scrubDate={scrubDate}
        calOpen={calOpen}
        onToggleCal={() => setCalOpen(o => !o)}
        eventDays={eventDays}
        onJump={jumpToDate}
        onCloseCal={() => setCalOpen(false)}
      />

      {productions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-elevated mt-4 overflow-hidden">
          {/* Toolbar — filter chips. Same vocab as the 2D Constellation
              so users moving between tabs don't relearn. */}
          <Toolbar filter={filter} setFilter={setFilter} />

          {/* 3D scene */}
          <div className="relative" style={{ background: '#05060a', height: '60vh', minHeight: 420 }}>
            <Canvas
              camera={{ position: [0, 6, 14], fov: 50 }}
              dpr={[1, 2]}
              gl={{ antialias: true }}
            >
              <Suspense fallback={null}>
                {/* Lighting — ambient floor + a key point light from above so
                    the spheres get clear shading without losing the colours. */}
                <ambientLight intensity={0.4} />
                <pointLight position={[10, 15, 10]} intensity={1.1} color="#ffffff" />
                <pointLight position={[-10, -5, -10]} intensity={0.4} color="#60a5fa" />

                {/* Background starfield */}
                <Stars
                  radius={120}
                  depth={60}
                  count={4000}
                  factor={4}
                  saturation={0}
                  fade
                  speed={0.3}
                />

                {/* Studio core — represents Orbital Studios at the centre.
                    Stays outside the rotating ring group so it never moves. */}
                <StudioCore />

                {/* Rotating ring — productions + their spokes + their
                    orbiting resources all live in one group so they rotate
                    together when the scrubber moves. The lerp toward
                    targetRingRotation happens inside <ProductionRing>. */}
                <ProductionRing targetRotation={targetRingRotation}>
                  {productions.map(prod => (
                    <ProductionBody
                      key={prod.id}
                      prod={prod}
                      position={prodPositions.get(prod.id)}
                      isClicked={clickedProd === prod.id}
                      isFeatured={featureProdId === prod.id}
                      onClick={() => setClickedProd(p => p === prod.id ? null : prod.id)}
                    />
                  ))}
                  {productions.map(prod => {
                    const pos = prodPositions.get(prod.id)
                    if (!pos) return null
                    return (
                      <Line
                        key={`spoke-${prod.id}`}
                        points={[[0, 0, 0], pos]}
                        color={prod.color}
                        opacity={0.18}
                        transparent
                        lineWidth={1}
                      />
                    )
                  })}
                  {filteredResources.map(resource => {
                    const activeIds = resourceActiveProds.get(resource.id) || []
                    if (activeIds.length === 0) return null
                    return activeIds.map((prodId, idx) => {
                      const prodPos = prodPositions.get(prodId)
                      if (!prodPos) return null
                      const isConflict = activeIds.length > 1
                      return (
                        <ResourceBody
                          key={`${resource.id}-${prodId}`}
                          resource={resource}
                          productionPos={prodPos}
                          orbitSeed={resource.id.charCodeAt(0) + idx * 17}
                          isConflict={isConflict}
                        />
                      )
                    })
                  })}

                  {/* In-scene HUD panel — anchored to the clicked planet's
                      ring position so it rotates WITH the ring as the user
                      scrubs through time. Renders HTML via drei <Html> so
                      we get all the readable typography + interactivity of
                      DOM, but anchored in 3D space. */}
                  {clickedProd && clickedFullProd && prodPositions.get(clickedProd) && (
                    <group position={prodPositions.get(clickedProd)}>
                      {/* Faint glow line from planet to panel anchor so the
                          link between them is obvious as the ring rotates. */}
                      <Line
                        points={[[0, 0, 0], [1.4, 1.6, 0]]}
                        color={clickedFullProd.cardColor || '#60a5fa'}
                        opacity={0.55}
                        transparent
                        lineWidth={1}
                      />
                      <Html
                        position={[1.4, 1.6, 0]}
                        distanceFactor={9}
                        zIndexRange={[100, 0]}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <PlanetInfoPanel
                          production={clickedFullProd}
                          conflicts={clickedConflicts}
                          onClose={() => setClickedProd(null)}
                          onOpenFull={() => {
                            const id = clickedProd
                            setClickedProd(null)
                            if (id) navigate(`/productions/${id}`)
                          }}
                        />
                      </Html>
                    </group>
                  )}
                </ProductionRing>

                {/* Camera controls — drag to orbit, scroll to zoom. Limits
                    keep the camera out of the centre and not too far away. */}
                <OrbitControls
                  enablePan={false}
                  minDistance={6}
                  maxDistance={28}
                  minPolarAngle={Math.PI / 6}
                  maxPolarAngle={Math.PI / 2.1}
                  rotateSpeed={0.6}
                />
              </Suspense>
            </Canvas>

            {/* Overlay HUD — top-left status, bottom-right interaction hint */}
            <div className="absolute top-3 left-3 pointer-events-none">
              <p className="font-telemetry text-[9px] tracking-[0.22em] text-orbital-subtle/80">
                GRAV MAP · ITER 1 · 3D
              </p>
              <p className="font-telemetry text-[9px] tracking-wider text-orbital-dim mt-1">
                {productions.length} PROD · {filteredResources.length} RES · {activeCommitments.length} ACTIVE
              </p>
            </div>
            <div className="absolute bottom-3 right-3 pointer-events-none">
              <p className="font-telemetry text-[9px] tracking-wider text-orbital-dim text-right">
                DRAG TO ORBIT · SCROLL TO ZOOM
              </p>
            </div>
          </div>

          {/* Scrubber — same time slider language as Gantt + Constellation */}
          <Scrubber
            day={scrubDay}
            setDay={setScrubDay}
            windowDays={windowDays}
            scrubDate={scrubDate}
          />
        </div>
      )}

    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header({ scrubDate, calOpen, onToggleCal, eventDays, onJump, onCloseCal }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-4">
      <div>
        <p className="hud-label mb-1">GRAV MAP</p>
        <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">
          The studio in 3D
        </h1>
        <p className="text-sm text-orbital-subtle mt-0.5">
          Productions orbit the studio core. Resources orbit their active production.
          Drag to look around; scroll to zoom. Click the date to jump to a specific day.
        </p>
      </div>
      <div className="sm:text-right relative">
        <p className="hud-label mb-1">PLAYHEAD</p>
        {/* Clickable playhead — opens a MiniCalendar with blue dots on
            production days. Picking a date jumps the scrubber AND rotates
            the production ring so the featured prod for that day faces
            the camera (handled in GravMap.targetRingRotation). */}
        <button
          onClick={onToggleCal}
          className="font-telemetry text-sm text-orbital-text tracking-wider px-2 py-1 rounded hover:bg-orbital-muted transition-colors whitespace-nowrap"
          title="Click to jump to a specific date"
        >
          {scrubDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          }).toUpperCase()}
        </button>
        {calOpen && (
          <MiniCalendar
            selected={scrubDate}
            eventDays={eventDays}
            onPick={onJump}
            onClose={onCloseCal}
            anchor="right"
          />
        )}
      </div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="card-elevated mt-4 px-6 py-12 text-center">
      <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle mb-2">
        NO PRODUCTIONS WITH DATE BOUNDS
      </p>
      <p className="text-sm text-orbital-dim max-w-md mx-auto">
        Add a production with start and end dates and it'll appear as an
        orbiting body in the Grav Map.
      </p>
    </div>
  )
}

// ── Toolbar ──────────────────────────────────────────────────────────────────
function Toolbar({ filter, setFilter }) {
  return (
    <div
      className="flex items-center gap-4 px-3 py-2 flex-wrap"
      style={{ borderBottom: '1px solid var(--orbital-border)' }}
    >
      <span className="hud-label">FILTER</span>
      <div className="flex items-center gap-1.5 flex-wrap">
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
    </div>
  )
}

// ── ProductionRing — wraps the prods + spokes + resources in a group that
// smoothly rotates toward a target angle. Driven by the scrub date so the
// "featured" production for the current day faces the camera. Per Wilder:
// the selected date should come to the front. ─────────────────────────────
function ProductionRing({ targetRotation, children }) {
  const groupRef = useRef()
  // Track the unwrapped accumulated rotation so we always take the shortest
  // path to the target (e.g. don't unwind 350° when you could go +10°).
  useFrame((_, dt) => {
    if (!groupRef.current) return
    const current = groupRef.current.rotation.y
    let diff = targetRotation - current
    // Normalise diff to (-PI, PI] so the lerp goes the short way.
    while (diff > Math.PI)  diff -= Math.PI * 2
    while (diff <= -Math.PI) diff += Math.PI * 2
    // Smooth easing — small fraction per frame, framerate-independent via dt.
    groupRef.current.rotation.y = current + diff * Math.min(1, dt * 3)
  })
  return <group ref={groupRef}>{children}</group>
}

// ── PlanetInfoPanel — holographic readout rendered next to a clicked planet
// via drei <Html>. Lives inside the rotating ring group so it follows the
// planet as the user scrubs through time. Styled to read as a sci-fi HUD
// rather than a flat web modal — translucent dark panel, glowing border in
// the production's accent colour, mono telemetry typography. ───────────────
function PlanetInfoPanel({ production, conflicts, onClose, onOpenFull }) {
  const p = production
  const accent = p.cardColor || '#60a5fa'

  // Countdown — same calc as the ProductionQuickView popup so the language
  // is consistent across surfaces (T-13 DAYS / DAY 16 OF 17 / +4 DAYS AGO).
  const countdown = (() => {
    if (!p.startDate) return null
    const today = new Date()
    const start = parseISO(p.startDate)
    const end   = p.endDate ? parseISO(p.endDate) : start
    const toStart  = differenceInCalendarDays(start, today)
    const sinceEnd = differenceInCalendarDays(today, end)
    if (toStart  > 0) return { label: `T-${toStart}`, sub: toStart  === 1 ? 'DAY'     : 'DAYS',     color: '#60a5fa' }
    if (sinceEnd > 0) return { label: `+${sinceEnd}`, sub: sinceEnd === 1 ? 'DAY AGO' : 'DAYS AGO', color: '#71717a' }
    const total = differenceInCalendarDays(end, start) + 1
    const dayN  = differenceInCalendarDays(today, start) + 1
    return { label: `DAY ${dayN}`, sub: `OF ${total}`, color: '#34d399' }
  })()

  const location = p.locationType === 'In-House (Orbital Studios)'
    ? 'Orbital Studios'
    : p.locationAddress || 'Mobile'

  const memberIds = (p.assignedMembers || []).map(m => m.userId)
  const visibleMembers = memberIds
    .map(id => USERS.find(u => u.id === id))
    .filter(Boolean)
    .slice(0, 6)
  const overflowMembers = Math.max(0, memberIds.length - visibleMembers.length)

  const hasConflicts = conflicts && conflicts.length > 0

  return (
    <div
      // Fixed width gets scaled by Html distanceFactor on the parent so the
      // panel "shrinks/grows" with camera distance — feels like a real 3D
      // hologram rather than a flat overlay.
      style={{
        width: 280,
        background: 'linear-gradient(180deg, rgba(10,12,16,0.92), rgba(10,12,16,0.85))',
        border: `1px solid ${accent}66`,
        boxShadow: `0 0 24px ${accent}30, inset 0 0 24px rgba(0,0,0,0.3)`,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        color: 'var(--orbital-text)',
        fontFamily: 'inherit',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Corner glyphs — sci-fi panel chrome */}
      <span style={{ position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderTop: `1px solid ${accent}`, borderLeft: `1px solid ${accent}` }} />
      <span style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderTop: `1px solid ${accent}`, borderRight: `1px solid ${accent}` }} />
      <span style={{ position: 'absolute', bottom: -1, left: -1, width: 10, height: 10, borderBottom: `1px solid ${accent}`, borderLeft: `1px solid ${accent}` }} />
      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderBottom: `1px solid ${accent}`, borderRight: `1px solid ${accent}` }} />

      {/* Header strap — name + close */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${accent}33`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.22em', color: accent, margin: 0, fontWeight: 600 }}>
            {p.productionType || 'PRODUCTION'}
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 0', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.name}
          </p>
          {p.client && (
            <p style={{ fontSize: 11, color: 'var(--orbital-subtle)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.client}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: 4, background: 'transparent', border: `1px solid ${accent}44`,
            color: 'var(--orbital-subtle)', cursor: 'pointer', display: 'flex',
          }}
          title="Close"
        >
          <X size={11} />
        </button>
      </div>

      {/* Status + countdown row */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 9, letterSpacing: '0.18em', padding: '2px 6px',
            color: '#fff', background: accent, fontWeight: 600,
          }}
        >
          {p.status?.toUpperCase()}
        </span>
        {countdown && (
          <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: countdown.color, fontVariantNumeric: 'tabular-nums' }}>
            {countdown.label}<span style={{ color: 'var(--orbital-subtle)', fontSize: 9, marginLeft: 4 }}>{countdown.sub}</span>
          </span>
        )}
      </div>

      {/* Dates */}
      {p.startDate && (
        <div style={{ padding: '0 10px 6px', fontSize: 11, color: 'var(--orbital-subtle)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Space Mono, monospace' }}>
          <CalIcon size={10} />
          {format(parseISO(p.startDate), 'MMM d, yyyy')}
          {p.endDate && ` → ${format(parseISO(p.endDate), 'MMM d, yyyy')}`}
        </div>
      )}

      {/* Location */}
      <div style={{ padding: '0 10px 8px', fontSize: 11, color: 'var(--orbital-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MapPin size={10} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{location}</span>
      </div>

      {/* Conflicts — red panel, only when something is double-booked. The
          loudest visual element in the panel so issues are obvious. */}
      {hasConflicts && (
        <div
          style={{
            margin: '0 10px 8px', padding: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
          }}
        >
          <p style={{ fontSize: 9, letterSpacing: '0.18em', color: '#fca5a5', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={10} />
            {conflicts.length} CONFLICT{conflicts.length === 1 ? '' : 'S'}
          </p>
          <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
            {conflicts.slice(0, 3).map((c, i) => (
              <li key={i} style={{ fontSize: 11, color: 'var(--orbital-text)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.resourceName} <span style={{ color: 'var(--orbital-subtle)' }}>· also on {c.otherProductionName}</span>
              </li>
            ))}
            {conflicts.length > 3 && (
              <li style={{ fontSize: 10, color: 'var(--orbital-dim)', marginTop: 2 }}>+ {conflicts.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Team avatars */}
      {visibleMembers.length > 0 && (
        <div style={{ padding: '0 10px 8px' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--orbital-dim)', margin: '0 0 4px' }}>TEAM</p>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {visibleMembers.map((u, i) => (
              <div
                key={u.id}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: u.color, color: '#fff', fontSize: 10, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(10,12,16,0.85)',
                  marginLeft: i === 0 ? 0 : -6,
                }}
                title={u.name}
              >
                {u.avatar}
              </div>
            ))}
            {overflowMembers > 0 && (
              <div
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--orbital-muted)', color: 'var(--orbital-subtle)',
                  fontSize: 10, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(10,12,16,0.85)', marginLeft: -6,
                }}
              >
                +{overflowMembers}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onOpenFull}
        style={{
          width: '100%', padding: '8px 10px',
          borderTop: `1px solid ${accent}33`,
          background: `linear-gradient(90deg, ${accent}25, ${accent}10)`,
          color: accent, fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          cursor: 'pointer', border: 'none', letterSpacing: '0.1em',
        }}
      >
        VIEW FULL PAGE <ArrowRight size={11} />
      </button>
    </div>
  )
}

// ── StudioCore — the central anchor representing Orbital Studios ─────────────
function StudioCore() {
  const meshRef = useRef()
  useFrame((_, dt) => { if (meshRef.current) meshRef.current.rotation.y += dt * 0.08 })
  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[STUDIO_CORE_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#1d4ed8"
          emissiveIntensity={0.8}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      {/* Soft halo */}
      <mesh>
        <sphereGeometry args={[STUDIO_CORE_RADIUS * 1.8, 32, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.08} />
      </mesh>
    </group>
  )
}

// ── ProductionBody — coloured sphere on the ring with a floating label ──────
function ProductionBody({ prod, position, isClicked, isFeatured, onClick }) {
  const meshRef = useRef()
  // Subtle bob so the bodies feel alive — small enough not to distract.
  const seed = useMemo(() => prod.id.charCodeAt(0), [prod.id])
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    meshRef.current.position.y = Math.sin(t * 0.4 + seed) * 0.15
    meshRef.current.rotation.y += 0.003
  })
  if (!position) return null
  // Featured = closest to the scrub date. Bumps emissive + halo to draw
  // the eye to the production the scrubber is currently spotlighting.
  const baseEmissive = isClicked ? 1.4 : (isFeatured ? 1.0 : 0.5)
  const haloOpacity  = isClicked ? 0.20 : (isFeatured ? 0.16 : 0.08)
  return (
    <group position={position}>
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[PROD_BODY_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color={prod.color}
          emissive={prod.color}
          emissiveIntensity={baseEmissive}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      {/* Halo */}
      <mesh>
        <sphereGeometry args={[PROD_BODY_RADIUS * 1.7, 32, 32]} />
        <meshBasicMaterial color={prod.color} transparent opacity={haloOpacity} />
      </mesh>
      {/* Label — DOM via drei's <Html>, transforms with the camera */}
      <Html
        position={[0, PROD_BODY_RADIUS + 0.5, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="font-telemetry tracking-wider whitespace-nowrap"
          style={{
            color: prod.color,
            fontSize: 10,
            textShadow: '0 0 4px rgba(0,0,0,0.9)',
          }}
        >
          {prod.code}
        </div>
      </Html>
    </group>
  )
}

// ── ResourceBody — small orbiting body around its active production ─────────
function ResourceBody({ resource, productionPos, orbitSeed, isConflict }) {
  const groupRef = useRef()
  // Orbit speed + phase derived from a stable seed so each resource gets a
  // unique-looking orbit but the orbit doesn't reshuffle on re-render.
  const speed = 0.25 + (orbitSeed % 7) * 0.04
  const phase = (orbitSeed % 31) * 0.2
  const tilt  = ((orbitSeed % 13) / 13 - 0.5) * 0.6

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const a = phase + t * speed
    groupRef.current.position.x = productionPos[0] + Math.cos(a) * ORBIT_DISTANCE
    groupRef.current.position.z = productionPos[2] + Math.sin(a) * ORBIT_DISTANCE
    groupRef.current.position.y = productionPos[1] + Math.sin(a * 0.7) * tilt
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[RESOURCE_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color={isConflict ? '#ef4444' : (resource.color || '#94a3b8')}
          emissive={isConflict ? '#ef4444' : (resource.color || '#94a3b8')}
          emissiveIntensity={isConflict ? 1.2 : 0.45}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      {isConflict && (
        <mesh>
          <sphereGeometry args={[RESOURCE_RADIUS * 2.4, 16, 16]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.22} />
        </mesh>
      )}
    </group>
  )
}

// ── Scrubber — same shape as Gantt's so the muscle memory carries ─────────
function Scrubber({ day, setDay, windowDays, scrubDate }) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3"
      style={{
        borderTop: '1px solid var(--orbital-border)',
        background: 'var(--orbital-bg)',
      }}
    >
      <span className="font-telemetry text-[10px] tracking-wider text-orbital-subtle whitespace-nowrap">
        SCRUB
      </span>
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
