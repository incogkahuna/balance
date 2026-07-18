# Balance — Session Handoff

*Updated 2026-07-17 early AM (end of the marathon session: M6 dial-ups,
modules M1–M7, Danny's 12-item live review, roster dedup). Read this first,
then `docs/IMPROVEMENTS.md` (the working plan), then go.*

## What this project is right now

Balance is Orbital Studios' production-management app (React 18 + Vite +
Tailwind + Supabase, deployed on Vercel at `balance-orbital.vercel.app`,
repo `github.com/incogkahuna/balance`, branch `master`). Danny (owner,
`dhorgan@orbitalvs.com`) decided AGAINST a full rebuild — instead we're
working module-by-module through his 22-item improvement list, triaged in
**`docs/IMPROVEMENTS.md`** (that file is the plan of record; keep its
statuses current). `docs/AUDIT-2026-07.md` is the deeper original audit.

## ⭑ START HERE — current state + what's next

**Where things stand (all verified, all pushed & live on Vercel):**
- Danny's 22-item list is essentially DONE. M0, M1–M7, M6 (three drops),
  and his 12-item New Production review round are all shipped.
- **The DB migrations are RUN and verified** — Danny pasted RUN-THIS-SQL.md
  and the 5-way diagnostic returned all `true` (activity_events, tasks
  visibility+completed_at, productions.kind, feedback_items). Do NOT ask
  him to run them again.
- **Profile "duplicates" are RESOLVED — nothing was deleted.** The profiles
  table was always clean (3 real people: Danny Horgan, Mark, Wilder Herms,
  all admin). The dupes Danny saw were the hardcoded legacy USERS roster
  rendering next to real profiles. Fixed in code: `buildRoster()` in
  models.js merges them (profiles win; legacy survives only if unmatched
  by email/full-name/unambiguous-first-name; the two Brians stay separate).
  Every picker now reads `users` from AppContext. NEVER hand Danny SQL to
  delete profiles for this — block 0 of RUN-THIS-SQL.md is superseded.

