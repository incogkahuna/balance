// ─── AccountPage — the full profile & preferences surface (#21 v2) ───────────
// Grows the AccountMenu quick panel into a real page: identity edits that
// persist to the profiles row (name, accent color — allowed by the
// profiles_update_own RLS policy), the complete appearance kit (theme,
// backdrop presets incl. custom image upload, motion tuning), and session
// info. The quick menu stays for fast switches; this is the settled home.

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon, Check, ImagePlus, Loader2, Trash2, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useBackground, BACKGROUND_PRESETS, BG_SPEED, BG_INTENSITY, BG_LIBRARY_MAX } from '../context/BackgroundContext.jsx'
import { PresetThumb, FxSlider, applyBackdropFile } from '../components/layout/AccountMenu.jsx'
import { OrbitalMark } from '../components/brand/OrbitalLogo.jsx'
import clsx from 'clsx'

const ROLE_LABEL = { admin: 'Admin', supervisor: 'Supervisor', crew: 'Crew' }

// Same curated palette the Team page offers for new members.
const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#a78bfa',
]

// Pages that can carry their own backdrop (top-level route → label).
const ASSIGNABLE_PAGES = [
  { path: '/dashboard',   label: 'Dashboard' },
  { path: '/tasks',       label: 'Tasks' },
  { path: '/productions', label: 'Productions' },
  { path: '/schedule',    label: 'Schedule' },
  { path: '/resources',   label: 'Resources' },
  { path: '/pipeline',    label: 'Pipeline' },
  { path: '/gear',        label: 'Gear' },
  { path: '/team',        label: 'Team' },
  { path: '/contractors', label: 'Contractors' },
  { path: '/analytics',   label: 'Analytics' },
  { path: '/feedback',    label: 'Bugs & Ideas' },
  { path: '/account',     label: 'Account' },
]

