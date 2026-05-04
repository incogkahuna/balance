import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'

export interface VoiceRecorderHook {
  state: RecorderState
  /** Wall-clock seconds the current recording has been running. */
  durationSec: number
  /** Final blob, available once state === 'stopped'. */
  blob: Blob | null
  /** Last error message, if state === 'error'. */
  error: string | null
  start: () => Promise<void>
  stop: () => void
  /** Discard the current recording and return to idle. */
  reset: () => void
}

const PREFERRED_MIMES = [
  'audio/webm;codecs=opus', // Chrome, Firefox, Edge
  'audio/webm',
  'audio/mp4',              // Safari (iOS 14.3+)
  'audio/mpeg',
] as const

const pickMimeType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const m of PREFERRED_MIMES) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return undefined
}

/**
 * MediaRecorder wrapper. Owns the recording lifecycle, exposes a final Blob,
 * and tracks elapsed seconds for the live UI counter. Cleans up the mic stream
 * the moment recording ends or the component unmounts so the browser's "in use"
 * indicator doesn't linger.
 */
export function useVoiceRecorder(): VoiceRecorderHook {
  const [state, setState]             = useState<RecorderState>('idle')
  const [durationSec, setDurationSec] = useState(0)
  const [blob, setBlob]               = useState<Blob | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const tickRef     = useRef<number | null>(null)

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const start = useCallback(async () => {
    if (state === 'recording' || state === 'requesting') return
    setError(null)
    setBlob(null)
    setDurationSec(0)
    setState('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current   = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setBlob(finalBlob)
        setState('stopped')
        cleanup()
      }
      recorder.onerror = (e) => {
        const err = (e as unknown as { error?: { message?: string } }).error
        setError(err?.message || 'Recorder error')
        setState('error')
        cleanup()
      }

      recorder.start()
      startedAtRef.current = Date.now()
      // Update once a second — sufficient for the visible duration counter.
      tickRef.current = window.setInterval(() => {
        setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)

      setState('recording')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg)
      setState('error')
      cleanup()
    }
  }, [state, cleanup])

  const stop = useCallback(() => {
    const r = recorderRef.current
    if (!r) return
    if (r.state !== 'inactive') r.stop()
  }, [])

  const reset = useCallback(() => {
    if (state === 'recording') stop()
    cleanup()
    setBlob(null)
    setError(null)
    setDurationSec(0)
    setState('idle')
  }, [state, stop, cleanup])

  return { state, durationSec, blob, error, start, stop, reset }
}
