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
      {preset === 'emblem'    && <EmblemLayer />}
      {preset === 'wave'      && <LogoWaveLayer />}
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
      {/* brand wash anchoring the ring system to its corner */}
      <div className="bgfx-corner-glow" />
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
      {/* far stars behind the rings */}
      <div className="bgfx-stars bgfx-stars--far" />
      {/* emblem watermark, low-left — sized/positioned in CSS so it reads */}
      <div className="bgfx-watermark">
        <OrbitalMark size={320} style={{ width: '100%', height: 'auto' }} />
      </div>
    </>
  )
}

// ── Emblem — one monumental centered mark. The brand, stated plainly. ────────
function EmblemLayer() {
  return (
    <>
      <div className="bgfx-stars bgfx-stars--far" />
      <div className="bgfx-emblem">
        <div className="bgfx-emblem-halo" />
        <div className="bgfx-emblem-mark">
          <OrbitalMark size={480} style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>
    </>
  )
}

// ── Logo Wave — a field of small marks; a flip wave rolls through diagonally.
//    Delay = (col + row) stagger plus a deterministic per-cell jitter so the
//    front reads organic, not mechanical.
const WAVE_COLS = 9
const WAVE_ROWS = 6
function LogoWaveLayer() {
  const cells = []
  for (let row = 0; row < WAVE_ROWS; row++) {
    for (let col = 0; col < WAVE_COLS; col++) {
      const i = row * WAVE_COLS + col
      const jitter = ((i * 7919) % 97) / 97
      const delay = (col + row) * 0.32 + jitter * 0.45
      cells.push(
        <div key={i} className="bgfx-wave-cell">
          <div className="bgfx-wave-mark" style={{ animationDelay: `${delay}s` }}>
            <OrbitalMark size={30} gradient={false} style={{ width: '100%', height: 'auto' }} />
          </div>
        </div>
      )
    }
  }
  return <div className="bgfx-wave">{cells}</div>
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
