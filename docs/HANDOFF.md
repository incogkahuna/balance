# Balance — Session Handoff

*Updated 2026-07-16 (end of a long working session with Danny). Read this
first, then `docs/IMPROVEMENTS.md` (the working plan), then go.*

## What this project is right now

Balance is Orbital Studios' production-management app (React 18 + Vite +
Tailwind + Supabase, deployed on Vercel at `balance-orbital.vercel.app`,
repo `github.com/incogkahuna/balance`, branch `master`). Danny (owner,
`dhorgan@orbitalvs.com`) decided AGAINST a full rebuild — instead we're
working module-by-module through his 22-item improvement list, triaged in
**`docs/IMPROVEMENTS.md`** (that file is the plan of record; keep its
statuses current). `docs/AUDIT-2026-07.md` is the deeper original audit.

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

## ⭑ IMMEDIATE NEXT TASKS

1. **Danny runs `docs/RUN-THIS-SQL.md`** (one paste in the Supabase SQL
   editor — M1 activity_events, M2 tasks merge, M4 kinds+debrief, M5
   feedback). The live app degrades gracefully until then: activity isn't
   counted, to-dos/feedback stay per-browser, kinds don't persist. After he
   runs it, each browser auto-imports its local to-dos + feedback reports.
2. **Danny's verdict on the whole drop** — M6 backdrops (he can self-tune
   speed/intensity in the account menu now) AND the six modules below.
3. **Nitzkin discovery (#18)** — the only 22-list item still blocked: what
   the quoting app is, which statuses quotes drive.

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
