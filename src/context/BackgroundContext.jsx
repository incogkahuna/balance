import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─── Background preference ───────────────────────────────────────────────────
// Which ambient backdrop the app renders behind every page. Persisted per
// browser (moves to the profile row when user settings land server-side).
// Presets are defined/rendered in components/layout/BackgroundFX.jsx.

const BackgroundContext = createContext(null)

const STORAGE_KEY = 'balance_bg_v1'
export const BACKGROUND_PRESETS = [
  { id: 'orbit',     label: 'Orbit',     hint: 'Slow orbital ring system' },
  { id: 'emblem',    label: 'Emblem',    hint: 'Monumental centered mark' },
  { id: 'wave',      label: 'Logo Wave', hint: 'Mark field, rolling flip wave' },
  { id: 'starfield', label: 'Starfield', hint: 'Drifting star specks' },
  { id: 'grid',      label: 'Grid',      hint: 'Perspective stage grid' },
  { id: 'aurora',    label: 'Aurora',    hint: 'Soft nebula color wash' },
  { id: 'none',      label: 'Minimal',   hint: 'Clean flat canvas' },
]

export function BackgroundProvider({ children }) {
  const [background, setBackgroundState] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return BACKGROUND_PRESETS.some(p => p.id === stored) ? stored : 'orbit'
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, background) } catch { /* private mode */ }
  }, [background])

  const setBackground = useCallback((id) => {
    if (BACKGROUND_PRESETS.some(p => p.id === id)) setBackgroundState(id)
  }, [])

  return (
    <BackgroundContext.Provider value={{ background, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const ctx = useContext(BackgroundContext)
  if (!ctx) throw new Error('useBackground must be used inside BackgroundProvider')
  return ctx
}
