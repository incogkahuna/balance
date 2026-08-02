import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useKeyboardInset — how much of the screen the on-screen keyboard is eating.
//
// The layout viewport (and dvh) do NOT shrink when a mobile keyboard opens;
// only visualViewport does. Anything `position: fixed` therefore keeps sizing
// itself to the full screen and ends up underneath the keyboard, and because
// it's fixed the browser can't scroll it into view either — which is exactly
// how a panel ends up covering the field you're typing into.
//
// Returns { keyboardOpen, height, offsetTop, inset } where `inset` is the
// number of pixels hidden at the bottom. Null-safe on desktop and on browsers
// without visualViewport: everything reads as "no keyboard".
// ─────────────────────────────────────────────────────────────────────────────

// Below this the shrink is almost certainly a keyboard rather than a URL bar
// collapsing (which moves ~60–100px on mobile Safari/Chrome).
const KEYBOARD_MIN_INSET = 140

export function useKeyboardInset() {
  const [state, setState] = useState({
    keyboardOpen: false, height: 0, offsetTop: 0, inset: 0,
  })

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setState({
        keyboardOpen: inset > KEYBOARD_MIN_INSET,
        height: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
        inset,
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return state
}
