import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

// ── Body scroll lock (stack-counted, iOS-proof) ──────────────────────────────
// `overflow: hidden` alone does NOT stop iOS Safari from scrolling the page
// while the keyboard is up inside a fixed modal — which is how the Bible got
// wedged un-scrollable after adding a key player on mobile. The reliable lock
// is body position:fixed at the current scroll offset, restored on release.
// A module-level count makes stacked modals (form + confirm dialog) safe: the
// first lock applies it, the last release restores it — no leaks, no races.
let lockCount = 0
let lockedScrollY = 0

function lockBodyScroll() {
  if (lockCount++ > 0) return
  lockedScrollY = window.scrollY
  const b = document.body.style
  b.position = 'fixed'
  b.top = `-${lockedScrollY}px`
  b.left = '0'
  b.right = '0'
  b.width = '100%'
  b.overflow = 'hidden'
}

function unlockBodyScroll() {
  if (--lockCount > 0) return
  lockCount = 0
  const b = document.body.style
  b.position = ''
  b.top = ''
  b.left = ''
  b.right = ''
  b.width = ''
  b.overflow = ''
  window.scrollTo(0, lockedScrollY)
}

// Track the VISUAL viewport (shrinks when the mobile keyboard opens — the
// layout viewport and dvh don't). The modal panel caps its height to this so
// the form never gets shoved off-screen behind the keyboard.
function useVisualViewportHeight(active) {
  const [height, setHeight] = useState(null)
  useEffect(() => {
    if (!active) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setHeight(Math.round(vv.height))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setHeight(null)
    }
  }, [active])
  return height
}

export function Modal({ open, onClose, title, children, size = 'md', className }) {
  const overlayRef = useRef(null)
  const vvHeight = useVisualViewportHeight(open)

  // Ref so the Escape handler always sees the latest onClose without making it
  // an effect dep — callers pass inline arrows, and re-running the effect on
  // every parent render would churn the scroll lock.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.() }
    document.addEventListener('keydown', handleKey)
    lockBodyScroll()
    return () => {
      document.removeEventListener('keydown', handleKey)
      unlockBodyScroll()
    }
  }, [open])

  if (!open) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      // Close only when the interaction BOTH starts and ends on the overlay.
      // On mobile, a keyboard-driven layout shift could make a tap that began
      // on the form end on the backdrop — which read as a bare click and
      // closed the modal out from under the user ("menu disappearing").
      onPointerDown={(e) => { overlayRef.current._downOnOverlay = e.target === overlayRef.current }}
      onClick={(e) => {
        if (e.target === overlayRef.current && overlayRef.current._downOnOverlay) onClose()
        overlayRef.current._downOnOverlay = false
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal panel — height capped to the VISUAL viewport, so when the
          mobile keyboard opens the panel shrinks (and scrolls internally)
          instead of being pushed off-screen. */}
      <div
        className={clsx(
          'relative w-full bg-orbital-surface border border-orbital-border shadow-2xl z-10',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[92dvh] sm:max-h-[90vh] flex flex-col',
          sizeClass,
          className
        )}
        style={vvHeight ? { maxHeight: Math.max(220, vvHeight - 12) } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between pl-5 pr-2 py-2 sm:py-3 border-b border-orbital-border flex-shrink-0">
          <h2 className="font-semibold text-orbital-text text-base">{title}</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
