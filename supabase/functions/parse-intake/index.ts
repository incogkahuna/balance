// ─────────────────────────────────────────────────────────────────────────────
// parse-intake — Tier 2 (Claude) production-brief parser with vision.
//
// The "screenshot parser" the intake wizard has been promising since Tier 1:
// takes the same inputs the heuristic parser sees (pasted text, voice
// transcripts, screenshots) and runs them through Claude with vision +
// structured output. Screenshots of call sheets, email threads, WhatsApp
// convos, and briefs get actually READ instead of just stored.
//
// Why this is a server function:
//   - ANTHROPIC_API_KEY must never reach the browser bundle.
//   - Only signed-in studio users may spend API tokens.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy parse-intake
//
// Local dev:
//   supabase functions serve parse-intake --env-file ./supabase/.env.local
//
// Contract:
//   Request:  POST application/json
//             { inputs: [ { kind: 'text',  content: string, label?: string }
//                       | { kind: 'image', dataUrl: string, label?: string } ],
//               today?: 'YYYY-MM-DD' }   // client-local date for resolving
//                                        // relative dates ("next Tuesday")
//   Response: 200 { extraction: {...structured fields...} }
//             4xx/5xx { error: string }
//
// The client treats any failure as "Tier 2 unavailable" and falls back to
// the Tier 1 heuristics — this function is an enhancement, never a gate.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON     = Deno.env.get('SUPABASE_ANON_KEY')

const MAX_IMAGES      = 8
const MAX_TEXT_CHARS  = 60_000
const MAX_BODY_BYTES  = 30 * 1024 * 1024

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

// ─── Structured output schema ────────────────────────────────────────────────
// Every field is required; "unknown" is the empty string / empty array. This
// keeps the schema strict (additionalProperties: false throughout) without
// nullable unions.
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'client', 'productionType', 'locationType', 'locationAddress',
    'startDate', 'endDate', 'contacts', 'crewNames', 'concerns', 'summary',
  ],
  properties: {
    title:           { type: 'string', description: 'Production/project name, or "" if not stated' },
    client:          { type: 'string', description: 'Client or company commissioning the work, or ""' },
    productionType:  { type: 'string', description: 'Type of production if stated (e.g. "TVC AOTO", "Mobile CAR process CLI", "Little Dipper", or a free-form description like "LED volume shoot"), or ""' },
    locationType:    { type: 'string', enum: ['In-House (Orbital Studios)', 'Mobile', ''], description: 'In-House if shooting at Orbital Studios / an LED volume stage; Mobile if on location; "" if unclear' },
    locationAddress: { type: 'string', description: 'Shoot location/address if stated, or ""' },
    startDate:       { type: 'string', description: 'Shoot start date as YYYY-MM-DD, resolved against the provided current date, or ""' },
    endDate:         { type: 'string', description: 'Shoot end/wrap date as YYYY-MM-DD, or "" if single-day or unknown' },
    contacts: {
      type: 'array',
      description: 'People mentioned as client-side or external contacts (NOT Orbital crew)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'phone', 'company', 'role'],
        properties: {
          name:    { type: 'string' },
          email:   { type: 'string' },
          phone:   { type: 'string' },
          company: { type: 'string' },
          role:    { type: 'string', description: 'Their role, e.g. Producer, DP, Agency contact, or ""' },
        },
      },
    },
    crewNames: {
      type: 'array',
      description: 'Names of Orbital studio team members mentioned as working this production. Return names exactly as written in the source.',
      items: { type: 'string' },
    },
    concerns: {
      type: 'array',
      description: 'Logistical risks or concerns explicitly present in the inputs (tight timelines, missing resources, conflicts, weather, unresolved questions). Max 6. Do not invent.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category'],
        properties: {
          title:    { type: 'string', description: 'Short statement of the concern, under 90 chars' },
          category: { type: 'string', enum: ['tight-timeline', 'back-to-back', 'missing-resource', 'conflict', 'weather', 'unresolved', 'general'] },
        },
      },
    },
    summary: {
      type: 'array',
      description: 'Short human-readable lines describing what was found and where (e.g. "Read call sheet screenshot — extracted dates and 3 contacts"). Max 6 lines.',
      items: { type: 'string' },
    },
  },
} as const

