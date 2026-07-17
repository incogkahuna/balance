// ─── AccountMenu — avatar → identity, appearance, session ───────────────────
// The user's corner of the app: who they are, how it looks (theme + ambient
// background), and the way out. First pass of the profile/settings surface —
// grows into the full account page later.

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useBackground, BACKGROUND_PRESETS, BG_SPEED, BG_INTENSITY } from '../../context/BackgroundContext.jsx'
import { OrbitalMark } from '../brand/OrbitalLogo.jsx'
import clsx from 'clsx'

const ROLE_LABEL = { admin: 'Admin', supervisor: 'Supervisor', crew: 'Crew' }

export function AccountMenu() {
  const { currentUser, logout } = useApp()
  const { theme, toggleTheme } = useTheme()
  const { background, setBackground, speed, setSpeed, intensity, setIntensity } = useBackground()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!currentUser) return null

  return (
    <div className="relative" ref={panelRef}>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ml-1 mr-2 transition-shadow',
          open && 'ring-2 ring-offset-2'
        )}
        style={{
          backgroundColor: currentUser.color,
          '--tw-ring-color': 'var(--accent-ring)',
          '--tw-ring-offset-color': 'var(--orbital-sidebar-bg)',
        }}
        title={`${currentUser.name} · ${ROLE_LABEL[currentUser.role] || 'Crew'}`}
      >
        {currentUser.avatar}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-2 top-11 w-72 card-elevated animate-hud-in z-50"
          style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.45)' }}
        >
          {/* Identity */}
          <div className="flex items-center gap-3 p-4 border-b border-orbital-border">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-orbital-text truncate">{currentUser.name}</p>
              <p className="text-xs text-orbital-subtle truncate">{currentUser.email}</p>
            </div>
            <span
              className="text-[10px] font-telemetry tracking-widest uppercase px-2 py-1 flex-shrink-0"
              style={{ color: 'var(--accent-bright)', background: 'var(--accent-soft)', border: '1px solid var(--accent-ring)' }}
            >
              {ROLE_LABEL[currentUser.role] || 'Crew'}
            </span>
          </div>

          {/* Theme */}
          <div className="p-4 border-b border-orbital-border">
            <p className="hud-label text-[10px] mb-2.5">Theme</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'dark',  label: 'Dark',  icon: Moon },
                { id: 'light', label: 'Light', icon: Sun  },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => theme !== id && toggleTheme()}
                  className={clsx(
                    'flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border transition-all',
                    theme === id
                      ? 'text-orbital-text'
                      : 'border-orbital-border text-orbital-subtle hover:text-orbital-text hover:border-orbital-chrome'
                  )}
                  style={theme === id ? { borderColor: 'var(--accent-ring)', background: 'var(--accent-soft)' } : {}}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ambient background */}
          <div className="p-4 border-b border-orbital-border">
            <p className="hud-label text-[10px] mb-2.5">Backdrop</p>
            <div className="grid grid-cols-4 gap-1.5">
              {BACKGROUND_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setBackground(p.id)}
                  title={p.hint}
                  className={clsx(
                    'relative aspect-square border transition-all overflow-hidden group',
                    background === p.id
                      ? ''
                      : 'border-orbital-border hover:border-orbital-chrome'
                  )}
                  style={{
                    background: 'var(--orbital-muted)',
                    ...(background === p.id ? { borderColor: 'var(--accent-bright)' } : {}),
                  }}
                >
                  <PresetThumb id={p.id} />
                  {background === p.id && (
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(85,201,239,0.12)' }}
                    >
                      <Check size={12} style={{ color: 'var(--accent-bright)' }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-orbital-dim mt-2">
              {BACKGROUND_PRESETS.find(p => p.id === background)?.label} — {BACKGROUND_PRESETS.find(p => p.id === background)?.hint}
            </p>
          </div>

          {/* Motion tuning — only meaningful when a backdrop is showing */}
          {background !== 'none' && (
            <div className="p-4 border-b border-orbital-border">
              <FxSlider
                label="Speed" valueLabel={`${speed.toFixed(1)}×`}
                min={BG_SPEED.min} max={BG_SPEED.max} step={BG_SPEED.step}
                value={speed} onChange={setSpeed}
              />
              <div className="h-3" />
              <FxSlider
                label="Intensity" valueLabel={`${Math.round(intensity * 100)}%`}
                min={BG_INTENSITY.min} max={BG_INTENSITY.max} step={BG_INTENSITY.step}
                value={intensity} onChange={setIntensity}
              />
            </div>
          )}

          {/* Session */}
          <div className="p-2">
            <button
              onClick={() => { setOpen(false); logout(); navigate('/login') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orbital-subtle hover:text-orbital-text transition-colors"
              style={{ borderRadius: 2 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-ghost-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>

          {/* Brand foot */}
          <div className="flex items-center justify-center gap-2 pb-3 pt-1 opacity-40">
            <OrbitalMark size={11} gradient={false} className="text-orbital-subtle" />
            <span className="text-[9px] font-telemetry tracking-[0.3em] text-orbital-subtle">ORBITAL STUDIOS</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Labelled range control for the backdrop's speed / intensity.
function FxSlider({ label, valueLabel, min, max, step, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="hud-label text-[10px]">{label}</p>
        <span className="text-[10px] font-telemetry text-orbital-subtle">{valueLabel}</span>
      </div>
      <input
        type="range"
        className="fx-slider"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
    </div>
  )
}

// Miniature representation of each backdrop preset — pure CSS, no images.
function PresetThumb({ id }) {
  if (id === 'orbit') {
    return (
      <span className="absolute inset-0">
        <span className="absolute rounded-full border" style={{ width: '130%', height: '130%', top: '-70%', right: '-60%', borderColor: 'var(--accent-ring)' }} />
        <span className="absolute rounded-full border border-dashed" style={{ width: '190%', height: '190%', top: '-105%', right: '-95%', borderColor: 'var(--accent-soft)' }} />
      </span>
    )
  }
  if (id === 'emblem') {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <OrbitalMark size={20} gradient={false} style={{ color: 'var(--accent-bright)', opacity: 0.85 }} />
      </span>
    )
  }
  if (id === 'wave') {
    return (
      <span className="absolute inset-0 grid grid-cols-3 place-items-center p-1">
        {[0.9, 0.4, 0.3, 0.4, 0.9, 0.4, 0.3, 0.4, 0.9].map((op, i) => (
          <OrbitalMark key={i} size={7} gradient={false} style={{ color: 'var(--accent-bright)', opacity: op }} />
        ))}
      </span>
    )
  }
  if (id === 'flip') {
    return (
      <span className="absolute inset-0 grid grid-cols-3 place-items-center p-1">
        {[0.3, 0.95, 0.3, 0.3, 0.3, 0.9, 0.85, 0.3, 0.3].map((op, i) => (
          <OrbitalMark key={i} size={7} gradient={false} style={{ color: 'var(--accent-bright)', opacity: op }} />
        ))}
      </span>
    )
  }
  if (id === 'starfield') {
    return (
      <span className="absolute inset-0">
        {[[20, 30], [60, 15], [40, 60], [75, 70], [15, 75]].map(([x, y], i) => (
          <span key={i} className="absolute rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: 2, height: 2, background: 'var(--accent-bright)', opacity: 0.7 }} />
        ))}
      </span>
    )
  }
  if (id === 'grid') {
    return (
      <span
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          backgroundImage: 'linear-gradient(var(--accent-soft) 1px, transparent 1px), linear-gradient(90deg, var(--accent-soft) 1px, transparent 1px)',
          backgroundSize: '6px 6px',
          transform: 'perspective(40px) rotateX(50deg)',
          transformOrigin: '50% 100%',
        }}
      />
    )
  }
  if (id === 'aurora') {
    return (
      <span className="absolute inset-0">
        <span className="absolute rounded-full" style={{ width: '80%', height: '80%', left: '-20%', top: '-20%', background: 'var(--accent-soft)', filter: 'blur(6px)' }} />
        <span className="absolute rounded-full" style={{ width: '80%', height: '80%', right: '-20%', bottom: '-20%', background: 'rgba(42,123,187,0.25)', filter: 'blur(6px)' }} />
      </span>
    )
  }
  return null // 'none' — clean tile
}