export function AccountPage() {
  const { currentUser, logout } = useApp()
  const { profile, updateProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const {
    background, setBackground, speed, setSpeed, intensity, setIntensity,
    customImage, setCustomImage, clearCustomImage,
    images, removeImage, selectImage, selectedImageId,
    pageBackgrounds, setPageBackground,
  } = useBackground()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  // Identity edits are staged locally and saved explicitly — no save-on-every-
  // keystroke against the profiles table.
  const [name, setName] = useState(profile?.name || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setName(profile?.name || '') }, [profile?.name])

  const canEdit = !!profile && !currentUser?.isDevImpersonation
  const nameDirty = canEdit && name.trim() && name.trim() !== profile.name

  const saveName = async () => {
    if (!nameDirty || saving) return
    setSaving(true)
    try {
      await updateProfile({ name: name.trim() })
      toast.success('Display name updated')
    } catch (err) {
      toast.error(`Couldn't save name — ${err?.message || 'unknown error'}`)
      setName(profile?.name || '')
    } finally {
      setSaving(false)
    }
  }

  const saveColor = async (color) => {
    if (!canEdit || color === profile.color) return
    try {
      await updateProfile({ color })
      toast.success('Accent color updated')
    } catch (err) {
      toast.error(`Couldn't save color — ${err?.message || 'unknown error'}`)
    }
  }

  if (!currentUser) return null
  const displayColor = profile?.color || currentUser.color
  const displayName = canEdit ? (profile.name || currentUser.name) : currentUser.name

  return (
    <div className="px-4 lg:px-6 py-5 max-w-3xl mx-auto">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.25em] mb-1">
          ACCOUNT · ORBITAL STUDIOS
        </p>
        <h1 className="text-base font-semibold text-orbital-text">Account</h1>
      </div>

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section className="card-elevated p-5 mb-4">
        <p className="hud-label text-[10px] mb-4">Identity</p>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ backgroundColor: displayColor }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <label className="hud-label text-[10px] block mb-1.5" htmlFor="account-name">Display name</label>
              <div className="flex gap-2">
                <input
                  id="account-name"
                  className="input flex-1"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                  disabled={!canEdit}
                  placeholder="Your name"
                />
                {nameDirty && (
                  <button className="btn-primary text-xs px-4" onClick={saveName} disabled={saving}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="hud-label text-[10px] mb-1">Email</p>
                <p className="text-sm text-orbital-text">{currentUser.email}</p>
              </div>
              <div>
                <p className="hud-label text-[10px] mb-1">Role</p>
                <span
                  className="text-[10px] font-telemetry tracking-widest uppercase px-2 py-1 inline-block"
                  style={{ color: 'var(--accent-bright)', background: 'var(--accent-soft)', border: '1px solid var(--accent-ring)' }}
                >
                  {ROLE_LABEL[currentUser.role] || 'Crew'}
                </span>
              </div>
            </div>
            <div>
              <p className="hud-label text-[10px] mb-1.5">Accent color</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => saveColor(c)}
                    disabled={!canEdit}
                    aria-label={`Accent color ${c}`}
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-transform',
                      canEdit && 'hover:scale-110',
                    )}
                    style={{
                      backgroundColor: c,
                      boxShadow: displayColor === c ? '0 0 0 2px var(--orbital-bg), 0 0 0 4px var(--accent-bright)' : 'none',
                    }}
                  >
                    {displayColor === c && <Check size={13} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            {!canEdit && (
              <p className="text-[11px] text-orbital-dim">
                {currentUser?.isDevImpersonation
                  ? 'Viewing as another user — identity edits are disabled.'
                  : 'Sign in with a real session to edit your profile.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <section className="card-elevated p-5 mb-4">
        <p className="hud-label text-[10px] mb-4">Appearance</p>

        {/* Theme */}
        <p className="hud-label text-[10px] mb-2">Theme</p>
        <div className="grid grid-cols-2 gap-1.5 max-w-xs mb-5">
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

        {/* Backdrop */}
        <p className="hud-label text-[10px] mb-2">Backdrop</p>
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) applyBackdropFile(file, { setCustomImage, setBackground, toast })
          }}
        />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-lg">
          {BACKGROUND_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => {
                if (p.id === 'image' && !customImage) fileRef.current?.click()
                else setBackground(p.id)
              }}
              title={p.id === 'image' && !customImage ? 'Upload a backdrop photo' : p.hint}
              className={clsx(
                'relative aspect-square border transition-all overflow-hidden group',
                background === p.id ? '' : 'border-orbital-border hover:border-orbital-chrome'
              )}
              style={{
                background: 'var(--orbital-muted)',
                ...(background === p.id ? { borderColor: 'var(--accent-bright)' } : {}),
              }}
            >
              <PresetThumb id={p.id} image={customImage} />
              {background === p.id && (
                <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(85,201,239,0.12)' }}>
                  <Check size={12} style={{ color: 'var(--accent-bright)' }} />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 text-center text-[9px] font-telemetry tracking-wider py-0.5 text-orbital-subtle" style={{ background: 'var(--modal-overlay)' }}>
                {p.label}
              </span>
            </button>
          ))}
        </div>

        {/* Custom image management */}
        {customImage && (
          <div className="flex items-center gap-2 mt-3">
            <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => fileRef.current?.click()}>
              <RefreshCw size={12} /> Replace photo
            </button>
            <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => { clearCustomImage(); toast.info('Backdrop image removed') }}>
              <Trash2 size={12} /> Remove
            </button>
          </div>
        )}
        {!customImage && (
          <button className="btn-secondary text-xs flex items-center gap-1.5 mt-3" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={12} /> Upload a backdrop photo
          </button>
        )}

        {/* Motion tuning */}
        {background !== 'none' && (
          <div className="max-w-xs mt-5">
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

        {/* ── Image library — keep several backdrops, tap to use ── */}
        <div className="mt-6">
          <p className="hud-label text-[10px] mb-2">Image library</p>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={img.id} className="relative">
                <button
                  onClick={() => { selectImage(img.id); toast.success('Backdrop applied') }}
                  className="block w-24 h-16 overflow-hidden border transition-all"
                  style={{
                    borderColor: (background === 'image' && (selectedImageId || images[0]?.id) === img.id)
                      ? 'var(--accent-bright)' : 'var(--orbital-border)',
                  }}
                  title={`Use image ${i + 1} as the backdrop`}
                >
                  <img src={img.dataUrl} alt={`Backdrop ${i + 1}`} className="w-full h-full object-cover" />
                </button>
                <button
                  onClick={() => { removeImage(img.id); toast.info('Image removed') }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-red-400"
                  aria-label={`Remove backdrop ${i + 1}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {images.length < BG_LIBRARY_MAX && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-24 h-16 flex flex-col items-center justify-center gap-1 border border-dashed border-orbital-border text-orbital-subtle hover:text-orbital-text hover:border-orbital-chrome transition-colors"
              >
                <ImagePlus size={14} />
                <span className="text-[9px] font-telemetry tracking-wider">ADD</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-orbital-dim mt-1.5">
            Up to {BG_LIBRARY_MAX} images, stored in this browser. Tap one to use it everywhere,
            or assign per page below.
          </p>
        </div>

        {/* ── Per-page backdrops — scenery changes as you move around ── */}
        <div className="mt-6">
          <p className="hud-label text-[10px] mb-2">Per-page backdrops</p>
          <p className="text-[11px] text-orbital-dim mb-2">
            Give any page its own backdrop — it overrides the global pick just for that page.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-w-2xl">
            {ASSIGNABLE_PAGES.map(({ path, label }) => (
              <label key={path} className="flex items-center justify-between gap-3 text-sm text-orbital-text">
                <span className="truncate">{label}</span>
                <select
                  className="text-xs px-2 py-1.5 bg-orbital-surface border border-orbital-border text-orbital-text rounded max-w-[46%]"
                  value={pageBackgrounds[path] || 'default'}
                  onChange={(e) => setPageBackground(path, e.target.value)}
                >
                  <option value="default">App default</option>
                  {BACKGROUND_PRESETS.filter(p => p.id !== 'image').map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  {images.map((img, i) => (
                    <option key={img.id} value={`image:${img.id}`}>Image {i + 1}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* ── Session ──────────────────────────────────────────────────── */}
      <section className="card-elevated p-5">
        <p className="hud-label text-[10px] mb-3">Session</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-orbital-subtle">
            Signed in as <span className="text-orbital-text">{currentUser.email}</span> via Google
          </p>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
        <div className="flex items-center gap-2 mt-5 opacity-40">
          <OrbitalMark size={11} gradient={false} className="text-orbital-subtle" />
          <span className="text-[9px] font-telemetry tracking-[0.3em] text-orbital-subtle">ORBITAL STUDIOS</span>
        </div>
      </section>
    </div>
  )
}
