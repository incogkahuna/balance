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
  const userName    = (event.user_name    as string) || (event.user    as string) || null
  const channelName = (event.channel_name as string) || (event.channel as string) || null

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
