import { useEffect, useState } from 'react'
import { Mic, Square, RotateCcw, Loader, Check } from 'lucide-react'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { transcribeAudio, TranscribeError } from '../../lib/transcribe'

export interface VoiceRecorderProps {
  /** Called once with the final transcript text. Caller decides what to do
   *  with it (append to a textarea, save as a memo, etc.). */
  onTranscript: (transcript: string) => void
  /**
   * Whisper prompt. Seed with names + gear vocabulary so proper nouns survive
   * the transcription. The Edge Function passes this straight through.
   */
  prompt?: string
  language?: string
  className?: string
  /** Hard cap in seconds. We stop recording automatically once hit. */
  maxDurationSec?: number
}

const formatDuration = (s: number): string => {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/**
 * Record → review → transcribe flow. Drop-in replacement for the Web Speech
 * input that used to live in InputStage. Calls the `transcribe` Edge Function
 * (Whisper) once recording finishes and the user confirms.
 */
export function VoiceRecorder({
  onTranscript,
  prompt,
  language = 'en',
  className,
  maxDurationSec = 180, // 3 minutes — keeps us under Edge Function timeouts
}: VoiceRecorderProps) {
  const recorder = useVoiceRecorder()
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Auto-stop at the duration ceiling so users don't accidentally exceed the
  // Edge Function timeout / Whisper file limit.
  useEffect(() => {
    if (recorder.state === 'recording' && recorder.durationSec >= maxDurationSec) {
      recorder.stop()
    }
  }, [recorder, maxDurationSec])

  const handleTranscribe = async () => {
    if (!recorder.blob) return
    setError(null)
    setTranscribing(true)
    try {
      const { transcript } = await transcribeAudio(recorder.blob, { language, prompt })
      if (!transcript.trim()) {
        setError('Transcription came back empty — try recording again.')
        return
      }
      onTranscript(transcript.trim())
      recorder.reset()
    } catch (err) {
      if (err instanceof TranscribeError) {
        setError(
          err.status === 401 ? 'Sign-in expired — refresh and try again.'
          : err.status === 0   ? 'Transcription service is unreachable. Is the Edge Function deployed?'
          : err.message,
        )
      } else {
        setError(err instanceof Error ? err.message : 'Transcription failed')
      }
    } finally {
      setTranscribing(false)
    }
  }

  // ── UI states ─────────────────────────────────────────────────────────────

  if (recorder.state === 'recording') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={recorder.stop}
          className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/20 transition-colors"
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute w-6 h-6 rounded-full bg-red-500/40 animate-ping" />
            <Square size={14} fill="currentColor" />
          </span>
          <span className="font-medium">Stop recording</span>
          <span className="font-mono text-sm tabular-nums opacity-80">
            {formatDuration(recorder.durationSec)} / {formatDuration(maxDurationSec)}
          </span>
        </button>
      </div>
    )
  }

  if (recorder.state === 'stopped' && recorder.blob) {
    return (
      <div className={className}>
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-orbital-border bg-orbital-surface">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Mic size={14} className="text-blue-400 flex-shrink-0" />
              <span className="text-sm text-orbital-text">Recording ready</span>
              <span className="text-xs text-orbital-subtle font-mono tabular-nums">
                {formatDuration(recorder.durationSec)}
              </span>
            </div>
            <button
              type="button"
              onClick={recorder.reset}
              disabled={transcribing}
              aria-label="Discard recording"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-orbital-subtle hover:text-orbital-text hover:bg-orbital-muted transition-colors disabled:opacity-40"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <audio
            src={URL.createObjectURL(recorder.blob)}
            controls
            className="w-full h-10"
          />
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={transcribing}
            className="btn-primary w-full disabled:opacity-60"
          >
            {transcribing
              ? <><Loader size={14} className="animate-spin" /> Transcribing…</>
              : <><Check size={14} /> Transcribe with Whisper</>
            }
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  // idle / requesting / error
  const requesting = recorder.state === 'requesting'
  return (
    <div className={className}>
      <button
        type="button"
        onClick={recorder.start}
        disabled={requesting}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-orbital-border text-orbital-subtle hover:border-blue-500/40 hover:text-blue-400 transition-colors text-sm font-medium disabled:opacity-60"
      >
        {requesting
          ? <><Loader size={16} className="animate-spin" /> Asking for mic permission…</>
          : <><Mic size={16} /> Record voice memo</>
        }
      </button>
      {recorder.error && (
        <p className="text-xs text-red-400 mt-2">{recorder.error}</p>
      )}
    </div>
  )
}
