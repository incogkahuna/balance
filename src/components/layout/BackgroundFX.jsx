// ─── BackgroundFX — the ambient layer behind every page ─────────────────────
// Elegant geometry only: hairline orbital rings, drifting star specks, a
// receding stage grid, or a soft brand-blue wash. Pure CSS animation (defined
// in index.css under BACKGROUND FX), theme-aware via the --fx-* custom
// properties, and user-selectable via BackgroundContext / the account menu.

import { useBackground } from '../../context/BackgroundContext.jsx'
import { OrbitalMark } from '../brand/OrbitalLogo.jsx'

export function BackgroundFX({ preset: forced }) {
  const ctx = safeBackground()
  const preset = forced || ctx?.background || 'orbit'
  if (preset === 'none') return null

  return (
    <div className="bgfx" aria-hidden="true">
      {preset === 'orbit'     && <OrbitLayer />}
      {preset === 'starfield' && <StarfieldLayer />}
      {preset === 'grid'      && <GridLayer />}
      {preset === 'aurora'    && <AuroraLayer />}
    </div>
  )
}

// The login page renders outside providers in some flows — degrade gracefully.
function safeBackground() {
  try { return useBackground() } catch { return null }
}

// ── Orbit — the signature preset. A ring system anchored off the top-right
//    corner, echoing the emblem's broken-ring geometry, with a satellite dot
//    riding the middle ring and a giant ultra-faint watermark low-left.
function OrbitLayer() {
  const rings = [
    { size: '58vmax', cls: 'bgfx-spin-slow',   dashed: false, sat: true  },
    { size: '78vmax', cls: 'bgfx-spin-slower', dashed: true,  sat: false },
    { size: '98vmax', cls: 'bgfx-spin-slow',   dashed: false, sat: false },
  ]
  return (
    <>
      {rings.map((r, i) => (
        <div
          key={i}
          className={`bgfx-ring ${r.dashed ? 'bgfx-ring--dashed' : ''} ${r.cls}`}
          style={{
            width: r.size,
            height: r.size,
            top: `calc(-0.42 * ${r.size})`,
            right: `calc(-0.36 * ${r.size})`,
          }}
        >
          {r.sat && <div className="bgfx-sat" />}
        </div>
      ))}
      {/* faint far stars behind the rings */}
      <div className="bgfx-stars bgfx-stars--far" />
      {/* emblem watermark, low-left, barely there */}
      <div className="bgfx-watermark" style={{ left: '-6vmax', bottom: '-9vmax' }}>
        <OrbitalMark size={Math.max(320, 0.42 * (typeof window !== 'undefined' ? window.innerHeight : 800))} gradient={false} className="text-orbital-text" />
      </div>
    </>
  )
}

function StarfieldLayer() {
  return (
    <>
      <div className="bgfx-stars bgfx-stars--far" />
      <div className="bgfx-stars" />
    </>
  )
}

function GridLayer() {
  return (
    <>
      <div className="bgfx-horizon" />
      <div className="bgfx-grid" />
      <div className="bgfx-stars bgfx-stars--far" style={{ bottom: '40%' }} />
    </>
  )
}

function AuroraLayer() {
  return (
    <>
      <div className="bgfx-blob bgfx-blob--a" />
      <div className="bgfx-blob bgfx-blob--b" />
      <div className="bgfx-stars bgfx-stars--far" />
    </>
  )
}
