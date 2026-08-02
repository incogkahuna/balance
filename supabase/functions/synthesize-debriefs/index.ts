// ─────────────────────────────────────────────────────────────────────────────
// synthesize-debriefs — turn a pile of submitted debriefs into one review doc.
//
// Danny: "have AI attached that can sort out concerns recorded by multiple
// people… sort categories from all submitted debriefs such as production
// wins, production issues, and things learned."
//
// Takes N submitted debriefs and returns a structured synthesis:
//   wins · issues · learnings · money (add-on charges still to collect)
//
// The point is the MERGE: when three people separately wrote "content showed
// up late", that's ONE issue reported by three people across two productions,
// not three bullets. Every item carries the productions and reporters it came
// from so nothing becomes anonymous.
//
// Why a server function:
//   - ANTHROPIC_API_KEY must never reach the browser bundle.
//   - Only signed-in studio users may spend API tokens.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (already set)
//   supabase functions deploy synthesize-debriefs
//
// Contract:
//   Request:  POST { debriefs: [ { production, client, submittedByName,
//                                  submittedAt, text } ] }
//   Response: 200 { synthesis: { summary, wins[], issues[], learnings[],
//                                money[] } }
//             4xx/5xx { error: string }
//
// The client treats any failure as "synthesis unavailable" and still shows the
// raw debriefs — this is an enhancement, never a gate.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON     = Deno.env.get('SUPABASE_ANON_KEY')

const MAX_DEBRIEFS   = 40
const MAX_TEXT_CHARS = 200_000
const MAX_BODY_BYTES = 5 * 1024 * 1024

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
// Strict throughout (additionalProperties: false, everything required) so the
// client can render without defensive checks. "Unknown" is an empty string or
// empty array, never a missing key.
const ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'detail', 'productions', 'reportedBy', 'recurrence'],
  properties: {
    title: { type: 'string', description: 'Short headline, under 12 words.' },
    detail: {
      type: 'string',
      description:
        'One or two sentences of specifics, in the crew\'s own framing. ' +
        'No advice unless the debriefs contained it.',
    },
    productions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Production names this came from.',
    },
    reportedBy: {
      type: 'array',
      items: { type: 'string' },
      description: 'Names of the people who raised it.',
    },
    recurrence: {
      type: 'integer',
      description: 'How many separate debriefs raised this. 1 = one-off.',
    },
  },
} as const

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'wins', 'issues', 'learnings', 'money'],
  properties: {
    summary: {
      type: 'string',
      description:
        'Two or three sentences: what these productions have in common and ' +
        'what stands out. Plain language, no preamble.',
    },
    wins:      { type: 'array', items: ITEM },
    issues:    { type: 'array', items: ITEM },
    learnings: { type: 'array', items: ITEM },
    money: {
      type: 'array',
      items: ITEM,
      description:
        'Add-on charges, damages, and overages named in the debriefs that ' +
        'still need to reach collection.',
    },
  },
} as const

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!ANTHROPIC_API_KEY) {
    console.error('[synthesize-debriefs] ANTHROPIC_API_KEY not set')
    return json({ error: 'AI is not configured' }, 503)
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[synthesize-debriefs] Supabase env missing')
    return json({ error: 'Server misconfigured' }, 503)
  }

  // ── Auth: signed-in studio users only ──────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: 'Not authenticated' }, 401)

  // ── Parse + validate body ──────────────────────────────────────────────────
  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413)

  let body: { debriefs?: Array<Record<string, unknown>> }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const debriefs = (Array.isArray(body.debriefs) ? body.debriefs : []).slice(0, MAX_DEBRIEFS)
  if (debriefs.length === 0) return json({ error: 'No debriefs provided' }, 400)

  // Flatten to a single labelled transcript. Labels matter: the model needs to
  // know which production and which person each block came from to attribute
  // and merge correctly.
  let corpus = debriefs
    .map((d, i) => {
      const production = String(d.production || 'Unknown production')
      const client = d.client ? ` (client: ${String(d.client)})` : ''
      const who = String(d.submittedByName || 'Unknown')
      const when = String(d.submittedAt || '').slice(0, 10)
      const text = String(d.text || '')
      return `=== DEBRIEF ${i + 1} — ${production}${client}\nSubmitted by ${who}${when ? ` on ${when}` : ''}\n\n${text}`
    })
    .join('\n\n')

  if (corpus.length > MAX_TEXT_CHARS) corpus = `${corpus.slice(0, MAX_TEXT_CHARS)}\n\n[TRUNCATED]`

  // ── Call Claude ────────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: 'claude-opus-5',
      // Room for adaptive thinking (on by default on Opus 5) plus the JSON.
      // Forty debriefs can produce a long synthesis; too tight a ceiling
      // truncates the JSON and fails the parse below.
      max_tokens: 16000,
      system:
        'You synthesize production debriefs for Balance, the production-' +
        'management tool of Orbital Studios — a virtual production studio in ' +
        'Los Angeles running LED volume stages and mobile car-process shoots. ' +
        'Readers are the crew and producers who were there.\n\n' +
        'Your job is to MERGE, not summarize each debrief in turn. When ' +
        'several people describe the same underlying thing in different ' +
        'words, that is ONE item — list every production and every person it ' +
        'came from, and set recurrence to the number of separate debriefs ' +
        'that raised it. Order each category with the most-repeated items ' +
        'first.\n\n' +
        'Report only what the debriefs actually say. Do not invent causes, ' +
        'recommendations, or blame. If a category has nothing in it, return ' +
        'an empty array rather than padding it. Name people only as they are ' +
        'named in the source. Keep the tone factual and non-accusatory — ' +
        'this document is read by the same team it describes.',
      output_config: {
        // Cross-referencing dozens of debriefs to spot that three differently-
        // worded complaints are the same issue is the whole value here, so
        // this is worth real thinking. It's a user-initiated action with a
        // spinner, not a latency-critical path.
        effort: 'high',
        format: { type: 'json_schema', schema: SYNTHESIS_SCHEMA },
      },
      messages: [{
        role: 'user',
        content:
          `${debriefs.length} submitted production debriefs follow. Synthesize ` +
          `them into wins, issues, things learned, and money still to collect.\n\n` +
          corpus,
      }],
    })
  } catch (err) {
    console.error('[synthesize-debriefs] Anthropic request failed:', err)
    const status = (err as { status?: number })?.status
    if (status === 429) return json({ error: 'AI service rate limited — try again shortly' }, 429)
    return json({ error: 'Synthesis failed' }, 502)
  }

  // Safety classifiers can decline with a 200 — check before reading content.
  if (response.stop_reason === 'refusal') {
    console.warn('[synthesize-debriefs] refused:', response.stop_details)
    return json({ error: 'The AI declined to synthesize these debriefs' }, 422)
  }
  if (response.stop_reason === 'max_tokens') {
    console.warn('[synthesize-debriefs] truncated at max_tokens')
    return json({ error: 'Too much material — select fewer debriefs' }, 413)
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[synthesize-debriefs] no text block in response')
    return json({ error: 'Synthesis returned nothing' }, 502)
  }

  let synthesis: unknown
  try {
    synthesis = JSON.parse(textBlock.text)
  } catch {
    console.error('[synthesize-debriefs] JSON parse failed')
    return json({ error: 'Synthesis was malformed' }, 502)
  }

  return json({ synthesis })
})
