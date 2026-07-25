import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// PullToRefresh — swipe-down-to-refresh for the installed (home-screen) app.
// Standalone PWAs lose the browser's native pull-to-refresh, which is exactly
// where Danny asked for it. Deliberately gated to standalone display mode so
// we never double up with Safari/Chrome's built-in gesture in a normal tab.
//
// Mechanics: when the page is scrolled to the very top and a touch drags
// down, a small indicator follows the pull (with resistance); releasing past
// the threshold reloads the app — full reload = fresh bundle + fresh data,
// the same thing the browser gesture would do.
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLD = 70   // px of (damped) pull required to trigger
const MAX_PULL = 110   // indicator travel cap

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS Safari legacy flag
  )
}

export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(null)
  const pullRef = useRef(0)
  const [enabled] = useState(isStandalone)

  useEffect(() => {
    if (!enabled) return

    const onTouchStart = (e) => {
      // Only arm at the very top of the page, single-finger.
      if (window.scrollY <= 0 && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY
      } else {
        startYRef.current = null
      }
    }

    const onTouchMove = (e) => {
      if (startYRef.current == null || refreshing) return
      // If the page scrolled meanwhile (inner scroller), disarm.
      if (window.scrollY > 0) { startYRef.current = null; pullRef.current = 0; setPull(0); return }
      const delta = e.touches[0].clientY - startYRef.current
      if (delta <= 0) { pullRef.current = 0; setPull(0); return }
      const damped = Math.min(delta * 0.45, MAX_PULL)
      pullRef.current = damped
      setPull(damped)
    }

    const onTouchEnd = () => {
      if (startYRef.current == null) return
      startYRef.current = null
      if (pullRef.current >= THRESHOLD && !refreshing) {
        setRefreshing(true)
        setPull(THRESHOLD)
        // Tiny beat so the spinner is visible before the reload wipes it.
        setTimeout(() => window.location.reload(), 250)
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }

    // Passive listeners — we never preventDefault, we only measure.
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, refreshing])

  if (!enabled || pull <= 0) return null

  const progress = Math.min(pull / THRESHOLD, 1)
  return (
    <div
      className="fixed left-1/2 z-50 pointer-events-none"
      style={{
        top: `calc(env(safe-area-inset-top) + ${Math.max(pull - 44, 8)}px)`,
        transform: 'translateX(-50%)',
        opacity: Math.max(progress, 0.35),
        transition: refreshing ? 'none' : pull === 0 ? 'top 0.2s, opacity 0.2s' : 'none',
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: 'var(--orbital-surface, #11151f)',
          border: '1px solid var(--orbital-border, rgba(255,255,255,0.12))',
        }}
      >
        <RefreshCw
          size={16}
          className={refreshing ? 'animate-spin' : ''}
          style={{
            color: progress >= 1 ? '#55c9ef' : 'var(--orbital-subtle, #9aa4b2)',
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
          }}
        />
      </div>
    </div>
  )
}
