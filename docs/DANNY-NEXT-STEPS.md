# Danny — click by click

*Written 2026-07-25. Everything below is on YOU (needs your logins). Nothing
here is optional-nice-to-have; each one unblocks a feature that is already
built and shipped but currently inert.*

**Time: ~15 minutes total.** Do them in order — Part 1 is 3 minutes and
unblocks two features immediately.

---

## PART 1 — Deploy 3 edge functions (3 min)

The code is live on the site. These three server functions were never pushed,
so the features they power silently do nothing.

| Function | What's broken without it |
|---|---|
| `transcribe` | Every dictation mic in the app (they're hidden until this lands) |
| `slack-bot` | `@balance` in Slack — never worked, never deployed |
| `synthesize-debriefs` | The Synthesize button on /debriefs |

### Steps

1. Open a terminal.
2. `cd` into the Balance repo:
   ```
   cd C:\Users\danie\balance
   ```
3. Paste this, press Enter, wait for "Deployed Functions on project":
   ```
   supabase functions deploy synthesize-debriefs --project-ref ectyohuqgpnwivpjpuga
   ```
4. Then this one (the `--no-verify-jwt` matters — Slack can't send a Supabase
   auth header, so the function checks Slack's signing secret instead):
   ```
   supabase functions deploy slack-bot --no-verify-jwt --project-ref ectyohuqgpnwivpjpuga
   ```
5. Then this one:
   ```
   supabase functions deploy transcribe --project-ref ectyohuqgpnwivpjpuga
   ```

**If step 3 says "Access token not provided" or similar:** run `supabase login`
first, finish in the browser, then repeat from step 3.

### Check it worked

Go to https://balance-orbital.vercel.app/debriefs, tick any debrief, hit
**Synthesize**. If you get a review document, Part 1 is done. (If you have no
submitted debriefs yet, skip the check — Part 3 covers making one.)

---

## PART 2 — Slack app so `@balance` works (10 min, one time)

After this, typing `@Balance scissor lift showed up damaged` in a channel named
after a production files it as a Quick Note on that production.

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

10. Back in your terminal, run these two (paste your real values):
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
13. Wait for the green **Verified**. If it stays red, the function isn't
    deployed (redo Part 1 step 4) or the signing secret is wrong (redo 2d).
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

## PART 3 — 5-minute test pass on the new stuff (2 min)

All of this is already live; just confirming it works for you.

1. **Quick note** — on any page, tap the ✏️ pencil (bottom right, above the
   feedback button). Pick a production, type, **Add note**.
2. **Home-screen note button** — on your phone, open
   `balance-orbital.vercel.app/note`, then Share → **Add to Home Screen**. That
   icon now opens straight into the note composer.
3. **Formatted debrief** — open a production → **Debrief** tab → **Submit
   Debrief**. You should see a formatted document, not a text dump. Hit
   **Print / PDF** to see the PDF.
4. **Synthesize** — /debriefs → tick 2+ debriefs → **Synthesize**.
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
