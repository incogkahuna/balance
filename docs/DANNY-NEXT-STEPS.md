# Danny — click by click

*Updated 2026-08-02. Part 1 is DONE (you ran the three deploys). What's left is
Part 2 (Slack) and Part 3 (dictation keys). Each one unblocks a feature that is
already built and shipped but currently inert.*

**Time left: ~15 minutes.**

---

## ✅ PART 1 — Deploy 3 edge functions — DONE 2026-08-02

You ran all three. Verified live: `transcribe`, `slack-bot`,
`synthesize-debriefs` all return 401 (deployed + auth gate) instead of 404.

**What that turned on immediately:** the **Synthesize** button on /debriefs.
`ANTHROPIC_API_KEY` was already set on the project, so it works right now — go
to https://balance-orbital.vercel.app/debriefs, tick 2+ submitted debriefs, hit
**Synthesize**.

**What it did NOT turn on:** Slack (needs Part 2) and dictation (needs Part 3).
Deploying the function is only half of each of those.

---

## PART 2 — Slack app so `@balance` works (10 min, one time)

Confirmed still needed: `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` are not in
the Supabase secrets list. After this, typing `@Balance scissor lift showed up
damaged` in a channel named after a production files it as a Quick Note on that
production.

### 2a. Create the app

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. App Name: `Balance` · pick the Orbital workspace → **Create App**

### 2b. Add permissions

4. Left sidebar → **OAuth & Permissions**
5. Scroll to **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope**
6. Add all four, one at a time:
   - `app_mentions:read`
   - `channels:read`  ← **this is the one that reads the channel name**
   - `groups:read`  (only needed if any production channel is private)
   - `chat:write`

### 2c. Install and copy two secrets

7. Scroll up on the same page → **Install to Workspace** → **Allow**
8. Copy the **Bot User OAuth Token** (starts `xoxb-`). Keep the tab open.
9. Left sidebar → **Basic Information** → **App Credentials** → copy the
   **Signing Secret**.

### 2d. Give the secrets to Supabase

10. Back in your terminal (`cd C:\Users\danie\balance`), run these two with your
    real values pasted in:
    ```
    supabase secrets set SLACK_BOT_TOKEN=xoxb-YOUR-TOKEN-HERE --project-ref ectyohuqgpnwivpjpuga
    ```
    ```
    supabase secrets set SLACK_SIGNING_SECRET=YOUR-SIGNING-SECRET-HERE --project-ref ectyohuqgpnwivpjpuga
    ```

### 2e. Point Slack at the function

11. Slack sidebar → **Event Subscriptions** → toggle **On**
12. Request URL — paste exactly:
    ```
    https://ectyohuqgpnwivpjpuga.supabase.co/functions/v1/slack-bot
    ```
13. Wait for the green **Verified**. The function IS deployed now, so if it
    stays red the signing secret is wrong — redo 2d.
14. Below that → **Subscribe to bot events** → **Add Bot User Event** →
    `app_mention` → **Save Changes** (bottom right).
15. If Slack shows a yellow "reinstall your app" banner, click it → **Allow**.
    **If you reinstall, the bot token changes — redo the first command in 2d
    with the new token.**

### 2f. Try it

16. In Slack, open a channel named after a real production (e.g.
    `#verizon-nfl`). Type `/invite @Balance` and Enter.
17. Type: `@Balance testing balance notes`
18. Open that production in Balance → **Debrief** tab → the note should be in
    **Quick Notes**, credited to `yourname (Slack)`.

**If it lands in Roadmap / Coming Soon instead:** the channel name didn't match
a production name closely enough, or `channels:read` is missing. Notes are
never lost — they fall back there by design.

---

## PART 3 — Turn on dictation (5 min)

The `transcribe` function is deployed but currently answers
`{"error":"Server not configured"}` — it has no OpenAI key. And the mic buttons
are hidden behind a build flag. **Both** steps are needed; either one alone does
nothing.

### 3a. Give Supabase the OpenAI key

1. Get an OpenAI API key: https://platform.openai.com/api-keys → **Create new
   secret key** → copy it (starts `sk-`). *(This is a separate account from
   Anthropic — the Claude key already on the project won't work for Whisper.)*
2. In your terminal:
   ```
   supabase secrets set OPENAI_API_KEY=sk-YOUR-KEY-HERE --project-ref ectyohuqgpnwivpjpuga
   ```
   No redeploy needed — secrets apply immediately.

### 3b. Unhide the mic buttons (Vercel)

3. Go to https://vercel.com → the **balance** project → **Settings** →
   **Environment Variables**
4. **Add New**:
   - Key: `VITE_VOICE_ENABLED`
   - Value: `true`
   - Environments: tick **Production**, **Preview**, **Development**
5. **Save**
6. Go to the **Deployments** tab → the top (most recent) deployment → **⋯** menu
   on the right → **Redeploy** → **Redeploy**. Wait ~1 min for it to go green.
   *(Env vars only apply to builds made after you set them — the redeploy is
   what makes it take.)*

### 3c. Try it

7. Open https://balance-orbital.vercel.app on your phone, go to any production →
   **Debrief** tab. You should now see a 🎤 mic next to the note box. Tap, talk,
   tap again — the text should appear.

**If you'd rather not pay for OpenAI:** skip Part 3 entirely. Everything else in
the app works without it; the mics just stay hidden, which is exactly how it
behaves today.

---

## PART 4 — 5-minute test pass on the new stuff (2 min)

All of this is already live; just confirming it works for you.

1. **Synthesize** — /debriefs → tick 2+ debriefs → **Synthesize**. (Newly
   unblocked by your deploys.)
2. **Quick note** — on any page, tap the ✏️ pencil (bottom right, above the
   feedback button). Pick a production, type, **Add note**.
3. **Home-screen note button** — on your phone, open
   `balance-orbital.vercel.app/note`, then Share → **Add to Home Screen**. That
   icon now opens straight into the note composer.
4. **Formatted debrief** — open a production → **Debrief** tab → **Submit
   Debrief**. You should see a formatted document, not a text dump. Hit
   **Print / PDF** to see the PDF.
5. **Keyboard fix** — on your phone, open a production → Edit → scroll to
   Package notes → tap the box. The keyboard should no longer cover it.
6. **Card image** — Productions → hover a card → 🖼 icon → upload. Then
   Edit → **Card image** to reframe and set coverage / text backdrop.

---

## Still waiting on you (design calls, no rush)

These are built-or-buildable but I need your answer first:

1. **Card images on deal and client cards** — you asked for productions AND
   deals originally; I built productions. Want it on deals/clients too?
2. **Comparison-bid side-by-side** — needs a 5-minute conversation about what
   you want on screen.
3. **"Look into adding claude design"** — I never understood what this meant.
4. **The "analyze screenshot server bug"** — paste the screenshot. (May just
   have been `parse-intake`; that one IS deployed, so retest first.)
5. **Commercial vs movie** — the Overview summary currently derives "TVC
   commercial" from the venue. Want a real project-category dropdown?
