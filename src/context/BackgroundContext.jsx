import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─── Background preference ───────────────────────────────────────────────────
// Which ambient backdrop the app renders behind every page, plus how fast it
// moves and how strongly it reads. Persisted per browser (moves to the profile
// row when user settings land server-side). Presets are defined/rendered in
// components/layout/BackgroundFX.jsx; speed/intensity are applied there as the
// --fx-speed custom property and container opacity.

const BackgroundContext = createContext(null)

const STORAGE_KEY = 'balance_bg_v1'
const SPEED_KEY = 'balance_bg_speed_v1'
const INTENSITY_KEY = 'balance_bg_intensity_v1'

export const BACKGROUND_PRESETS = [
  { id: 'orbit',     label: 'Orbit',     hint: 'Slow orbital ring system' },
  { id: 'emblem',    label: 'Emblem',    hint: 'Monumental centered mark' },
  { id: 'wave',      label: 'Logo Wave', hint: 'Mark field, rolling flip wave' },
  { id: 'flip',      label: 'Logo Flip', hint: 'Marks flip at random' },
  { id: 'starfield', label: 'Starfield', hint: 'Drifting star specks' },
  { id: 'grid',      label: 'Grid',      hint: 'Perspective stage grid' },
  { id: 'aurora',    label: 'Aurora',    hint: 'Soft nebula color wash' },
  { id: 'none',      label: 'Minimal',   hint: 'Clean flat canvas' },
]

// Slider bounds — shared by the clamp below and the account-menu UI.
export const BG_SPEED     = { min: 0.3,  max: 2,   step: 0.1,  default: 1 }
export const BG_INTENSITY = { min: 0.15, max: 1,   step: 0.05, default: 1 }

const clamp = (raw, { min, max, default: dflt }) => {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

export function BackgroundProvider({ children }) {
  const [background, setBackgroundState] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return BACKGROUND_PRESETS.some(p => p.id === stored) ? stored : 'orbit'
  })
  const [speed, setSpeedState] = useState(() =>
    clamp(typeof window !== 'undefined' ? localStorage.getItem(SPEED_KEY) : null, BG_SPEED))
  const [intensity, setIntensityState] = useState(() =>
    clamp(typeof window !== 'undefined' ? localStorage.getItem(INTENSITY_KEY) : null, BG_INTENSITY))

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, background) } catch { /* private mode */ }
  }, [background])
  useEffect(() => {
    try { localStorage.setItem(SPEED_KEY, String(speed)) } catch { /* private mode */ }
  }, [speed])
  useEffect(() => {
    try { localStorage.setItem(INTENSITY_KEY, String(intensity)) } catch { /* private mode */ }
  }, [intensity])

  const setBackground = useCallback((id) => {
    if (BACKGROUND_PRESETS.some(p => p.id === id)) setBackgroundState(id)
  }, [])
  const setSpeed = useCallback((v) => setSpeedState(clamp(v, BG_SPEED)), [])
  const setIntensity = useCallback((v) => setIntensityState(clamp(v, BG_INTENSITY)), [])

  return (
    <BackgroundContext.Provider value={{ background, setBackground, speed, setSpeed, intensity, setIntensity }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const ctx = useContext(BackgroundContext)
  if (!ctx) throw new Error('useBackground must be used inside BackgroundProvider')
  return ctx
}
