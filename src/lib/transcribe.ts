import { supabase } from './supabase'

export interface TranscribeResult {
  transcript: string
  durationSec: number
}

export interface TranscribeOptions {
  /** BCP-47 language code. Whisper auto-detects when omitted; we default to 'en'. */
  language?: string
  /**
   * Free-form prompt that biases Whisper toward your vocabulary. Worth seeding
   * with names of crew, gear (LED panel models, processors), and locations so
   * proper nouns don't get butchered.
   */
  prompt?: string
}

export class TranscribeError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'TranscribeError'
  }
}

/**
 * Transcribe a recorded audio Blob via the `transcribe` Supabase Edge Function.
 *
 * The function must be deployed and have OPENAI_API_KEY set:
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *   supabase functions deploy transcribe
 *
 * If the function isn't deployed, this throws with a TranscribeError that the
 * caller can surface to the user.
 */
export async function transcribeAudio(
  audio: Blob,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  if (audio.size === 0) {
    throw new TranscribeError(400, 'Recording is empty')
  }
  if (audio.size > 25 * 1024 * 1024) {
    throw new TranscribeError(413, 'Recording exceeds 25 MB Whisper limit')
  }

  // MediaRecorder gives us blobs without filenames. Whisper requires an
  // extension to sniff the codec, so we wrap into a File with a sensible name.
  const ext = mimeToExtension(audio.type)
  const file = new File([audio], `voice-memo.${ext}`, { type: audio.type })

  const form = new FormData()
  form.append('file', file)
  if (options.language) form.append('language', options.language)
  if (options.prompt)   form.append('prompt',   options.prompt)

  const { data, error } = await supabase.functions.invoke<TranscribeResult>('transcribe', {
    body: form,
  })

  if (error) {
    // supabase-js wraps non-2xx as `error`. The status comes from a context
    // object on FunctionsHttpError; fall back to 0 when not present.
    const status = (error as { context?: { status?: number } }).context?.status ?? 0
    throw new TranscribeError(status, error.message || 'Transcription failed')
  }
  if (!data || typeof data.transcript !== 'string') {
    throw new TranscribeError(502, 'Malformed response from transcribe function')
  }

  return data
}

const mimeToExtension = (mime: string): string => {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4'))  return 'mp4'
  if (mime.includes('m4a'))  return 'm4a'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('wav'))  return 'wav'
  if (mime.includes('ogg'))  return 'ogg'
  return 'webm'
}
