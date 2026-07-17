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

## Module 1 — Data hygiene & truth (`#10`, `#12`)

- **#10 wipe fake data:** run `supabase/demo-wipe.sql` (removes flagged demo
  productions/tasks/contractors), then for the rest:
  ```sql
  delete from public.contractors;               -- Danny: clear ALL contractors
  -- inspect anything else that looks seeded:
  select id, name, client, is_demo from public.productions order by created_at;
  ```
  LED walls / To-Dos / Feedback are per-browser localStorage until their Supabase
  port — clearing those means clearing them in the browser (or shipping the port,
  which is the better fix).
- **#12 analytics with real data + participation tracking:** build the
  `activity_events` table (who did what, when — assigns, completions, creates,
  status changes) and rebuild Analytics on top of it: per-person activity, task
  assign/complete flows, app usage. This was already Phase-2 "activity feed"
  groundwork — promoted here because it feeds analytics too. No fake numbers
  anywhere; empty states where there's no data yet.

## Module 2 — Tasks & To-Dos consolidation (`#14`)

One work system instead of two. Design questions to settle with Danny at module
start (production-bound vs freestanding, personal vs team visibility, where
dailies live), then: merge To-Dos into tasks with an optional production link,
port off localStorage to Supabase in the same stroke, keep the quick-add
ergonomics the To-Dos page got right.

## Module 3 — Parsing & voice everywhere (`#2`, `#11`, `#19`)

- **#11 contractor from screenshot:** "Add from screenshot" on the Contractors
  page — reuse `parse-intake` (already extracts name/email/phone/company/role)
  to prefill the contractor form from a photo of a call sheet, email sig, or
  business card.
- **#19 speech-to-text everywhere:** the Whisper pipeline (edge function +
  `VoiceRecorder`) already exists and is deployed — add a mic button to every
  long-text field (descriptions, notes, debrief, comments). No new model needed
  (skip Gemma; Whisper is already wired and paid for).

## Module 4 — Beyond "productions" (`#5`, `#6`, `#18`)

- **#5 tours / tech scouts / prelights / wraps:** proposal — a `kind` field on
  the record (Production / Tour / Tech Scout / Prelight / Wrap) driving tailored
  fields, starter templates, and calendar treatment; prelights/scouts/wraps can
  also attach to a parent production as phases. Tours get their own creation
  path ("New Tour") that skips production-only fields. Confirm shape at module
  start.
- **#6 debrief rework:** add-ons as selectable dropdown items with cost × days
  used; quick-notes capture DURING production (one-tap notes that accumulate);
  end-of-production kicks out a formatted debrief document from the accumulated
  notes + costed add-ons.
- **#18 Nitzkin quoting app integration:** auto-trigger production statuses from
  quotes. **Blocked on discovery** — need what the quoting app is (URL/repo/
  export format) and what transitions it should drive.

## Module 5 — Frictionless feedback (`#3`)

Global floating feedback control on every page (notes / feature / bug dropdown),
2-field capture, no navigation. Depends on Feedback moving to Supabase (else
reports stay trapped in each browser) — do the port as part of this module.

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
  errors. **AWAITING DANNY'S EYES — he said "be bold, we can dial back", so
  expect a tune request (single knob: the `--fx-*` blocks in `index.css`).**
- ⏳ **M6 remaining:** page-level composition polish (dashboard layout, detail
  pages), image-upload backdrops (needs storage), full account page, and
  **#17 constellation/grav-map rework** (its own session — big canvas).
  - Key files: `src/components/layout/BackgroundFX.jsx`,
    `src/context/BackgroundContext.jsx` (preset registry),
    `src/index.css` (BACKGROUND FX section + `--fx-*` vars in both themes),
    `src/components/brand/OrbitalLogo.jsx` (official emblem paths),
    `src/components/layout/AccountMenu.jsx` (picker), `public/brand/*`.

## Module 7 — Automation & cross-fill (`#16`)

Field-by-field audit: every typed input that could be derived, prefilled from
another page, or defaulted, gets wired (dates → status, wall pick → type →
location, contacts → bible → debrief participants, etc.). Runs last on purpose —
every earlier module reduces the surface this has to cover.

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
