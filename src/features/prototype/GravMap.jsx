import { useMemo, useRef, useState, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { format } from 'date-fns'
import { useApp } from '../../context/AppContext.jsx'
import { MiniCalendar } from '../../components/ui/MiniCalendar.jsx'
import { ProductionQuickView } from '../../components/productions/ProductionQuickView.jsx'
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

      {/* Rich quick-view popup — same modal used by Productions cards on
          mobile + Gantt bar clicks. Renders outside the canvas wrapper
          so the modal overlays the whole page (not just the 3D area). */}
      <ProductionQuickView
        production={clickedFullProd}
        conflicts={clickedConflicts}
        onClose={() => setClickedProd(null)}
        onOpenFull={() => {
          const id = clickedProd
          setClickedProd(null)
          if (id) navigate(`/productions/${id}`)
        }}
      />
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
