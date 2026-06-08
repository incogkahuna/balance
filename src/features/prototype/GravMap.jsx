import { useMemo, useRef, useState, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line, Points, PointMaterial } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { format, parseISO, differenceInCalendarDays, isSameDay } from 'date-fns'
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
const HOME_RADIUS_BASE   = 2.4   // idle resources orbit this far from the studio core
const HOME_RADIUS_SPREAD = 1.2   // additional radius variance per resource (so the home swarm isn't a flat shell)
const FILTER_OPTIONS = [
  { id: 'all',    label: 'ALL' },
  { id: 'people', label: 'PEOPLE' },
  { id: 'gear',   label: 'GEAR' },
]

// Per-production-status multipliers — Active prods feel alive, Completed
// ones freeze, Incoming/Wrap sit somewhere in between. Drives resource
// orbit speed + production body emissive so the scene reads lifecycle
// state at a glance without reading labels.
const STATUS_SPEED = {
  Active:    1.0,
  Incoming:  0.45,
  Wrap:      0.7,
  Completed: 0.0,
}
const STATUS_EMISSIVE = {
  Active:    1.0,
  Incoming:  0.85,
  Wrap:      0.65,
  Completed: 0.25,
}
const speedFor    = (status) => STATUS_SPEED[status]    ?? 1.0
const emissiveFor = (status) => STATUS_EMISSIVE[status] ?? 1.0

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
  const [hoveredProd, setHoveredProd] = useState(null)
  const [clickedResource, setClickedResource] = useState(null)

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

  // Quick lookup: productionId → status. Used to vary orbit speeds and
  // emissive intensity per lifecycle state.
  const prodStatusById = useMemo(() => {
    const map = new Map()
    productions.forEach(p => map.set(p.id, p.status || 'Active'))
    return map
  }, [productions])

  // Today proximity: 0 when scrubbed far from today, 1 when scrubbed on
  // today. Drives the TODAY beam's brightness so the user always knows
  // where "now" sits relative to where they're looking.
  const todayProximity = useMemo(() => {
    const now = new Date()
    const days = Math.abs(differenceInCalendarDays(scrubDate, now))
    // Full bright within ±2 days, fades to nothing by 14 days out.
    if (days <= 2) return 1
    if (days >= 14) return 0
    return 1 - (days - 2) / 12
  }, [scrubDate])
  const scrubIsToday = useMemo(() => isSameDay(scrubDate, new Date()), [scrubDate])

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

          {/* 3D scene + side drawer — flex layout so the drawer takes a
              fixed slice of the LEFT and the canvas resizes to fill the
              remainder. Avoids any overlap between the production details
              panel and the planets. */}
          <div className="relative flex" style={{ background: '#05060a', height: '60vh', minHeight: 420 }}>
            <ProductionDrawer
              production={clickedFullProd}
              conflicts={clickedConflicts}
              onClose={() => setClickedProd(null)}
              onOpenFull={() => {
                const id = clickedProd
                setClickedProd(null)
                if (id) navigate(`/productions/${id}`)
              }}
            />
            <div className="flex-1 relative min-w-0">
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

                {/* Nebula skybox — large gradient sphere behind everything
                    so the void has colour and depth instead of pure black.
                    Sits inside-out (BackSide) so the camera always reads
                    its inner surface. */}
                <NebulaSky />

                {/* Background starfield + drifting dust particles in front
                    of the nebula. Together they give the scene depth that
                    bloom + vignette amplify. */}
                <Stars
                  radius={120}
                  depth={60}
                  count={4000}
                  factor={4}
                  saturation={0}
                  fade
                  speed={0.3}
                />
                <DustParticles />

                {/* Studio core — represents Orbital Studios at the centre.
                    Stays outside the rotating ring group so it never moves. */}
                <StudioCore />

                {/* TODAY beam — vertical golden pillar through the core whose
                    brightness tracks how close the scrub date is to today.
                    Always-on visual reference for "where is now relative to
                    where I'm looking." */}
                <TodayBeam proximity={todayProximity} isToday={scrubIsToday} />

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
                      isHovered={hoveredProd === prod.id}
                      statusSpeed={speedFor(prod.status)}
                      statusEmissive={emissiveFor(prod.status)}
                      onHover={() => setHoveredProd(prod.id)}
                      onUnhover={() => setHoveredProd(h => h === prod.id ? null : h)}
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
                  {/* Resources — render ALL filtered resources every frame.
                      Each body lives in one of two states and lerps between
                      them as the scrubber moves:
                        - HOME: orbits the studio core (parked / idle)
                        - AWAY: orbits an active production (committed)
                      Conflict (>1 active prod) glows red and orbits the
                      first one. The smooth fly-home effect is the whole
                      point — you watch each person travel between jobs. */}
                  {filteredResources.map((resource, idx) => {
                    const activeIds  = resourceActiveProds.get(resource.id) || []
                    const isCommitted = activeIds.length > 0
                    const isConflict  = activeIds.length > 1
                    const targetProdId = isCommitted ? activeIds[0] : null
                    const targetPos    = targetProdId ? prodPositions.get(targetProdId) : null
                    const statusSpeed  = targetProdId
                      ? speedFor(prodStatusById.get(targetProdId))
                      : 0.55 // gentle drift while idle
                    return (
                      <ResourceBody
                        key={resource.id}
                        resource={resource}
                        targetProdPos={targetPos}
                        homeIdx={idx}
                        homeOf={filteredResources.length}
                        isCommitted={isCommitted}
                        isConflict={isConflict}
                        statusSpeed={statusSpeed}
                        isClicked={clickedResource === resource.id}
                        onClick={() =>
                          setClickedResource(r => r === resource.id ? null : resource.id)
                        }
                      />
                    )
                  })}

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

                {/* Post-processing — bloom turns the emissive surfaces
                    (planets, studio core, today beam, conflict pulses)
                    into actual glowing light. Vignette darkens the edges
                    so the centre of the frame feels like a focused
                    "viewport" rather than a flat canvas. */}
                <EffectComposer multisampling={0}>
                  <Bloom
                    intensity={1.2}
                    luminanceThreshold={0.15}
                    luminanceSmoothing={0.85}
                    mipmapBlur
                  />
                  <Vignette offset={0.15} darkness={0.6} eskil={false} />
                </EffectComposer>
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

