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
const IMAGE_KEY = 'balance_bg_image_v1'          // legacy single image (imported into the library)
const IMAGES_KEY = 'balance_bg_images_v1'        // [{id, dataUrl}] library
const SELECTED_IMAGE_KEY = 'balance_bg_image_sel_v1'
const PAGES_KEY = 'balance_bg_pages_v1'          // { '/tasks': 'aurora' | 'image:<id>' }

// Library cap — images live in localStorage (~5MB quota); six 1600px JPEGs
// fit comfortably. Server-side storage can lift this later.
export const BG_LIBRARY_MAX = 6

export const BACKGROUND_PRESETS = [
  { id: 'orbit',     label: 'Orbit',     hint: 'Slow orbital ring system' },
  { id: 'emblem',    label: 'Emblem',    hint: 'Monumental centered mark' },
  { id: 'wave',      label: 'Logo Wave', hint: 'Mark field, rolling flip wave' },
  { id: 'flip',      label: 'Logo Flip', hint: 'Marks flip at random' },
  { id: 'starfield', label: 'Starfield', hint: 'Drifting star specks' },
  { id: 'grid',      label: 'Grid',      hint: 'Perspective stage grid' },
  { id: 'aurora',    label: 'Aurora',    hint: 'Soft nebula color wash' },
  { id: 'image',     label: 'Image',     hint: 'Your own backdrop photo' },
  { id: 'none',      label: 'Minimal',   hint: 'Clean flat canvas' },
]

// Downscale + recompress an uploaded image so it fits comfortably inside the
// localStorage quota (a 1920px JPEG lands around 200-500KB as a dataURL).
// Server-side storage can replace this when user settings move to the profile.
// Compress an image File/Blob to a JPEG data URL. Options let callers trade
// size for fidelity — backdrops want big+crisp (default), feedback screenshots
// want small enough to sit in a DB text column.
export function fileToBackdropDataUrl(file, { max = 1920, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Pick an image file (JPG, PNG, WebP…)'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Couldn't read that image"))
    }
    img.src = url
  })
}

// Slider bounds — shared by the clamp below and the account-menu UI.
export const BG_SPEED     = { min: 0.3,  max: 2,   step: 0.1,  default: 1 }
export const BG_INTENSITY = { min: 0.15, max: 1,   step: 0.05, default: 1 }

