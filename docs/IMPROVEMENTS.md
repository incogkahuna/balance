# Balance — Improvement Plan (Danny's 22, 2026-07-16)

*Danny's request list, triaged into work modules. This supersedes the "rebuild
vs patch" question — decision was: improve in place, module by module.
Numbers (#N) refer to Danny's original list. Keep statuses current as modules land.*

## Already fixed

| # | Item | Status |
|---|---|---|
| 13 | Task creating isn't saving | **FIXED + shipped** (`a903c49`). Root cause: the form pre-created an empty placeholder the API rejected (title required), so every auto-save updated a nonexistent row. Now the task is created on the first keystroke of a title. Note: before the role fix, RLS would ALSO have blocked crew-role creates. Verify in prod. |

## Module 0 — Quick wins — ✅ SHIPPED 2026-07-16 (plus decisions)

Decisions from Danny: Little Dipper no longer exists (purged everywhere);
prelight + wrap live as **milestone types** (Prelight added with its own color);
tours become their own thing later via a "Create New Project → Internal / Tour /
Production" chooser (M4, needs a `kind` column migration — bundled with the
Nitzkin quoting work).

| # | Item | Status |
|---|---|---|
| 1 | Redundant in-house/mobile question | ✅ TYPE_LOCATION_MAP: TVC AOTO → In-House, Mobile CAR → Mobile; the intake skips the location question when the type answers it; buildProductionFromDraft derives it. Verified live. |
| 2 | No screenshot confirmation | ✅ Toast on attach + green "N screenshots attached" chip in the drop zone + copy now says paste (Ctrl+V) works anywhere on the page. |
| 7 | Can't open intake documents | ✅ Screenshots now stored in the Bible with real image data + MIME type — preview and AI-scan work. |
| 8 | Fake starter tasks | ✅ Review step now has per-task include/exclude toggles (all on by default, live count of what will be created). Verified live. |
| 9 | Package not editable | ✅ No code bug — it's editable for admin/supervisor; Danny's account was crew at the time. Retest as admin. |
| 20 | Auto status by dates | ✅ `computeDateDrivenStatus`: Incoming → Active on start day → Wrap past end → Completed 30 days after. Reconciles once per session on load, forward-only (never demotes a manual advance), admin/sup sessions only. |
| 4 | Fake/uneditable review inputs | ✅ Mostly: dead fake checkbox list → real toggles; dead TYPE_OPTIONS (undefined since phase6b) removed; latent `PRODUCTION_TYPE.OTHER` undefined bug fixed. Remaining display-only: the milestone preview list (edit milestones post-create on the Roadmap tab) — revisit if Danny wants inline milestone editing in review. |

## Module 1 — Data hygiene & truth (`#10`, `#12`) — ✅ CODE SHIPPED 2026-07-16 (`9cecca6`)

- ⏳ **#10 wipe fake data (ON DANNY):** run `supabase/demo-wipe.sql`, then
  `delete from public.contractors;` and inspect remaining seeded productions.
  To-Dos + Feedback are no longer localStorage (M2/M5 ported them) — LED walls
  are the last per-browser store.
- ✅ **#12 analytics with real data:** `activity_events` table (append-only,
  RLS write-as-self / read-all, realtime; **migration in
  `docs/RUN-THIS-SQL.md` — Danny runs it**). `logActivity` in AppContext logs
  after API success (truthful events) across production/task/contractor/
  milestone/comment/feedback actions; auto-status changes tagged `meta.auto`.
  AnalyticsPage rebuilt: Team Activity per-person bars, Recent Activity feed,
  Task Flow by week, 7/30/90d window, roster from real assignees via
  resolveUserName. No fake numbers; honest empty states everywhere.

## Module 2 — Tasks & To-Dos consolidation (`#14`) — ✅ SHIPPED 2026-07-16 (`f91fa60`)

One table, one CRUD path, two views. Design calls made (Danny can veto):
**a to-do = task with `production_id null`**; freestanding tasks carry
`visibility` — `team` (roster-visible, default) or `personal` (creator +
assignee ONLY, no admin bypass); `completed_at` stamped by DB trigger; crew
can create/manage their own freestanding tasks (production-task rules
unchanged). ToDosPage keeps its exact quick-add ergonomics on the shared
store; Dashboard reads freestanding tasks; TasksPage excludes them. One-time
localStorage import per browser (halts + retries until the migration runs;
originals kept in `balance_todos_v1_backup`). **Migration in RUN-THIS-SQL.md.**