// ── ProductionDrawer — full-height left-side panel that slides in when a
// planet is clicked. Replaces the previous in-scene <Html> popup so the
// production details no longer overlap the planets. Lives in the flex
// row alongside the canvas; r3f's ResizeObserver catches the resulting
// canvas width change and the scene reflows automatically.
//
// Same hologram aesthetic as before (translucent dark, accent border,
// corner brackets, telemetry typography) — just laid out vertically as a
// full-height drawer. Slides in/out with a CSS transform transition.
// ─────────────────────────────────────────────────────────────────────────
function ProductionDrawer({ production, conflicts, onClose, onOpenFull }) {
  const open = !!production
  // Render a width-collapsed container when no prod is selected so the
  // flex row reflows cleanly to give the canvas full width. Animated via
  // CSS transition on width + translateX for the slide.
  const accent = production?.cardColor || '#60a5fa'
  return (
    <div
      style={{
        width:      open ? 340 : 0,
        minWidth:   open ? 340 : 0,
        transition: 'width 220ms ease-out, min-width 220ms ease-out',
        overflow:   'hidden',
        position:   'relative',
        height:     '100%',
        background: 'linear-gradient(180deg, rgba(10,12,16,0.95), rgba(10,12,16,0.88))',
        borderRight: open ? `1px solid ${accent}55` : '1px solid transparent',
        boxShadow: open ? `8px 0 24px rgba(0,0,0,0.4), inset -1px 0 0 ${accent}22` : 'none',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {open && (
        <ProductionDrawerInner
          production={production}
          conflicts={conflicts}
          onClose={onClose}
          onOpenFull={onOpenFull}
        />
      )}
    </div>
  )
}

// The actual contents of the drawer. Kept as a separate component so the
// expand/collapse animation on the wrapper doesn't fight with React's
// internal state for the inner controls.
function ProductionDrawerInner({ production, conflicts, onClose, onOpenFull }) {
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
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--orbital-text)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Subtle accent edge running down the right side — visually
          separates drawer from canvas in the production's colour. */}
      <span
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 2, background: `linear-gradient(180deg, ${accent}99, ${accent}11)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header strap — type label, name, client, close */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${accent}33`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.24em', color: accent, margin: 0, fontWeight: 600 }}>
            {p.productionType || 'PRODUCTION'}
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0', lineHeight: 1.2, color: '#fff' }}>
            {p.name}
          </p>
          {p.client && (
            <p style={{ fontSize: 12, color: 'var(--orbital-subtle)', margin: '4px 0 0' }}>
              {p.client}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: 6, background: 'transparent', border: `1px solid ${accent}44`,
            color: 'var(--orbital-subtle)', cursor: 'pointer', display: 'flex',
            flexShrink: 0,
          }}
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Scrollable body for everything else — keeps the header strap +
          footer CTA pinned even if the team list grows long. */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Status + countdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontSize: 10, letterSpacing: '0.2em', padding: '3px 8px',
              color: '#fff', background: accent, fontWeight: 600,
            }}
          >
            {p.status?.toUpperCase()}
          </span>
          {countdown && (
            <span style={{ fontSize: 12, fontFamily: 'Space Mono, monospace', color: countdown.color, fontVariantNumeric: 'tabular-nums' }}>
              {countdown.label}<span style={{ color: 'var(--orbital-subtle)', fontSize: 10, marginLeft: 4 }}>{countdown.sub}</span>
            </span>
          )}
        </div>

        {/* Dates + location stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {p.startDate && (
            <div style={{ fontSize: 12, color: 'var(--orbital-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Space Mono, monospace' }}>
              <CalIcon size={12} />
              <span>
                {format(parseISO(p.startDate), 'MMM d, yyyy')}
                {p.endDate && ` → ${format(parseISO(p.endDate), 'MMM d, yyyy')}`}
              </span>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--orbital-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={12} />
            <span>{location}</span>
          </div>
        </div>

        {/* Conflicts — most visually loud element when present */}
        {hasConflicts && (
          <div
            style={{
              padding: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.45)',
            }}
          >
            <p style={{ fontSize: 10, letterSpacing: '0.18em', color: '#fca5a5', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={11} />
              {conflicts.length} CONFLICT{conflicts.length === 1 ? '' : 'S'} · DOUBLE-BOOKED
            </p>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conflicts.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--orbital-text)' }}>
                  <span style={{ fontWeight: 600 }}>{c.resourceName}</span>
                  <span style={{ color: 'var(--orbital-subtle)' }}> · also on {c.otherProductionName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Team — full list, not just avatars */}
        {visibleMembers.length > 0 && (
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--orbital-dim)', margin: '0 0 8px' }}>TEAM</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleMembers.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: u.color, color: '#fff', fontSize: 11, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {u.avatar}
                  </div>
                  <span style={{ fontSize: 12 }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--orbital-dim)', textTransform: 'uppercase', letterSpacing: '0.15em', marginLeft: 'auto' }}>
                    {u.role}
                  </span>
                </div>
              ))}
              {overflowMembers > 0 && (
                <p style={{ fontSize: 11, color: 'var(--orbital-dim)', margin: 0, paddingLeft: 32 }}>
                  + {overflowMembers} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats footer — small numeric callouts. Adds info density to
            justify the full-height drawer real estate. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat label="ADDONS"   value={p.addons?.length || 0} />
          <Stat label="CONCERNS" value={p.bible?.concerns?.length || 0} />
        </div>
      </div>

      {/* CTA — pinned to the bottom */}
      <button
        onClick={onOpenFull}
        style={{
          width: '100%', padding: '12px 14px',
          borderTop: `1px solid ${accent}33`,
          background: `linear-gradient(90deg, ${accent}28, ${accent}12)`,
          color: accent, fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', border: 'none', letterSpacing: '0.12em',
          flexShrink: 0,
        }}
      >
        VIEW FULL PAGE <ArrowRight size={12} />
      </button>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: 8, border: '1px solid var(--orbital-border)', background: 'rgba(255,255,255,0.02)' }}>
      <p style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--orbital-dim)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '4px 0 0', fontFamily: 'Space Mono, monospace' }}>
        {String(value).padStart(2, '0')}
      </p>
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