const clamp = (raw, { min, max, default: dflt }) => {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

export function BackgroundProvider({ children }) {
  // ── Image LIBRARY (Danny's request: multiple backdrops + per-page picks) ──
  // Legacy single-image installs import their photo as the first entry.
  const [images, setImagesState] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(IMAGES_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed)) return parsed.filter(i => i?.id && i?.dataUrl?.startsWith('data:image/'))
    } catch { /* fall through */ }
    const legacy = localStorage.getItem(IMAGE_KEY)
    if (legacy && legacy.startsWith('data:image/')) {
      return [{ id: 'legacy', dataUrl: legacy }]
    }
    return []
  })
  const [selectedImageId, setSelectedImageIdState] = useState(() => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(SELECTED_IMAGE_KEY)
    return stored || (localStorage.getItem(IMAGE_KEY) ? 'legacy' : null)
  })
  // Per-page overrides: { '/tasks': presetId | 'image:<id>' }
  const [pageBackgrounds, setPageBackgroundsState] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(PAGES_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch { return {} }
  })

  // The globally-selected image (drives the 'image' preset); kept under the
  // old `customImage` name so existing UI (thumbs, account page) keeps working.
  const customImage = images.find(i => i.id === selectedImageId)?.dataUrl
    || images[0]?.dataUrl
    || null
  const [background, setBackgroundState] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!BACKGROUND_PRESETS.some(p => p.id === stored)) return 'orbit'
    // 'image' with no stored photo (cleared storage, new browser) → default
    if (stored === 'image'
        && !localStorage.getItem(IMAGES_KEY)
        && !localStorage.getItem(IMAGE_KEY)) return 'orbit'
    return stored
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

  useEffect(() => {
    try { localStorage.setItem(IMAGES_KEY, JSON.stringify(images)) } catch { /* quota */ }
  }, [images])
  useEffect(() => {
    try {
      if (selectedImageId) localStorage.setItem(SELECTED_IMAGE_KEY, selectedImageId)
      else localStorage.removeItem(SELECTED_IMAGE_KEY)
    } catch { /* private mode */ }
  }, [selectedImageId])
  useEffect(() => {
    try { localStorage.setItem(PAGES_KEY, JSON.stringify(pageBackgrounds)) } catch { /* private mode */ }
  }, [pageBackgrounds])

  // ── Library mutators ──────────────────────────────────────────────────────
  // addImage persists-or-throws: a QuotaExceededError must surface to the UI
  // (toast) instead of silently keeping an image that won't survive a reload.
  const addImage = useCallback((dataUrl) => {
    const id = crypto.randomUUID()
    const next = [...images, { id, dataUrl }].slice(-BG_LIBRARY_MAX)
    localStorage.setItem(IMAGES_KEY, JSON.stringify(next)) // throw before state
    setImagesState(next)
    setSelectedImageIdState(id)
    return id
  }, [images])

  const removeImage = useCallback((id) => {
    setImagesState(prev => {
      const next = prev.filter(i => i.id !== id)
      if (next.length === 0) setBackgroundState(bg => (bg === 'image' ? 'orbit' : bg))
      return next
    })
    setSelectedImageIdState(sel => (sel === id ? null : sel))
    // Drop any page assignment pointing at the removed image.
    setPageBackgroundsState(prev => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (next[k] === `image:${id}`) delete next[k]
      }
      return next
    })
  }, [])

  const selectImage = useCallback((id) => {
    setSelectedImageIdState(id)
    setBackgroundState('image')
  }, [])

  // Back-compat shims for existing UI (account menu/page single-image flow).
  const setCustomImage = useCallback((dataUrl) => { addImage(dataUrl) }, [addImage])
  const clearCustomImage = useCallback(() => {
    setImagesState(prev => {
      const sel = selectedImageId || prev[0]?.id
      return prev.filter(i => i.id !== sel)
    })
    setSelectedImageIdState(null)
    setBackgroundState(bg => (bg === 'image' ? 'orbit' : bg))
  }, [selectedImageId])

  // ── Per-page assignment ───────────────────────────────────────────────────
  // key = top-level path ('/tasks'); value = presetId or 'image:<id>'; delete
  // by assigning 'default'.
  const setPageBackground = useCallback((pathKey, spec) => {
    setPageBackgroundsState(prev => {
      const next = { ...prev }
      if (!spec || spec === 'default') delete next[pathKey]
      else next[pathKey] = spec
      return next
    })
  }, [])

  // Resolve what to render for a pathname: page override → global setting.
  // Returns { preset, imageSrc }.
  const resolveForPath = useCallback((pathname) => {
    const topLevel = '/' + (pathname || '').split('/').filter(Boolean)[0]
    const spec = pageBackgrounds[topLevel]
    const fromSpec = (s) => {
      if (s?.startsWith('image:')) {
        const img = images.find(i => i.id === s.slice(6))
        return img ? { preset: 'image', imageSrc: img.dataUrl } : null
      }
      if (BACKGROUND_PRESETS.some(p => p.id === s)) {
        return { preset: s, imageSrc: s === 'image' ? customImage : null }
      }
      return null
    }
    return (spec && fromSpec(spec))
      || { preset: background, imageSrc: background === 'image' ? customImage : null }
  }, [pageBackgrounds, images, background, customImage])

  return (
    <BackgroundContext.Provider value={{
      background, setBackground, speed, setSpeed, intensity, setIntensity,
      customImage, setCustomImage, clearCustomImage,
      images, addImage, removeImage, selectImage, selectedImageId,
      pageBackgrounds, setPageBackground, resolveForPath,
    }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const ctx = useContext(BackgroundContext)
  if (!ctx) throw new Error('useBackground must be used inside BackgroundProvider')
  return ctx
}