type RequestInput =
  | { kind: 'text'; content: string; label?: string }
  | { kind: 'image'; dataUrl: string; label?: string }

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  if (!ANTHROPIC_API_KEY) {
    console.error('[parse-intake] ANTHROPIC_API_KEY not set')
    return json({ error: 'Server not configured' }, 500)
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[parse-intake] Supabase env not set')
    return json({ error: 'Server not configured' }, 500)
  }

  // ── Auth — only signed-in studio users ────────────────────────────────────
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

  // ── Parse + validate body ──────────────────────────────────────────────────
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413)

  let body: { inputs?: RequestInput[]; today?: string }
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const inputs = Array.isArray(body.inputs) ? body.inputs : []
  if (inputs.length === 0) return json({ error: 'No inputs provided' }, 400)

  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today || '')
    ? body.today
    : new Date().toISOString().slice(0, 10)

  // ── Build Claude content blocks ────────────────────────────────────────────
  const content: Anthropic.ContentBlockParam[] = []
  let imageCount = 0
  let textChars  = 0

  for (const input of inputs) {
    if (input.kind === 'image' && typeof input.dataUrl === 'string') {
      if (imageCount >= MAX_IMAGES) continue
      const m = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/s)
      if (!m || !ALLOWED_MEDIA.has(m[1])) continue
      imageCount++
      content.push({ type: 'text', text: `Screenshot ${imageCount}${input.label ? ` ("${input.label}")` : ''}:` })
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: m[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: m[2].replace(/\s/g, ''),
        },
      })
    } else if (input.kind === 'text' && typeof input.content === 'string' && input.content.trim()) {
      const remaining = MAX_TEXT_CHARS - textChars
      if (remaining <= 0) continue
      const text = input.content.slice(0, remaining)
      textChars += text.length
      content.push({
        type: 'text',
        text: `--- ${input.label || 'Pasted text'} ---\n${text}`,
      })
    }
  }

  if (content.length === 0) return json({ error: 'No usable inputs' }, 400)

  content.push({
    type: 'text',
    text:
      `Today's date is ${today}. Extract the production brief details from ` +
      `everything above (including the screenshots — read them carefully: call ` +
      `sheets, email threads, chat conversations, briefs). Resolve relative ` +
      `dates against today's date. Only report what is actually present or ` +
      `clearly implied — never invent details. Use "" for anything unknown.`,
  })

  // ── Call Claude ────────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system:
        'You extract structured production-brief data for Balance, the ' +
        'production-management tool of Orbital Studios — a virtual production ' +
        'studio in Los Angeles (LED volume stages and mobile car-process ' +
        'shoots). Inputs are raw intake material: pasted emails, WhatsApp ' +
        'threads, voice-memo transcripts, and screenshots. Be precise; prefer ' +
        'leaving a field empty over guessing.',
      output_config: {
        format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
      },
      messages: [{ role: 'user', content }],
    })
  } catch (err) {
    console.error('[parse-intake] Anthropic request failed:', err)
    const status = (err as { status?: number })?.status
    if (status === 429) return json({ error: 'AI service rate limited — try again shortly' }, 429)
    return json({ error: 'AI parsing failed' }, 502)
  }

  if (response.stop_reason === 'refusal') {
    console.warn('[parse-intake] request refused by safety classifiers')
    return json({ error: 'AI declined to process these inputs' }, 422)
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[parse-intake] no text block in response, stop_reason:', response.stop_reason)
    return json({ error: 'Empty AI response' }, 502)
  }

  let extraction: unknown
  try {
    extraction = JSON.parse(textBlock.text)
  } catch {
    console.error('[parse-intake] response was not valid JSON')
    return json({ error: 'Malformed AI response' }, 502)
  }

  return json({ extraction })
})
