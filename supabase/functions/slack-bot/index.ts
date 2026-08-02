// Slack bot — receives event subscriptions and turns app_mention messages into
// coming_soon_items rows.
//
// Setup runbook lives in docs/slack-bot-setup.md. The short version:
//   1. Create a Slack app, add the `app_mentions:read` bot scope, install to
//      workspace, copy the Bot Token and Signing Secret.
//   2. Set Supabase Edge Function secrets:
//        supabase secrets set SLACK_SIGNING_SECRET=...
//        supabase secrets set SLACK_BOT_TOKEN=...
//        supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   (already set)
//   3. Deploy: supabase functions deploy slack-bot --no-verify-jwt
//      (The --no-verify-jwt flag lets Slack hit it without a Supabase auth
//      header. We do our own auth via the Slack signing secret instead.)
//   4. Set the Event Subscriptions Request URL in the Slack app dashboard to
//      https://<project-ref>.supabase.co/functions/v1/slack-bot
//      Slack sends a one-time `url_verification` challenge which this
//      function answers; the URL turns green when verified.
//   5. Subscribe to the `app_mention` bot event and Save.
//   6. Invite the bot to any channel and @-mention it with a quick note —
//      it lands in the Coming Soon page within a second.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SLACK_SIGNING_SECRET = Deno.env.get('SLACK_SIGNING_SECRET') ?? ''
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Verify the Slack signature on every incoming request. Without this anyone
// could POST events to our public endpoint.
async function verifySlackSignature(body: string, headers: Headers): Promise<boolean> {
  const ts = headers.get('x-slack-request-timestamp')
  const sig = headers.get('x-slack-signature')
  if (!ts || !sig) return false

  // Reject anything older than 5 minutes — replay protection.
  const tsNum = parseInt(ts, 10)
  if (!isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false

  const base = `v0:${ts}:${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SLACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const macBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base))
  const hex = Array.from(new Uint8Array(macBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  const expected = `v0=${hex}`

  // Constant-time compare
  if (expected.length !== sig.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return mismatch === 0
}

// Strip the leading "<@U123ABC>" bot mention from a Slack message text so the
// stored coming-soon item is just the human-typed content.
function stripBotMention(text: string): string {
  return text.replace(/^<@[^>]+>\s*/, '').trim()
}

// ─── Channel → production routing ────────────────────────────────────────────
// Danny: "the slack channel will be named the production so it would be great
// if we could just recognize which channel it's posted in."
//
// So an @balance in #verizon-nfl lands as a Quick Note on the Verizon NFL
// production — no syntax to remember on set. Anything we can't match with
// confidence still lands in Coming Soon rather than being dropped.

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN') ?? ''

// Comparable form: lowercase alphanumerics only. "Verizon NFL (Reshoot)" and
// "verizon-nfl-reshoot" both become "verizonnflreshoot".
function slug(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Slack's app_mention event carries a channel ID, not a name. Resolve it.
// Requires the `channels:read` bot scope (plus `groups:read` for private
// channels) — without it this returns null and we fall back to Coming Soon.
async function fetchChannelName(channelId: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN || !channelId) return null
  try {
    const res = await fetch(
      `https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } },
    )
    const body = await res.json()
    if (!body?.ok) {
      console.warn('[slack-bot] conversations.info failed:', body?.error)
      return null
    }
    return (body.channel?.name as string) || null
  } catch (err) {
    console.error('[slack-bot] conversations.info threw:', err)
    return null
  }
}

