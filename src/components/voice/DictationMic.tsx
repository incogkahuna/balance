import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader } from 'lucide-react'
import clsx from 'clsx'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { transcribeAudio, TranscribeError } from '../../lib/transcribe'

export interface DictationMicProps {
  /** Receives the transcript once — caller appends it to its field. */
  onText: (text: string) => void
  /** Whisper vocabulary prompt (names, gear terms). */
  prompt?: string
  className?: string
  /** Hard cap; inline dictation shouldn't run long. */
  maxDurationSec?: number
}

/**
 * Compact inline mic for long-text fields (M3 / #19). One tap to record, one
 * tap to stop — transcription starts immediately (no review step; this is
 * dictation, not memo-keeping). Reuses the deployed `transcribe` Whisper
 * Edge Function via the same hook as VoiceRecorder.
 */
export function DictationMic({
  onText,
  prompt,
  className,
  maxDurationSec = 120,
}: DictationMicProps) {
  const recorder = useVoiceRecorder()
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  // Auto-stop at the cap.
  useEffect(() => {
    if (recorder.state === 'recording' && recorder.durationSec >= maxDurationSec) {
      recorder.stop()
    }
  }, [recorder, maxDurationSec])

  // As soon as a recording lands, transcribe and hand the text off.
  useEffect(() => {
    if (recorder.state !== 'stopped' || !recorder.blob || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    ;(async () => {
      try {
        const { transcript } = await transcribeAudio(recorder.blob!, { prompt })
        if (transcript.trim()) {
          onText(transcript.trim())
          setError(null)
        } else {
          setError('Heard nothing — try again closer to the mic.')
        }
      } catch (err) {
        setError(
          err instanceof TranscribeError && err.status === 0
            ? 'Transcription service unreachable.'
            : err instanceof Error ? err.message : 'Transcription failed',
        )
      } finally {
        recorder.reset()
        busyRef.current = false
        setBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state, recorder.blob])

  if (busy) {
    return (
      <span className={clsx('inline-flex items-center justify-center w-7 h-7 text-blue-400', className)} title="Transcribing…">
        <Loader size={14} className="animate-spin" />
      </span>
    )
  }

  if (recorder.state === 'recording') {
    return (
      <button
        type="button"
        onClick={recorder.stop}
        className={clsx(
          'inline-flex items-center justify-center gap-1 h-7 px-2 rounded text-red-300 bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 transition-colors',
          className,
        )}
        title="Stop and transcribe"
      >
        <span className="relative flex items-center justify-center">
          <span className="absolute w-4 h-4 rounded-full bg-red-500/40 animate-ping" />
          <Square size={10} fill="currentColor" />
        </span>
        <span className="font-mono text-[10px] tabular-nums">{recorder.durationSec}s</span>
      </button>
    )
  }

  const requesting = recorder.state === 'requesting'
  return (
    <button
      type="button"
      onClick={() => { setError(null); recorder.start() }}
      disabled={requesting}
      className={clsx(
        'inline-flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-50',
        error
          ? 'text-red-400 hover:text-red-300'
          : 'text-orbital-dim hover:text-blue-400 hover:bg-orbital-muted',
        className,
      )}
      title={error || recorder.error || 'Dictate (Whisper)'}
    >
      {requesting ? <Loader size={13} className="animate-spin" /> : <Mic size={13} />}
    </button>
  )
}