## Module 3 — Parsing & voice everywhere (`#2`, `#11`, `#19`) — ✅ SHIPPED 2026-07-16 (`949e9b7`)

- ✅ **#11 contractor from screenshot:** "From Screenshot" button on the
  Contractors page (admin) — drop/paste/pick an image, `parse-intake` (Claude
  vision) extracts contacts, picking one prefills ContractorForm in create
  mode (name/email/phone/role; company lands in notes).
- ✅ **#19 speech-to-text everywhere:** new compact `DictationMic` (record →
  stop → auto-transcribe via the deployed Whisper `transcribe` fn, no review
  step, 120s cap) wired into 17+ long-text sites: TaskForm ×2, TaskCard ×3
  (comment/completion/blocked), debrief FeedbackForm ×4, ProductionForm,
  ContractorForm, MilestoneForm, ConcernForm ×2, Bugs & Ideas details,
  GearPage ×2, AddonForm, debrief quick notes, feedback widget.

## Module 4 — Beyond "productions" (`#5`, `#6`, `#18`) — ✅ #5+#6 SHIPPED 2026-07-16 (`72ae7de`)

- ✅ **#5 project kinds:** `productions.kind` (production | tour | internal —
  per Danny's chooser spec; prelights/wraps stay milestone types per M0).
  "Create New Project" on /productions → Production (full intake wizard) /
  Tour / Internal (quick form hiding LED wall + location). Kind chips on
  cards. **Migration in RUN-THIS-SQL.md.**
- ✅ **#6 debrief rework:** Quick Notes captured DURING production (one-line +
  Enter + mic, author/date stamped, stored in `production.debrief_notes`);
  AddonForm picks from `ADDON_PRESETS` (or custom) with **cost auto-computed
  = day rate × days × quantity** (total editable); "Generate Document"
  compiles debrief answers + costed add-on table + floor notes into a
  copyable plain-text doc.
- ⏳ **#18 Nitzkin quoting app integration:** still **blocked on discovery** —
  need what the quoting app is (URL/repo/export format) and which status
  transitions a quote should drive.

## Module 5 — Frictionless feedback (`#3`) — ✅ SHIPPED 2026-07-16 (`5f12851`)

Floating widget on every page: Note / Feature / Bug + title + optional
details (with mic), Enter or Send — no navigation. Backed by the new
`feedback_items` table (RLS: all read + file-as-self, admin/sup triage,
admin delete, realtime) with graceful localStorage fallback until the
migration runs + one-time import of pre-M5 local reports. Bugs & Ideas page
gained the Note kind. **Migration in RUN-THIS-SQL.md.**

## Module 6 — UI/brand overhaul — FIRST DROP SHIPPED 2026-07-16 (`4305232`)

Direction: "mission control, cinematic" — dark instrument-panel sibling of
orbitalvs.com (Inter Tight brand face, official emblem + gradient throughout).

- ✅ **#15/#22 partially:** official brand vectors in `public/brand/`;
  OrbitalMark/OrbitalLogo components (exact emblem paths, official gradient,
  spin = loading spinner); space-navy dark theme + glass cards; brand-gradient
  buttons/focus/hud-ticks; **customizable ambient backdrops** (Orbit /
  Starfield / Grid / Aurora / Minimal — pure CSS, per-user persisted);
  cinematic login rebuild; emblem favicon; sidebar/topbar lockups.
- ✅ **#21 v1:** AccountMenu — avatar → identity + role chip, theme switcher,
  backdrop picker with mini-previews, sign out.