// Match a channel name against live productions. Exact slug match wins; then
// containment either way (channel "verizon-nfl-shoot" contains production
// "Verizon NFL"). Ties go to the LONGEST production name — the most specific
// match — and an ambiguous tie is treated as no match rather than guessing
// the wrong production.
function matchProduction(
  channelName: string,
  productions: Array<{ id: string; name: string; debrief_notes: unknown }>,
): { id: string; name: string; debrief_notes: unknown } | null {
  const chan = slug(channelName)
  if (chan.length < 3) return null

  const exact = productions.filter((p) => slug(p.name) === chan)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null

  const partial = productions.filter((p) => {
    const s = slug(p.name)
    // Guard against 1–2 character names matching everything.
    return s.length >= 4 && (chan.includes(s) || s.includes(chan))
  })
  if (partial.length === 0) return null

  partial.sort((a, b) => slug(b.name).length - slug(a.name).length)
  // Two equally-specific candidates → ambiguous; don't guess.
  if (partial.length > 1 && slug(partial[0].name).length === slug(partial[1].name).length) {
    return null
  }
  return partial[0]
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()

  // ── Slack URL verification handshake ────────────────────────────────────
  // Slack sends this once when you save the Request URL in the dashboard.
  // We answer with the challenge to prove we own the endpoint. No signature
  // is sent on this initial probe.
  try {
    const probe = JSON.parse(body)
    if (probe?.type === 'url_verification' && typeof probe?.challenge === 'string') {
      return new Response(probe.challenge, { headers: { 'Content-Type': 'text/plain' } })
    }
  } catch {
    // body wasn't JSON — fall through, signature check will reject below
  }

  // ── Signature check ─────────────────────────────────────────────────────
  if (!await verifySlackSignature(body, req.headers)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Event routing ───────────────────────────────────────────────────────
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const event = payload.event as Record<string, unknown> | undefined
  if (!event) {
    // Slack sometimes pings without an event (retries, etc) — ack gracefully.
    return new Response('OK', { status: 200 })
  }

  // We only care about app_mention. Slack will deliver many other events if
  // the bot ever gets broader scopes; ignore the rest.
  if (event.type !== 'app_mention') {
    return new Response('OK', { status: 200 })
  }

  const rawText  = (event.text as string) ?? ''
  const cleaned  = stripBotMention(rawText)
  if (!cleaned) {
    // Empty @-mention; nothing useful to record. Ack and bail.
    return new Response('OK', { status: 200 })
  }

  // Pull friendly user / channel labels if Slack gave us names; fall back to
  // raw IDs. The Slack `user` field is just an ID by default — `user_name`
  // and `channel_name` are populated for some event types but not all.
  const userName  = (event.user_name as string) || (event.user as string) || null
  const channelId = (event.channel as string) || ''

  // Prefer the channel NAME — that's what identifies the production. Slack
  // only sends the id on app_mention, so resolve it (needs channels:read).
  const channelName = (event.channel_name as string) || await fetchChannelName(channelId) || channelId || null

  // ── Route to a production when the channel names one ──────────────────────
  if (channelName) {
    // Finished work shouldn't absorb notes from a channel reused later.
    const { data: productions, error: prodError } = await supabase
      .from('productions')
      .select('id, name, debrief_notes')
      .neq('status', 'Completed')

    if (prodError) {
      console.error('[slack-bot] production lookup failed', prodError)
    } else {
      const match = matchProduction(channelName, productions || [])
      if (match) {
        // Read-modify-write on a jsonb array. Two notes landing in the same
        // instant could drop one; at on-set note volume that's acceptable,
        // and it avoids a migration for a dedicated table.
        const notes = Array.isArray(match.debrief_notes) ? match.debrief_notes : []
        const note = {
          id: crypto.randomUUID(),
          text: cleaned,
          authorId: '',
          authorName: userName ? `${userName} (Slack)` : 'Slack',
          at: new Date().toISOString(),
        }
        const { error: noteError } = await supabase
          .from('productions')
          .update({ debrief_notes: [...notes, note] })
          .eq('id', match.id)

        if (!noteError) {
          console.log(`[slack-bot] note → production "${match.name}" from #${channelName}`)
          return new Response('OK', { status: 200 })
        }
        console.error('[slack-bot] note insert failed', noteError)
        // Fall through — better in Coming Soon than lost.
      }
    }
  }

  // ── No production matched: keep the original Coming Soon behaviour ────────
  const { error } = await supabase
    .from('coming_soon_items')
    .insert({
      text: cleaned,
      source: 'slack',
      slack_user_name: userName,
      slack_channel_name: channelName,
    })

  if (error) {
    console.error('[slack-bot] insert failed', error)
    // Don't 500 back to Slack — they'll retry. Acknowledge and log instead.
    return new Response('OK', { status: 200 })
  }

  return new Response('OK', { status: 200 })
})