// ── ProductionBody — photoreal-ish planet on the ring ──────────────────────
// Layered build:
//   1. Body sphere with custom shader (FBM noise terrain in accent colour)
//   2. Atmosphere shell with Fresnel rim glow (Earth-from-space look)
//   3. Cloud layer with drifting noise (subtle motion + scale)
//   4. ClientBadge — floating circular logo plate billboarded at camera
//   5. Production code label (existing — kept above the planet)
//
// Future: swap ClientBadge's initials for a real logo image when
// production.logoUrl (or production.client.logoUrl) is populated. The
// component already accepts a `logoUrl` prop and renders an <img> when
// present, falling back to initials otherwise.
function ProductionBody({ prod, position, isClicked, isFeatured, isHovered, statusSpeed = 1, statusEmissive = 1, onClick, onHover, onUnhover }) {
  const groupRef = useRef()
  const bodyRef  = useRef()
  const cloudRef = useRef()
  const seed = useMemo(() => {
    // Stable per-prod seed from id chars so terrain is unique per planet
    // and doesn't reshuffle on re-render.
    let h = 0
    for (let i = 0; i < prod.id.length; i++) h = (h * 31 + prod.id.charCodeAt(i)) & 0xffff
    return h
  }, [prod.id])

  // Shader uniforms — created once, mutated per frame. Recompute when
  // colour/status changes (statusEmissive feeds the body brightness too).
  const bodyUniforms = useMemo(() => ({
    uColor:    { value: new THREE.Color(prod.color) },
    uDeep:     { value: new THREE.Color(prod.color).multiplyScalar(0.35) },
    uPeak:     { value: new THREE.Color(prod.color).multiplyScalar(1.4) },
    uSeed:     { value: seed * 0.01 },
    uEmissive: { value: statusEmissive * (isFeatured ? 1.0 : 0.65) },
    uTime:     { value: 0 },
  }), [prod.color, seed, statusEmissive, isFeatured])

  const atmoUniforms = useMemo(() => ({
    uColor:   { value: new THREE.Color(prod.color) },
    uOpacity: { value: (isClicked ? 0.7 : isFeatured ? 0.55 : 0.35) * statusEmissive },
  }), [prod.color, isClicked, isFeatured, statusEmissive])

  const cloudUniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#ffffff') },
    uSeed:  { value: seed * 0.013 },
    uTime:  { value: 0 },
  }), [seed])

  // Hover/click scale — lerp the whole group's scale so the planet
  // gently grows on hover and pops on click. Camera-relative bump
  // doubles as visual confirmation that hit-testing is working.
  const targetScale = isClicked ? 1.18 : (isHovered ? 1.08 : 1.0)
  useFrame((state, dt) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    // Bob the entire planet group (body + atmosphere + clouds together)
    groupRef.current.position.y = Math.sin(t * 0.4 + seed) * 0.15 * statusSpeed
    // Smoothly approach target scale
    const cur = groupRef.current.scale.x
    const ns  = cur + (targetScale - cur) * Math.min(1, dt * 8)
    groupRef.current.scale.setScalar(ns)
    // Rotate the body and clouds at different rates for parallax
    if (bodyRef.current)  bodyRef.current.rotation.y  += 0.0025 * statusSpeed
    if (cloudRef.current) cloudRef.current.rotation.y += 0.0011 * statusSpeed
    // Animate shader time uniforms for subtle surface motion
    if (bodyUniforms)  bodyUniforms.uTime.value  = t * 0.03
    if (cloudUniforms) cloudUniforms.uTime.value = t * 0.02
  })

  if (!position) return null

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { onUnhover?.(); document.body.style.cursor = '' }}
    >
      {/* Body sphere with procedural shader */}
      <mesh ref={bodyRef} onClick={onClick}>
        <sphereGeometry args={[PROD_BODY_RADIUS, 64, 64]} />
        <shaderMaterial
          uniforms={bodyUniforms}
          vertexShader={PLANET_VERT}
          fragmentShader={PLANET_FRAG}
        />
      </mesh>

      {/* Cloud layer — slightly larger, slowly rotating */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[PROD_BODY_RADIUS * 1.02, 48, 48]} />
        <shaderMaterial
          uniforms={cloudUniforms}
          vertexShader={CLOUD_VERT}
          fragmentShader={CLOUD_FRAG}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere shell — Fresnel rim glow for the "Earth from space" look */}
      <mesh scale={1.18}>
        <sphereGeometry args={[PROD_BODY_RADIUS, 48, 48]} />
        <shaderMaterial
          uniforms={atmoUniforms}
          vertexShader={ATMOSPHERE_VERT}
          fragmentShader={ATMOSPHERE_FRAG}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Client badge — circular plate billboarded at the camera, showing
          the client name's initials. Slot-ready for a real logo when a
          logoUrl is supplied. */}
      <ClientBadge
        client={prod.client || prod.summary?.split(' · ')[0] || prod.name}
        logoUrl={prod.logoUrl || null}
        accent={prod.color}
        radius={PROD_BODY_RADIUS}
      />

      {/* Production code — kept above the planet, telemetry-style */}
      <Html
        position={[0, PROD_BODY_RADIUS + 0.55, 0]}
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