- ✅ **M6 DIAL-UP SHIPPED 2026-07-16 (`4bb8c29`)** — all five points of Danny's
  drop-1 review ("classy start, too understated"):
  1. Dark `--fx-*` ~3-4× (lines 0.13→0.42, stars 0.55→0.95 + denser tile with
     hot accent stars, glows ~3×); orbit got a corner glow + bigger satellite.
  2. Light mode has its OWN tuning: deeper ink `rgba(30,95,152,…)` at strong
     alphas (0.40 lines / 0.75 stars), not a scaled-down dark theme.
  3. **"Emblem" preset** — 72vmin centered gradient mark, 0.26 opacity dark /
     0.20 light, soft halo + far stars.
  4. **"Logo Wave" preset** — 9×6 field of small marks, diagonal rotateY flip
     wave (per-cell delay + deterministic jitter), theme-driven ink vars.
  5. Orbit watermark repositioned/rescaled (58vmin, gradient fill, opacity
     0.18/0.14 via `--fx-watermark`) — mostly on-screen now, reads clearly.
  Verified in dev both themes, all 7 presets, picker thumbs, no console
  errors.
- ✅ **M6 DIAL-UP 2 SHIPPED 2026-07-16 (`6baf4a7`)** — Danny drop-2 feedback:
  1. **Wave slowed** (step 0.32→0.55s, cycle 9.5→15s) — less frantic roll.
  2. **New "Logo Flip" preset** — same 9×6 mark field but each mark flips on
     its own decorrelated clock (two hashes → independent delay + 5.5-9.5s
     cycle, 8% active window) so one or another flips at random, no front.
  3. **Per-backdrop Speed + Intensity sliders** in AccountMenu (shown for any
     non-Minimal preset, persisted per browser). Speed = `--fx-speed`
     multiplier applied to EVERY preset's animation via `calc(base / speed)`;
     intensity = `.bgfx` container opacity. Wave/flip base delays emit as
     inline `--d`/`--dur` and scale in CSS, so dragging speed never re-renders
     the mark tree. Bounds `BG_SPEED` (0.3–2×) / `BG_INTENSITY` (15–100%)
     exported from BackgroundContext. 8 presets now → 4-col picker.
  Verified in dev: flip preset (54 independent clocks), live slider drag
  updates `--fx-speed`/opacity + durations instantly and persists, sliders
  hide on Minimal, no console errors. **AWAITING DANNY'S EYES.**
- ⏳ **M6 remaining:** page-level composition polish (dashboard layout, detail
  pages), image-upload backdrops (needs storage), full account page, and
  **#17 constellation/grav-map rework** (its own session — big canvas).
  - Key files: `src/components/layout/BackgroundFX.jsx`,
    `src/context/BackgroundContext.jsx` (preset registry),
    `src/index.css` (BACKGROUND FX section + `--fx-*` vars in both themes),
    `src/components/brand/OrbitalLogo.jsx` (official emblem paths),
    `src/components/layout/AccountMenu.jsx` (picker), `public/brand/*`.

## Module 7 — Automation & cross-fill (`#16`) — ✅ SHIPPED 2026-07-16 (`e2b3d32`)

Final pass on top of what earlier modules already wired (type→location + skipped
intake question, dates→status ladder, wall pick→gear reservation sync, addon
cost auto-calc, contractor-from-screenshot prefill, intake contacts→bible key
players): new task due date defaults to production start; new milestone
defaults into the production window (start, 9am); client field autocompletes
from production history.

## Proposed order

**M0 quick wins → M1 data hygiene → M2 tasks consolidation → M6 UI/brand →
M3 parsing/voice → M4 beyond-productions → M5 feedback → M7 automation.**
Rationale: M0+M1 kill the daily irritations and fake data fast; M2 fixes the
core work loop; M6 delivers the "feels like high-end tech" moment; the rest
build on a clean base. Order is Danny's call — M6 can jump the queue.

## Open questions for Danny

1. **#1 mapping:** Little Dipper → In-House or Mobile? (TVC AOTO → In-House,
   Mobile CAR → Mobile assumed.)
2. **#5 shape:** OK with `kind` on the same record + "New Tour" entry point, or
   do tours need to be a fully separate thing?
3. **#18:** what is the Nitzkin quoting app (link/repo/screenshot of output),
   and which statuses should a quote drive?
4. **#22:** where does the networth calculator live (repo/path) so the
   background-pattern system can be lifted? And drop the Orbital logo into the
   repo as SVG/high-res PNG (chat image is low-res raster).
