# Balance — Improvement Plan (Danny's 22, 2026-07-16)

*Danny's request list, triaged into work modules. This supersedes the "rebuild
vs patch" question — decision was: improve in place, module by module.
Numbers (#N) refer to Danny's original list. Keep statuses current as modules land.*

## Already fixed

| # | Item | Status |
|---|---|---|
| 13 | Task creating isn't saving | **FIXED + shipped** (`a903c49`). Root cause: the form pre-created an empty placeholder the API rejected (title required), so every auto-save updated a nonexistent row. Now the task is created on the first keystroke of a title. Note: before the role fix, RLS would ALSO have blocked crew-role creates. Verify in prod. |

## Module 0 — Quick wins (small, independent, one batch)

| # | Item | Plan |
|---|---|---|
| 1 | TVC AOTO → "in-house or mobile?" is redundant | Production type implies location type; auto-fill and skip the question. **Needs mapping confirmed:** TVC AOTO → In-House; Mobile CAR process CLI → Mobile; Little Dipper → ? |
| 2 | No confirmation when screenshot submitted | Visible confirmation at the top of the intake (chip/count + toast) instead of only the bottom list. Paste-to-add already works app-wide on that page — surface it in the UI copy so people know. |
| 7 | Can't open documents added via intake | Bug: intake stores screenshots into the Bible with an empty `url` (`intakeUtils.js` buildProductionFromDraft) — pass the image data through so preview works. |
| 8 | Fake tasks added during production creation | Starter tasks become an opt-in section on the Review step (checkbox list, all visible, deselect what you don't want) instead of silently added. |
| 9 | Package not editable after production created | Investigate + unlock the instruction package editor on the production page post-creation. |
| 20 | Auto status by dates | Derive Incoming/Active from dates; auto-flip to Completed ~1 month past end date (with a manual override that always wins). |
| 4 | Review-production fields that are fake/uneditable | Make every field on the intake Review step genuinely editable. Inventory which ones are display-only and wire them. |

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

## Module 6 — UI/brand overhaul (`#15`, `#22`, `#21`, `#17`)

- **#15/#22 high-end feel + Orbital identity:** design pass across the app —
  Orbital logo integration (need the vector asset), customizable animated
  geometric backgrounds (à la Danny's networth calculator — get reference/repo),
  optional image backgrounds selectable per user, kill the "word doc" feel.
- **#21 user profile/account page:** click avatar → account details, settings,
  background/theme choice, sign-out.
- **#17 Resources constellation/grav-map rework:** make the 3D view convey real
  information elegantly (or replace with something that does). Big canvas item —
  scope at module start.

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
