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

  // Speed scales every animation duration via --fx-speed; intensity dims the
  // whole layer via container opacity. Defaults keep the login page (rendered
  // without the provider) at the tuned look.
  const speed = ctx?.speed ?? 1
  const intensity = ctx?.intensity ?? 1

  return (
    <div className="bgfx" aria-hidden="true" style={{ opacity: intensity, '--fx-speed': speed }}>
      {preset === 'orbit'     && <OrbitLayer />}
      {preset === 'emblem'    && <EmblemLayer />}
      {preset === 'wave'      && <LogoWaveLayer />}
      {preset === 'flip'      && <LogoFlipLayer />}
      {preset === 'starfield' && <StarfieldLayer />}
      {preset === 'grid'      && <GridLayer />}
      {preset === 'aurora'    && <AuroraLayer />}
      {preset === 'image'     && <ImageLayer src={ctx?.customImage} />}
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

// The mark field is shared by both logo presets — 9×6 grid of small marks.
const WAVE_COLS = 9
const WAVE_ROWS = 6

// ── Logo Wave — a flip wave rolls through diagonally. Delay = (col + row)
//    stagger plus a deterministic per-cell jitter so the front reads organic,
//    not mechanical. Base delays are emitted as --d and scaled by --fx-speed
//    in CSS, so the speed slider never re-renders this tree.
function LogoWaveLayer() {
  const cells = []
  for (let row = 0; row < WAVE_ROWS; row++) {
    for (let col = 0; col < WAVE_COLS; col++) {
      const i = row * WAVE_COLS + col
      const jitter = ((i * 7919) % 97) / 97
      const delay = (col + row) * 0.55 + jitter * 0.6
      cells.push(
        <div key={i} className="bgfx-wave-cell">
          <div className="bgfx-wave-mark" style={{ '--d': `${delay.toFixed(2)}s` }}>
            <OrbitalMark size={30} gradient={false} style={{ width: '100%', height: 'auto' }} />
          </div>
        </div>
      )
    }
  }
  return <div className="bgfx-wave">{cells}</div>
}

// ── Logo Flip — same field, but each mark flips on its own clock. Two
//    decorrelated hashes give an uncoupled delay + cycle length per cell, so
//    only one or another is ever mid-flip — no travelling front.
function LogoFlipLayer() {
  const cells = []
  const total = WAVE_COLS * WAVE_ROWS
  for (let i = 0; i < total; i++) {
    const hDelay = ((i * 7919) % 101) / 101
    const hDur = ((i * 104729) % 89) / 89
    const delay = (hDelay * 8).toFixed(2)      // spread across an ~8s window
    const dur = (5.5 + hDur * 4).toFixed(2)    // 5.5–9.5s independent cycles
    cells.push(
      <div key={i} className="bgfx-wave-cell">
        <div className="bgfx-flip-mark" style={{ '--d': `${delay}s`, '--dur': `${dur}s` }}>
          <OrbitalMark size={30} gradient={false} style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>
    )
  }
  return <div className="bgfx-wave">{cells}</div>
}

// ── Image — the user's own photo, cover-fit, behind a theme-aware scrim so
//    text and glass cards stay readable on any picture. The intensity slider
//    still dims the whole layer toward the flat theme canvas.
function ImageLayer({ src }) {
  if (!src) return null
  return (
    <>
      <div className="bgfx-image" style={{ backgroundImage: `url(${src})` }} />
      <div className="bgfx-image-scrim" />
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
