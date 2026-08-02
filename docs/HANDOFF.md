# Balance — Session Handoff

*Updated 2026-07-25 (end of a long feedback-driven session). Read this, then
`docs/DANNY-NEXT-STEPS.md` (what's on Danny), then go.*

## 🔴 START HERE

**The app is healthy and fully deployed. The blocker is three undeployed edge
functions**, all of which have shipped client code that silently does nothing
without them:

| Function | State | Powers |
|---|---|---|
| `parse-intake` | ✅ deployed (401 = auth gate, correct) | Screenshot parsing in intake |
| `transcribe` | ❌ **404 — never deployed** | Every dictation mic (hidden behind `VITE_VOICE_ENABLED`) |
| `slack-bot` | ❌ **404 — never deployed** | `@balance` → production Quick Notes. Has never worked. |
| `synthesize-debriefs` | ❌ **404 — new this session** | The Synthesize button on /debriefs |

Verify at any time:
```bash
for fn in parse-intake transcribe slack-bot synthesize-debriefs; do
  curl -s -o /dev/null -w "$fn %{http_code}\n" -X POST \
    "$VITE_SUPABASE_URL/functions/v1/$fn" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" -d '{}'
done   # 401 = deployed, 404 = not
```
Deploy commands + the full Slack app setup are in `docs/DANNY-NEXT-STEPS.md`.
**Danny must run these** — the permission layer blocks production deploys from
an agent session.

## ✅ Database is fully caught up (verified live 2026-07-25)

Every column and table the app expects exists: `productions.sheet`,
`.card_image`, `.debrief_notes`, `.published`; `pipeline_quotes.mode`,
`.custom_lines`; `pipeline_deals.files`; `led_walls`, `activity_events`,
`feedback_items`, `coming_soon_items`, `pipeline_role_assignments`.

`docs/RUN-THIS-SQL.md` now opens with a single **idempotent catch-up block**
plus a verification query. Danny reports it's run. Two items can't be verified
from outside (RLS hides rows and constraints) — the `Revisit` feedback status
and Mark's grant — but both are in that block.

**Hard rule (unchanged):** any SQL handed to Danny must be idempotent. One
already-exists error rolls back his whole paste.

## ⚠️ Dev-environment limitation — read before "verifying" anything

There is **no Supabase session in dev** (the /login dev bypass sets a
`currentUser` but no real auth). Consequences:

- **Productions are remote-only.** A created production appears optimistically,
  then RLS rejects the insert and it **rolls back within ~1 second**. You can
  sometimes catch UI in that window with a 25–40ms `setInterval` poll, but it
  is unreliable. Don't claim a production-scoped UI is verified unless you
  actually captured it.
- **Pipeline HAS a localStorage fallback** — deals, quotes, and the whole quote
  builder are fully testable in dev (`Seed demo deals` on /pipeline). Use this.
- **Backdrops, feedback items, and anything localStorage-backed** are testable.
- When a UI can't be exercised, **unit-test the pure logic in node** (`node
  /tmp/x.mjs`) and say plainly in the commit + to Danny what was and wasn't
  verified. Several commits this session do exactly that — keep that honesty.

Useful dev trick: `localStorage.setItem('balance_dev_view_as','danny')` then
reload to get admin-gated UI.

## What shipped this session (23 commits, all live)

Danny sent a 36-item feedback dump plus a running stream of follow-ups. All of
it is on `master` and deployed to `balance-orbital.vercel.app`.

**Bugs fixed:** auth role flickering to Crew (transient profile-fetch failures
were substituting a synthetic crew profile — now retries + caches last-known);
mobile keyboard covering the focused field (overlay was pinned to the *layout*
viewport, not the visual one); camera-only photo pickers (`capture` attr);
abbreviated day labels; breadcrumbs showing raw UUIDs; add-on "Custom" buried
in a native dropdown; card sort order; dropdowns rendering pale-on-pale on
desktop; stats unreadable over card artwork.

**Features:** production cheat sheet on cards (type/content/supervisor/
operator/stage-mgr/hours/spaces, two-way synced); core-crew dropdowns with
type-in names that persist as contractors; remembered custom position titles;
card images with reframe + coverage + text-backdrop sliders; full Edit sheet
with mobile twirl-downs; custom-deal-as-quote (builder + PDF); deal files with
gate auto-check; quote line-item search; New Deal autocompletes; feedback edit
+ Revisit status; drag-and-drop backdrops; pull-to-refresh; formatted debrief
documents; AI debrief synthesis; Slack + in-app on-set note capture.

## Notable design decisions (don't undo these)

- **Custom quote `mode` is an explicit persisted column, not inferred from
  `custom_lines.length > 0`.** Inferring it would mean adding one custom add-on
  to a finished standard quote silently wipes everything else off the client
  PDF.
- **Card cheat-sheet labels use the `subtle` token, not white.** The panel is
  near-black in dark mode and near-**white** in light mode; hardcoded white
  vanishes for light-theme users.
- **Slack notes route by channel NAME → production** (Danny's idea, better than
  the bracket syntax originally proposed). Most-specific match wins, Completed
  productions excluded, unmatched falls back to Coming Soon — never dropped.
  Unit-tested 8/8 in `matchProduction`.
- **No native widget was promised.** A true iOS home-screen widget needs a
  native app. `/note` is the honest substitute — a route that can be saved to
  the home screen and opens straight into the composer. Don't let this get
  re-described as a widget.
- **`addImage` reads through a ref, not the `images` closure** — a burst of
  adds (multi-file drop) otherwise overwrites itself.

## Open questions for Danny (asked, not yet answered)

1. Card images on **deal and client** cards (productions done; he originally
   asked for both).
2. **Comparison-bid side-by-side** — needs a design conversation.
3. **"Look into adding claude design"** — meaning never established.
4. **"Analyze screenshot server bug"** — needs the attached screenshot;
   `parse-intake` IS deployed, so worth retesting first.
5. **Commercial vs movie** — Overview's "What" line derives the job word from
   the venue. Offer a real project-category field?

## Loose ends worth knowing

- **Four background bug-hunt agents** (data layer, pipeline, pages/forms,
  crash-safety) were launched at the start of this session and never reported
  before the process exited. Their transcripts are on disk. Nothing depends on
  them, but a fresh sweep might be worth re-running.
- **Main bundle is ~871 kB (234 kB gzip)**, up from ~172 kB. Not a bug, but a
  slow first load on a phone; worth a look at what's in the shared chunk.
- `docs/IMPROVEMENTS.md` still tracks the original 22-item list and is stale
  relative to this session.

## Environment facts

- **Repo:** `github.com/incogkahuna/balance`, branch `master`. Vercel
  auto-deploys on push; confirm by watching the `index-*.js` hash change on
  `https://balance-orbital.vercel.app`.
- **Working copy used this session:** `C:\Users\danie\balance`. Danny also has
  `C:\Users\danie\OneDrive\Documents\GitHub\balance` — check `git log`
  freshness before assuming which is current.
- **Supabase:** ref `ectyohuqgpnwivpjpuga`. Free tier — auto-pauses after ~7
  idle days and looks like an outage (NXDOMAIN); un-pause in the dashboard.
- **`.env.local`** holds `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — handy
  for auditing live schema with `curl` (see the START HERE block).
- **Danny's workflow:** he pastes SQL into the Supabase dashboard editor, wants
  click-by-click when multitasking, and prefers being told plainly when
  something can't be verified over being told it works.
