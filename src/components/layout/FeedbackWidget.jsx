import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { MessageSquarePlus, Send, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FEEDBACK_KIND, FEEDBACK_KIND_LABEL, createFeedbackItem } from '../../data/models.js'
import { DictationMic } from '../voice/DictationMic.tsx'
import clsx from 'clsx'

// ─── Global feedback widget (M5 / #3) ────────────────────────────────────────
// A floating control on every page: pick note / feature / bug, two fields,
// send — no navigation, no context lost. Reports land in the shared
// feedback_items table and surface on the Bugs & Ideas page.
//
// Draggable anywhere (desktop + mobile) with the position remembered per
// browser — the fixed bottom-right spot used to sit on top of the Resources
// tab in the mobile nav. Drag moves it; a tap (no drag) opens the panel.

const POS_KEY = 'balance_feedback_pos_v1'
const BTN = 40   // trigger diameter (px)
const EDGE = 6   // min gap from any viewport edge

function clampPos(p) {
  if (typeof window === 'undefined') return p
  const maxX = window.innerWidth - BTN - EDGE
  const maxY = window.innerHeight - BTN - EDGE
  return {
    x: Math.max(EDGE, Math.min(p.x, Math.max(EDGE, maxX))),
    y: Math.max(EDGE, Math.min(p.y, Math.max(EDGE, maxY))),
  }
}

// Default: bottom-right, but lifted above the mobile bottom nav (~72px + safe
// area) on small screens so it never covers a nav tab on first load.
function defaultPos() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  const isMobile = window.innerWidth < 1024
  return clampPos({
    x: window.innerWidth - BTN - 20,
    y: window.innerHeight - BTN - (isMobile ? 96 : 24),
  })
}

export function FeedbackWidget() {
  const { currentUser, addFeedbackItem } = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(FEEDBACK_KIND.NOTE)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const panelRef = useRef(null)

  // ── Position (persisted, drag to move) ──────────────────────────────────────
  // Start from the stored value if any, else null — the real default is
  // computed in a layout effect once the viewport size is actually known.
  // (Computing it in the useState initializer can catch a 0-size window during
  // the preview/first mount and wrongly clamp the button into a corner.)
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem(POS_KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return null
  })
  // Establish + clamp position once the viewport reports a real size. Usually
  // that's immediately (layout effect, pre-paint), but if the frame isn't sized
  // yet (e.g. a hidden/embedded mount reporting 0×0) we retry per frame / on
  // resize so the button never gets stranded in a corner by a 0-size default.
  const established = useRef(false)
  useLayoutEffect(() => {
    const establish = () => {
      if (established.current) return true
      if (!window.innerWidth || !window.innerHeight) return false
      setPos(p => clampPos(p ?? defaultPos()))
      established.current = true
      return true
    }
    if (establish()) return
    let raf = requestAnimationFrame(function tick() {
      if (!establish()) raf = requestAnimationFrame(tick)
    })
    window.addEventListener('resize', establish)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', establish) }
  }, [])
  useEffect(() => {
    if (!pos) return
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* private mode */ }
  }, [pos])
  // Keep it on-screen when the viewport changes (rotate / resize).
  useEffect(() => {
    const onResize = () => setPos(p => (p ? clampPos(p) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Drag state lives in a ref so pointer moves don't thrash React state until
  // we actually move. `suppressClick` swallows the click that a browser fires
  // at the end of a drag, so a drag never also opens the panel.
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const suppressClick = useRef(false)

  const onPointerDown = useCallback((e) => {
    // Left mouse / touch / pen only.
    if (e.button != null && e.button !== 0) return
    drag.current = { active: true, moved: false, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
    // Capture so the drag keeps tracking even if the pointer leaves the button.
    // Can throw if the pointer isn't active (e.g. synthetic events) — non-fatal.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* noop */ }
  }, [pos])

  const onPointerMove = useCallback((e) => {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true
    if (d.moved) setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }))
  }, [])

  const onPointerUp = useCallback((e) => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* noop */ }
    if (d.moved) suppressClick.current = true
  }, [])

  const onClick = useCallback(() => {
    // Ignore the synthetic click that follows a drag; real taps + keyboard
    // activation (Enter/Space fire click with no drag) toggle the panel.
    if (suppressClick.current) { suppressClick.current = false; return }
    setOpen(o => !o)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  if (!currentUser) return null
  // Position is established in useLayoutEffect (before paint) — until then skip
  // rendering so we never flash the button at a wrong spot.
  if (!pos) return null

  const send = () => {
    if (!title.trim()) return
    addFeedbackItem(createFeedbackItem({
      kind,
      title: title.trim(),
      description: description.trim(),
    }))
    toast.success('Feedback sent — thank you.')
    setTitle('')
    setDescription('')
    setOpen(false)
  }

  // Open the panel toward the screen centre so it stays on-screen wherever the
  // button has been parked.
  const openUp    = pos.y > window.innerHeight / 2
  const alignRight = pos.x > window.innerWidth / 2
  const panelStyle = {
    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
    ...(openUp ? { bottom: BTN + 8 } : { top: BTN + 8 }),
    ...(alignRight ? { right: 0 } : { left: 0 }),
  }

  return (
    <div className="fixed z-40" style={{ left: pos.x, top: pos.y }} ref={panelRef}>
      {/* Panel */}
      {open && (
        <div
          className="absolute w-80 max-w-[calc(100vw-24px)] card-elevated animate-hud-in p-4 space-y-3"
          style={panelStyle}
        >
          <div className="flex items-center justify-between">
            <p className="hud-label text-[10px]">Send Feedback</p>
            <button
              onClick={() => setOpen(false)}
              className="text-orbital-subtle hover:text-orbital-text transition-colors"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Kind — note / feature / bug */}
          <div className="grid grid-cols-3 gap-1.5">
            {Object.values(FEEDBACK_KIND).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium border transition-colors',
                  kind === k
                    ? 'text-orbital-text'
                    : 'border-orbital-border text-orbital-subtle hover:text-orbital-text'
                )}
                style={kind === k ? { borderColor: 'var(--accent-ring)', background: 'var(--accent-soft)' } : {}}
              >
                {FEEDBACK_KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <input
            className="input"
            placeholder={
              kind === FEEDBACK_KIND.BUG  ? 'What broke?' :
              kind === FEEDBACK_KIND.IDEA ? 'What should it do?' :
              'What’s on your mind?'
            }
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) send() }}
            autoFocus
          />

          <div className="relative">
            <textarea
              className="input min-h-[64px] resize-y text-sm pr-9"
              placeholder="Details (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <DictationMic
              className="absolute right-1.5 bottom-2"
              onText={t => setDescription(d => d ? `${d}\n${t}` : t)}
            />
          </div>

          <button onClick={send} disabled={!title.trim()} className="btn-primary w-full disabled:opacity-40">
            <Send size={13} /> Send
          </button>
        </div>
      )}

      {/* Trigger — drag to move, tap to open */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        className={clsx(
          'w-10 h-10 flex items-center justify-center rounded-full transition-transform touch-none select-none',
          open ? 'scale-95' : 'hover:scale-105'
        )}
        style={{
          background: 'var(--brand-grad)',
          boxShadow: '0 6px 20px rgba(42,123,187,0.45)',
          color: '#fff',
          touchAction: 'none',
          cursor: 'grab',
        }}
        title="Send feedback — drag to move, tap to open"
        aria-label="Send feedback (drag to move, tap to open)"
      >
        <MessageSquarePlus size={17} />
      </button>
    </div>
  )
}
