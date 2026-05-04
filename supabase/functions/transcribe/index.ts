// ─────────────────────────────────────────────────────────────────────────────
// transcribe — proxy from authenticated Balance clients to OpenAI Whisper.
//
// Why this is a server function:
//   - We never want OPENAI_API_KEY in the browser bundle.
//   - We only want signed-in studio users hitting Whisper.
//
// Deploy:
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase functions deploy transcribe
//
// Local dev:
//   supabase functions serve transcribe --env-file ./supabase/.env.local
//   (set OPENAI_API_KEY=... in supabase/.env.local — gitignored)
//
// Contract:
//   Request:  multipart/form-data, fields:
//             - file       (audio blob, required; webm/mp4/wav/mp3/m4a/ogg)
//             - language   (BCP-47, optional; defaults to "en")
//             - prompt     (string, optional; biases the decoder toward
//                           studio vocabulary — names, gear, locations)
//   Response: 200 { transcript: string, durationSec: number }
//             4xx { error: string }
//
// Limits:
//   - Whisper rejects payloads > 25 MB. The client should warn before upload.
//   - Whisper response time scales roughly with audio duration (~1× realtime
//     on the OpenAI side). Long recordings will hit the Edge Function 150s
//     wall on the free tier — keep recordings ≤ ~3 min for now.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY')

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Config check ──────────────────────────────────────────────────────────
  if (!OPENAI_API_KEY) {
    console.error('[transcribe] OPENAI_API_KEY not set')
    return json({ error: 'Server not configured' }, 500)
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[transcribe] Supabase env not set')
    return json({ error: 'Server not configured' }, 500)
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  // Reject anonymous callers — only authenticated studio users may transcribe.
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401)
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return json({ error: 'Not authenticated' }, 401)
  }

  // ── Parse upload ──────────────────────────────────────────────────────────
  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    console.error('[transcribe] formData parse failed:', err)
    return json({ error: 'Invalid multipart payload' }, 400)
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return json({ error: 'Missing file field' }, 400)
  }
  if (file.size === 0) {
    return json({ error: 'Empty file' }, 400)
  }
  if (file.size > 25 * 1024 * 1024) {
    return json({ error: 'File exceeds Whisper 25 MB limit' }, 413)
  }

  const language = (form.get('language') as string | null) || 'en'
  const prompt   = (form.get('prompt')   as string | null) || ''

  // ── Forward to Whisper ────────────────────────────────────────────────────
  const whisperForm = new FormData()
  whisperForm.append('file', file)
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('language', language)
  whisperForm.append('response_format', 'verbose_json')
  if (prompt) whisperForm.append('prompt', prompt)

  let whisperRes: Response
  try {
    whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body:    whisperForm,
    })
  } catch (err) {
    console.error('[transcribe] Whisper fetch failed:', err)
    return json({ error: 'Upstream request failed' }, 502)
  }

  if (!whisperRes.ok) {
    const detail = await whisperRes.text().catch(() => '')
    console.error('[transcribe] Whisper non-2xx:', whisperRes.status, detail)
    return json({ error: `Whisper error (${whisperRes.status})` }, 502)
  }

  const data = await whisperRes.json() as { text?: string; duration?: number }
  return json({
    transcript:  data.text ?? '',
    durationSec: data.duration ?? 0,
  })
})
