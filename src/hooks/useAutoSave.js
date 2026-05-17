import { useEffect, useRef, useState } from 'react'

/**
 * Debounced auto-save hook.
 *
 * Watches `value`. After `delay` ms of stability (no further changes), calls
 * `saveFn(value)`. Returns { status, lastSavedAt, error } so the caller can
 * render a save-state indicator.
 *
 * - `status` is one of: 'idle' | 'saving' | 'saved' | 'error'
 *   • 'idle'   — first render, before any change
 *   • 'saving' — a change was made; save is queued or in flight
 *   • 'saved'  — last save completed successfully
 *   • 'error'  — last save threw; see `error` for details
 *
 * Pass `enabled = false` to no-op the auto-save (useful for create-mode where
 * there's no record yet — auto-save is only meaningful when editing).
 *
 * Note: deep equality is approximated via JSON.stringify on the value. This
 * works for plain-data forms (strings, numbers, arrays of primitives). If you
 * pass anything non-serializable (Date objects, Map/Set, class instances) the
 * comparison will fall through and you'll get spurious re-saves.
 */
export function useAutoSave(value, saveFn, { delay = 600, enabled = true } = {}) {
  const [status, setStatus] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const skipFirst = useRef(true)
  const saveFnRef = useRef(saveFn)
  saveFnRef.current = saveFn

  // Stringify once so we have a stable dep that reflects content changes.
  const valueKey = JSON.stringify(value)

  useEffect(() => {
    if (!enabled) return
    // The first render captures the initial value — don't save that.
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }

    setStatus('saving')
    const t = setTimeout(async () => {
      try {
        await saveFnRef.current(value)
        setStatus('saved')
        setLastSavedAt(new Date())
        setError(null)
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      }
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey, enabled, delay])

  // If auto-save gets disabled mid-flight, reset to idle.
  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      skipFirst.current = true
    }
  }, [enabled])

  return { status, lastSavedAt, error }
}