// ── ClientBadge — floating circular plate near a planet showing the
// client's logo (when a logoUrl is provided) or their initials. Uses
// drei <Html> with sprite=false so it sits in 3D space and gets bloomed
// like everything else. Always faces the camera via the Billboard
// pattern (the Html element naturally renders facing the camera). ────
function ClientBadge({ client, logoUrl, accent, radius }) {
  // Initials — take the first letter of each word up to 2 letters.
  const initials = useMemo(() => {
    if (!client) return '?'
    const parts = client.trim().split(/\s+/).slice(0, 2)
    return parts.map(p => p.charAt(0).toUpperCase()).join('') || '?'
  }, [client])

  return (
    <Html
      // Slightly in front of the planet's centre on the camera-facing
      // axis. Because the rotating ring spins around y, we offset along
      // local +z so the badge sits on the side that's currently aimed at
      // the camera when this prod is the featured one.
      position={[0, 0, radius * 0.92]}
      center
      distanceFactor={radius * 9}
      zIndexRange={[50, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: logoUrl ? '#ffffff' : `radial-gradient(circle at 30% 30%, ${accent}aa, ${accent}33 60%, transparent 80%)`,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 18px ${accent}88, inset 0 0 12px rgba(0,0,0,0.4)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backdropFilter: 'blur(2px)',
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={client}
            style={{ width: '85%', height: '85%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <span
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: 1,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {initials}
          </span>
        )}
      </div>
    </Html>
  )
}

// ── Shaders for the planet body, atmosphere shell, and cloud layer.
// Inlined as strings so we don't need a build-time shader loader. All
// three use cheap value noise (FBM) so they run on every device. ───────
const FBM_SNIPPET = `
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec3(1.,0.,0.));
    float c = hash(i + vec3(0.,1.,0.));
    float d = hash(i + vec3(1.,1.,0.));
    float e1 = hash(i + vec3(0.,0.,1.));
    float f1 = hash(i + vec3(1.,0.,1.));
    float g1 = hash(i + vec3(0.,1.,1.));
    float h1 = hash(i + vec3(1.,1.,1.));
    float x1 = mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
    float x2 = mix(mix(e1,f1,f.x), mix(g1,h1,f.x), f.y);
    return mix(x1, x2, f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.07; a *= 0.5; }
    return v;
  }
`

const PLANET_VERT = `
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vLocalPos    = position;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PLANET_FRAG = `
  uniform vec3  uColor;
  uniform vec3  uDeep;
  uniform vec3  uPeak;
  uniform float uSeed;
  uniform float uEmissive;
  uniform float uTime;
  varying vec3  vWorldNormal;
  varying vec3  vLocalPos;
  ${FBM_SNIPPET}
  void main() {
    // Terrain elevation from layered noise on the sphere surface
    vec3 p = vLocalPos * 2.5 + vec3(uSeed);
    float terrain = fbm(p);
    float mountains = fbm(p * 3.0 + vec3(uTime));
    float h = terrain * 0.7 + mountains * 0.3;

    // Three-tone colour ramp: deep (oceans), mid (land), peak (highlands)
    vec3 col;
    if (h < 0.45)      col = mix(uDeep,  uColor, smoothstep(0.30, 0.45, h));
    else if (h < 0.70) col = mix(uColor, uPeak,  smoothstep(0.55, 0.70, h));
    else               col = uPeak;

    // Simple directional shading from above-front so the planet has form
    vec3 lightDir = normalize(vec3(0.6, 0.7, 0.4));
    float diffuse = max(dot(vWorldNormal, lightDir), 0.0);
    float ambient = 0.32;
    float lit = ambient + diffuse * 0.8;

    // Emissive base lets bloom catch the planet even on the dark side
    vec3 finalCol = col * lit + col * 0.15 * uEmissive;
    gl_FragColor = vec4(finalCol, 1.0);
  }
`

const CLOUD_VERT = PLANET_VERT
const CLOUD_FRAG = `
  uniform vec3  uColor;
  uniform float uSeed;
  uniform float uTime;
  varying vec3  vWorldNormal;
  varying vec3  vLocalPos;
  ${FBM_SNIPPET}
  void main() {
    vec3 p = vLocalPos * 3.5 + vec3(uSeed + uTime, 0.0, 0.0);
    float cloud = fbm(p);
    float band = smoothstep(0.55, 0.78, cloud);
    if (band < 0.02) discard;
    // Soft edge falloff so clouds blend out at high latitudes
    float lat = abs(vWorldNormal.y);
    band *= 1.0 - smoothstep(0.85, 1.0, lat);
    gl_FragColor = vec4(uColor, band * 0.55);
  }
`

const ATMOSPHERE_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal  = normalize(mat3(modelMatrix) * normal);
    vec4 wp  = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const ATMOSPHERE_FRAG = `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  void main() {
    // Fresnel — high at glancing angles, low when looking straight on.
    // We use the back face (rendered with BackSide) so the rim glow sits
    // OUTSIDE the body silhouette.
    float fres = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.5);
    gl_FragColor = vec4(uColor, fres * uOpacity);
  }
`

// ── ResourceBody — orbits its active production OR the studio core ──────────
// One body per resource regardless of commitment status. Smoothly lerps
// between HOME (orbit around studio core when idle) and AWAY (orbit around
// the active production). The "fly home" effect — watching each person
// travel between jobs as the scrubber moves — is the whole point. Brings
// the same dynamism the 2D Constellation had to the 3D scene.
function ResourceBody({ resource, targetProdPos, homeIdx, homeOf, isCommitted, isConflict, statusSpeed = 1, isClicked, onClick }) {
  const groupRef    = useRef()
  const sphereRef   = useRef()
  const conflictRef = useRef()
  const [hover, setHover] = useState(false)

  // Stable seed from the resource id so the same person always orbits the
  // same way — no reshuffling on re-render.
  const orbitSeed = useMemo(() => {
    let h = 0
    for (let i = 0; i < resource.id.length; i++) h = (h * 31 + resource.id.charCodeAt(i)) & 0xffff
    return h
  }, [resource.id])

  // Home swarm geometry — spread resources around the studio core in a
  // sphere-ish cloud. Each gets a unique radius + phase + tilt from its
  // index so the swarm looks busy, not stacked.
  const homeRadius = HOME_RADIUS_BASE + ((homeIdx % 7) / 6) * HOME_RADIUS_SPREAD
  const homeTilt   = ((homeIdx % 13) / 13 - 0.5) * 1.8

  const baseSpeed  = 0.25 + (orbitSeed % 7) * 0.04
  const phase      = (orbitSeed * 0.21) + (homeIdx * 0.83)
  const awayTilt   = ((orbitSeed % 13) / 13 - 0.5) * 0.6

  // Refs hold the current centre position (lerps between studio core and
  // the active production). Initialise at home so first paint is sensible.
  const centerRef = useRef(new THREE.Vector3(0, 0, 0))

  useFrame((state, dt) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Where should the orbit be centred RIGHT NOW?
    const desiredCenterX = targetProdPos ? targetProdPos[0] : 0
    const desiredCenterY = targetProdPos ? targetProdPos[1] : 0
    const desiredCenterZ = targetProdPos ? targetProdPos[2] : 0
    // Smooth lerp the centre — this is what produces the fly-out / fly-home
    // motion when commitments change.
    const k = Math.min(1, dt * 1.4)
    centerRef.current.x += (desiredCenterX - centerRef.current.x) * k
    centerRef.current.y += (desiredCenterY - centerRef.current.y) * k
    centerRef.current.z += (desiredCenterZ - centerRef.current.z) * k

    // Orbital offset from the (possibly mid-lerp) centre
    const a       = phase + t * baseSpeed * statusSpeed
    const radius  = isCommitted ? ORBIT_DISTANCE : homeRadius
    const tilt    = isCommitted ? awayTilt : homeTilt
    groupRef.current.position.x = centerRef.current.x + Math.cos(a) * radius
    groupRef.current.position.z = centerRef.current.z + Math.sin(a) * radius
    groupRef.current.position.y = centerRef.current.y + Math.sin(a * 0.7) * tilt

    // Hover/click scale bump for the sphere itself
    if (sphereRef.current) {
      const targetS = isClicked ? 1.6 : hover ? 1.3 : 1.0
      const cur = sphereRef.current.scale.x
      sphereRef.current.scale.setScalar(cur + (targetS - cur) * Math.min(1, dt * 8))
    }

    // Conflict pulse (existing behaviour)
    if (isConflict && conflictRef.current) {
      const pulse = 1 + Math.sin(t * 4) * 0.35
      conflictRef.current.scale.setScalar(pulse)
      if (conflictRef.current.material) {
        conflictRef.current.material.opacity = 0.18 + Math.sin(t * 4) * 0.18
      }
    }
  })

  // Idle resources are dimmer so they don't compete with the committed ones
  const emissive = isConflict ? 1.4 : (isCommitted ? 0.55 : 0.28)
  const color    = isConflict ? '#ef4444' : (resource.color || '#94a3b8')

  return (
    <group ref={groupRef}>
      <mesh
        ref={sphereRef}
        onClick={(e) => { e.stopPropagation(); onClick?.() }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
      >
        <sphereGeometry args={[RESOURCE_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      {isConflict && (
        <mesh ref={conflictRef}>
          <sphereGeometry args={[RESOURCE_RADIUS * 2.6, 16, 16]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.22} />
        </mesh>
      )}
      {/* Name label — shown on hover/click. Tiny billboard pinned just
          above the resource sphere. */}
      {(hover || isClicked) && (
        <Html
          position={[0, RESOURCE_RADIUS * 2.4, 0]}
          center
          distanceFactor={6}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.1em',
              padding: '2px 6px',
              background: 'rgba(10,12,16,0.85)',
              border: `1px solid ${color}88`,
              color: '#fff',
              whiteSpace: 'nowrap',
              boxShadow: `0 0 8px ${color}66`,
            }}
          >
            {resource.name}
            {isCommitted && (
              <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {isConflict ? 'CONFLICT' : 'BOOKED'}</span>
            )}
            {!isCommitted && (
              <span style={{ color: '#94a3b8', marginLeft: 6 }}>· IDLE</span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// ── NebulaSky — large inside-out sphere with a procedural fragment shader
// that fades between two deep colours and adds soft noise clouds. Sits
// behind everything so the void reads as "outer space with atmosphere"
// rather than pure black. ───────────────────────────────────────────────
function NebulaSky() {
  const materialRef = useRef()
  // Plug a simple shader straight into a standard mesh. Two colours
  // gradient-mixed by world y; soft FBM-ish noise on top so the sky has
  // texture instead of looking like a flat gradient.
  const uniforms = useMemo(() => ({
    uTopColor:    { value: new THREE.Color('#0a0e2a') },
    uBottomColor: { value: new THREE.Color('#1a0825') },
    uAccent:      { value: new THREE.Color('#3b1e57') },
    uTime:        { value: 0 },
  }), [])
  useFrame((state) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime * 0.04
  })
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[150, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        vertexShader={`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uTopColor;
          uniform vec3 uBottomColor;
          uniform vec3 uAccent;
          uniform float uTime;
          varying vec3 vPos;

          // Cheap value-noise approximation
          float hash(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
          }
          float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec3(1.0,0.0,0.0));
            float c = hash(i + vec3(0.0,1.0,0.0));
            float d = hash(i + vec3(1.0,1.0,0.0));
            return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
          }

          void main() {
            vec3 n = normalize(vPos);
            float t = n.y * 0.5 + 0.5;                    // 0 = bottom, 1 = top
            vec3 base = mix(uBottomColor, uTopColor, t);
            // Cloud-ish accent in the middle band
            float band = smoothstep(0.25, 0.75, t) * (1.0 - smoothstep(0.55, 0.95, t));
            float cloud = noise(n * 4.0 + vec3(uTime, 0.0, 0.0)) * 0.5
                        + noise(n * 9.0) * 0.25;
            vec3 col = base + uAccent * cloud * band * 0.45;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  )
}