**Immediate next tasks, in order:**
1. **Deploy the two edge functions** — the ONLY infra thing left.
   `transcribe` returns 404 (genuinely undeployed — Danny's mic error);
   `parse-intake` needs a redeploy to pick up the new `events` extraction
   (scout/prelight/shoot dates → form dates + milestone seeds). CLI on this
   machine is logged in; the deploy needs Danny's permission approval:
   `supabase functions deploy transcribe --project-ref ectyohuqgpnwivpjpuga`
   `supabase functions deploy parse-intake --project-ref ectyohuqgpnwivpjpuga`
   Danny has been asked twice and hasn't said "deploy" yet — ask once,
   don't nag.
2. **Danny re-tests New Production on the live site** with a real screenshot
   (post-redeploy) — that's the end-to-end proof of the events parsing.
3. **Get Danny's real starter-task checklist per production type** — the
   Review step currently offers the old template titles as unchecked,
   fully-editable suggestions; he called the templates fake data.
4. **Nitzkin discovery (#18)** — still the only 22-list item blocked: what
   the quoting app is, which statuses quotes drive.
5. Then: **#17 constellation/grav-map rework** (own session, big canvas)
   and M6-remaining polish (page composition, image-upload backdrops, full
   account page).

**Still on Danny (older items):** demo-wipe SQL (#10), confirm phase6h ran,
Supabase free→paid upgrade.

## Session log — what shipped TODAY (2026-07-16), all pushed & live

1. **Roles fixed via SQL** (user ran it): every existing profile promoted to
   admin; `laura@orbitalvs.com` + `aida@orbitalvs.com` pre-authorized as
   admin in `role_assignments`. Danny's "can't edit production" mystery was
   his account defaulting to crew.
2. **Task-creation data-loss bug fixed** (`a903c49`): TaskForm eager-created
   an empty placeholder the API rejected (title required) → tasks never
   persisted. Now creates on first title keystroke. This also explained his
   "fake tasks stay, my tasks vanish" complaints (intake starter tasks always
   had titles, so they persisted).
3. **Module 0 quick wins** (`9a6a460`, `8a141ee`): Little Dipper purged
   (stage no longer exists); TVC AOTO→In-House / Mobile CAR→Mobile auto-map
   + redundant intake question skipped; intake screenshots land openable in
   the Bible (real dataURL + MIME); starter tasks are opt-out toggles on
   Review; screenshot-attach toast + count chip + paste hint; date-driven
   status ladder (Incoming→Active→Wrap→Completed+30d, forward-only,
   admin-session reconcile on load); Prelight milestone type added;
   Analytics hooks fix etc. — full table in IMPROVEMENTS.md.
4. **Module 6 (UI) first drop** (`4305232`): official Orbital brand system.
   Marketing vectors live in `public/brand/`; `OrbitalMark`/`OrbitalLogo`
   components use the exact emblem paths + official gradient
   (#55c9ef→#2a7bbb); Inter Tight typography (brand face from orbitalvs.com);
   space-navy dark theme (#070a12) with glass cards; brand-gradient buttons;
   customizable ambient backdrops (Orbit/Starfield/Grid/Aurora/Minimal) via
   `BackgroundFX` + `BackgroundContext`, per-user persisted; `AccountMenu`
   (identity + theme + backdrop picker + sign out = his #21 v1); cinematic
   forced-dark login rebuild; emblem favicon; sidebar/topbar lockups.

Earlier this week (also live): Phase 0 bug blitz, phase7a migration (user
ran it), Tier 2 Claude screenshot parser (`parse-intake` edge function —
DEPLOYED and working, key set), toast system + optimistic rollback.

## Danny's live review round (2026-07-16 late) — SHIPPED (`52fe02d`, `f695d27`, `feeea44`)

Danny tested New Production live and filed 12 notes. All shipped: calendar
icons theme-aware; parser extracts dated events (scout/prelight/shoot) →
fills dates + seeds milestones (needs the parse-intake redeploy to
activate); review makes EVERYTHING editable (milestones, concerns, starter
tasks — now opt-in suggestions pending his real standard checklist); Key
Players = external people (staff filtered out) with manual add +
add-from-screenshot; docs (PDF) upload into Bible; sources open full-size;
real Project Summary on the Summary sub-tab. His "duplicate profiles" note
turned out to be the hardcoded USERS roster rendering beside real profiles
— fixed with the merged `buildRoster()` (`feeea44`), DB was always clean.
Along the way: RUN-THIS-SQL.md rewritten fully idempotent (`538fba9`) after
his re-run hit 42P07 and rolled back — every future hand-off SQL block must
be idempotent (drop policy if exists / create if not exists / guarded
publication adds).

## Session log — MODULES M1–M7 SHIPPED (2026-07-16 evening, all pushed)

After the M6 dial-ups (`4bb8c29`, `6baf4a7` — bold FX, Emblem/Logo Wave/
Logo Flip presets, per-backdrop speed+intensity sliders), Danny said
**"complete all the rest of my request list"** → autonomous module run:

- **M1 (`9cecca6`)** — activity_events + logActivity across all CRUD (logs
  after API success; auto-status tagged meta.auto); Analytics rebuilt on
  real participation (Team Activity, feed, Task Flow, 7/30/90d window,
  real-assignee roster). No fake numbers, honest empty states.
- **M2 (`f91fa60`)** — To-Dos merged into tasks (production_id nullable,
  visibility team|personal — personal = creator+assignee ONLY, no admin
  bypass; completed_at DB-trigger-stamped; crew can create freestanding).
  Same quick-add UX, now Supabase+realtime. One-time localStorage import.
- **M3 (`949e9b7`)** — Contractors "From Screenshot" (parse-intake vision →
  contact → prefilled form); DictationMic (tap-record-tap-transcribe via
  deployed Whisper) on 17+ long-text fields.
- **M4 (`72ae7de`)** — productions.kind (production|tour|internal) + "Create
  New Project" chooser (Production→intake wizard; Tour/Internal→quick form,
  no wall/location); kind chips; debrief rework: during-production Quick
  Notes, ADDON_PRESETS with cost=rate×days×qty auto-calc, Generate Document
  (copyable compiled debrief).
- **M5 (`5f12851`)** — feedback_items table + floating feedback widget on
  every page (Note/Feature/Bug, 2 fields, mic); localStorage fallback +
  import; Bugs & Ideas gained Notes.
- **M7 (`e2b3d32`)** — cross-fills: task due date ← production start,
  milestone date ← production window, client autocomplete ← history.

All verified in dev via JS eval (dev-bypass mode: optimistic→rollback paths
confirmed; server writes need real sessions). **Not load-tested against the
live DB yet — first real-session pass after Danny runs the SQL is the test.**

Still open on the list: **#18 Nitzkin** (blocked on discovery), **#17
constellation rework** (own session), M6-remaining polish (page composition,
image-upload backdrops, full account page).

## Module queue after that (order agreed with Danny)

M1 data truth (activity_events table + rebuilt no-fake Analytics — his #12;
wipe SQL for #10 is written in IMPROVEMENTS.md, user runs it) → M2 Tasks+
To-Dos merge (#14) → M3 parsing/voice everywhere (#11 contractor-from-
screenshot, #19 mic on long text fields — reuse deployed Whisper `transcribe`
fn, NOT Gemma) → M4 beyond-productions → M5 global feedback widget → M7
automation. **M4 notes from Danny:** tours are their own thing — "Create New
Project" button → Internal / Tour / Production chooser (needs a `kind`
column migration); prelight/wrap stay as milestone types (done); tours
likely pull from Google Calendar later; **Nitzkin quoting-app integration
was promised "tomorrow"** (= imminent) — discovery needed: what the app is,
which statuses quotes should drive.

## Environment facts (verify against live before trusting)

- **Working copy:** `C:\Users\danie\OneDrive\Documents\GitHub\balance` is
  Danny's authoritative checkout. A Claude session may run in
  `C:\Users\danie\balance` — check `git log` freshness; push/pull to sync.
  OneDrive causes file-lock flakiness.
- **Supabase:** ref `ectyohuqgpnwivpjpuga` (one `q`), FREE tier —
  auto-pauses after ~7 idle days → NXDOMAIN that looks like an outage;
  un-pause in dashboard. Migrations through `phase7a` are applied; `phase6h`
  status unconfirmed. Edge functions `transcribe` + `parse-intake` deployed
  with keys set.
- **Vercel:** auto-deploys on push to master. Verify deploys by fetching the
  site and checking for a new asset hash.
- **Local dev:** `.claude/launch.json` has "Balance (Vite)" (port 5173). DEV
  login bypass on /login (no real Supabase session → RLS returns no data;
  UI work only). In-app-browser screenshots time out in this environment —
  verify via JS eval (`javascript_tool`) instead.
- **Danny's workflow:** he runs SQL in the Supabase dashboard editor when
  given a block; commit early/often; he switches models via /model — keep
  handoffs model-agnostic.

## Open items on the user

- Run the fake-data wipe (IMPROVEMENTS.md M1: `demo-wipe.sql` + clear all
  contractors) when ready.
- Confirm `phase6h` migration was run.
- Nitzkin quoting app details (tomorrow's session).
- Free→paid Supabase upgrade still pending (stability).

## Key code map (for orientation, verify line numbers live)

- Data hub: `src/context/AppContext.jsx` (all CRUD, optimistic+rollback+
  toast, auto-status effect, profiles roster, resolveUserName).
- Intake: `src/pages/IntakePage.jsx` (Tier 1 sync + Tier 2 async merge),
  `src/features/intake/intakeUtils.js` (heuristics, mergeTier2Results,
  starter tasks/milestones, buildProductionFromDraft),
  `src/lib/parseIntake.ts` ↔ `supabase/functions/parse-intake/index.ts`
  (claude-opus-4-8 vision + structured output).
- Brand/UI: `src/components/brand/OrbitalLogo.jsx`,
  `src/components/layout/BackgroundFX.jsx`, `AccountMenu.jsx`,
  `src/context/BackgroundContext.jsx`, `src/index.css` (tokens + FX),
  `public/brand/` (official vectors).
- Tasks: `src/components/tasks/TaskForm.jsx` (create-on-first-title),
  `TaskCard.jsx` (status pills via getValidTransitions, comments w/ photos),
  `src/features/tasks/taskStatusConfig.js` (canonical done helpers).