// ── DustParticles — slow drifting points across the scene. Gives a sense
// of motion + depth even when nothing else is happening. Position with a
// stable seed so reloads don't reshuffle the look. ─────────────────────────
function DustParticles({ count = 600 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Random points in a thick disc around the ring — concentrate them
      // where the action is rather than out at the skybox.
      const r     = 8 + Math.random() * 18
      const theta = Math.random() * Math.PI * 2
      const y     = (Math.random() - 0.5) * 8
      arr[i * 3]     = Math.cos(theta) * r
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = Math.sin(theta) * r
    }
    return arr
  }, [count])

  const groupRef = useRef()
  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.005
  })

  return (
    <group ref={groupRef}>
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          size={0.06}
          sizeAttenuation
          depthWrite={false}
          color="#94a3b8"
          opacity={0.4}
        />
      </Points>
    </group>
  )
}

// ── TodayBeam — vertical golden pillar through the studio core whose
// brightness tracks proximity to today. Always-on visual reference for
// "where is now relative to where I'm looking." On exactly today it
// pulses, otherwise it sits steady (just dimmer the farther scrubbed). ───
function TodayBeam({ proximity, isToday }) {
  const innerRef = useRef()
  useFrame((state) => {
    if (!innerRef.current?.material) return
    if (isToday) {
      const pulse = 0.55 + Math.sin(state.clock.elapsedTime * 2.5) * 0.25
      innerRef.current.material.opacity = pulse
    } else {
      innerRef.current.material.opacity = 0.18 + proximity * 0.32
    }
  })
  if (proximity <= 0 && !isToday) return null
  return (
    <group position={[0, 0, 0]}>
      {/* Wide soft outer pillar — the bloom */}
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 40, 16, 1, true]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.08 + proximity * 0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Sharp inner pillar — the core */}
      <mesh ref={innerRef}>
        <cylinderGeometry args={[0.045, 0.045, 40, 8]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* TODAY label above the studio core, billboarded by Html */}
      <Html position={[0, 1.6, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.22em',
            color: '#fde68a',
            textShadow: '0 0 6px rgba(0,0,0,0.9)',
            opacity: isToday ? 1 : 0.45 + proximity * 0.55,
          }}
        >
          TODAY
        </div>
      </Html>
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
