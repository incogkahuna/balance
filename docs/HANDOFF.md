# Balance — Session Handoff

*Updated 2026-07-15. Read this first, then delete/replace when stale.*
*Working copy that has all this state: `C:\Users\danie\OneDrive\Documents\GitHub\balance` (the OneDrive checkout — NOT the Claude worktree, which is behind).*

## TL;DR — start here

Two batches of work are sitting locally, unshipped. Nothing is broken; the build
is green. The safe path to production, in order:

1. **Run migration** `supabase/migrations/20260711000000_phase7a_persist_dropped_fields.sql`
   in the Supabase SQL editor. Phase 0 code writes columns this migration creates
   (task notes, comment photos, contractor fields). Must run **before** the push
   or those saves fail in prod (failures now surface as toasts, so they'd be loud).
2. **`git push`** — ships the 7 committed Phase 0 + docs commits. Vercel
   auto-deploys `balance-orbital.vercel.app`. (The uncommitted Tier 2 WIP below is
   NOT part of these commits, so it won't deploy — that's fine and intended.)
3. **Verify prod** — real Google login → create a production → add a task with a
   note → mark it through the status workflow → confirm no toast errors.
4. **Then** decide on the Tier 2 intake WIP (next section) and Phase 1.

The auth-loop fix is verified working (2026-07-08). Details near the bottom.

---

## UNCOMMITTED WIP — Intake Tier 2 (Claude) — decide what to do with this

There is a **coherent, compiles-clean, but uncommitted** set of changes in the
working tree (created 2026-07-15) that wires up the long-deferred Claude intake
parser — one feature across 8 files (285 insertions). `git status`:

```
?? supabase/functions/parse-intake/index.ts  edge fn (claude-opus-4-8 + vision)
?? src/lib/parseIntake.ts                     Tier 2 client (throws-on-fail → Tier 1 fallback)
 M src/features/intake/intakeUtils.js         + mergeTier2Results()
 M src/pages/IntakePage.jsx                    Tier 1 sync, then Tier 2 async merge
 M src/features/intake/ParsingStage.jsx        parsing-stage UI for the async pass
 M src/features/productionBible/DocumentsReceived.jsx  "AI-scan" a stored doc
 M src/features/productionBible/ProductionBible.jsx     folds scan → Key Players/Concerns
 M supabase/functions/README.md                deploy notes
```

**Two entry points, one client (`parseIntakeInputs`):**
1. **Intake flow** — `handleInputsReady` runs Tier 1 heuristics synchronously
   (instant), then fires Tier 2 async; on success `mergeTier2Results(tier1, tier2)`
   over the draft + regenerates questions; on failure `.catch` → keep Tier 1.
2. **Production Bible → Documents Received** — an "AI scan" button on a stored
   screenshot/PDF runs `parseIntakeInputs` on it and folds extracted contacts into
   Key Players and concerns into Key Concerns (via `onAiExtract`); uses the Phase 0
   toast system for feedback.

Non-blocking *enhancement layer*, never a gate — so the client code is **safe to
commit and push even before the edge function is deployed**; if the function
isn't live, `parseIntakeInputs` throws and both entry points fall back cleanly.

**It builds clean** (`npx vite build` ✓). Recommend committing it soon so it isn't
lost to a stray `git checkout`/reset — even without deploying the function yet.

**To make Tier 2 actually run in prod (user/dashboard actions):**
- `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
- `supabase functions deploy parse-intake`
- Edge fn uses model `claude-opus-4-8` with vision (sends screenshots as image
  content). Confirm that model id is current before relying on it.

**Open question for the next session:** is this WIP finished, or mid-build? It
compiles and the flow is wired, but it hasn't been tested against a live function
(no key/deploy yet). Review `src/lib/parseIntake.ts` + the edge fn + the
IntakePage diff, then either commit + deploy, or finish/adjust first.

---

## COMMITTED, UNPUSHED — Phase 0 bug-fix blitz (7 commits ahead of origin)

From `docs/AUDIT-2026-07.md` (the July functionality audit + Monday-parity plan).
Commits `150f379` → `638bab4`. What shipped:

- **Persisted silently-dropped fields** — task notes, comment photos, contractor
  fields now actually save (needs `phase7a` migration in the DB).
- **Toast system + optimistic-update rollback** — failed Supabase writes now show
  a toast and roll back instead of `console.error`-and-pretend-saved. *(This
  resolves the "silent write failures" debt item that older docs still list.)*
- Full **6-status task workflow** — quick-status pills + blocked-reason prompt;
  status history read from `task_status_history`; one canonical "done" definition.
- **New Task from the Tasks page**; damage-count fix; Analytics hooks-order fix;
  editable feedback resolution notes; breadcrumb sync; `is_admin()` defined in a
  migration; ProductionType TS type matches the free-form reality.

---

## Environment / access facts

- **Production URL:** `https://balance-orbital.vercel.app`. Old
  `balance-six-gamma.vercel.app` is **dead** (DEPLOYMENT_NOT_FOUND) — ignore it.
- **Supabase:** ref `ectyohuqgpnwivpjpuga` (ONE `q`). **FREE tier** (`balance-dev`)
  — auto-pauses after ~7 days of no authenticated traffic, and a paused free
  project has its DNS pulled → `NXDOMAIN` (looks like the project vanished). If
  login/data suddenly dies with NXDOMAIN, un-pause it in the dashboard. Moving to
  paid is the #1 stability fix.
- **Supabase Auth URL config must match the live domain:** Site URL +
  Redirect URLs (`https://balance-orbital.vercel.app/**`). Changing the deploy
  domain breaks login until these are updated.
- **Repo:** authoritative working copy is the **OneDrive** checkout
  `C:\Users\danie\OneDrive\Documents\GitHub\balance` (has the unpushed commits +
  the Tier 2 WIP). OneDrive causes file-watcher/lock flakiness — a future cleanup
  is to move to e.g. `C:\dev\balance`. Push target:
  `github.com/incogkahuna/balance`, branch `master`.
- **Local dev:** `npx vite --port 5174 --host` from the repo root. DEV-only login
  bypass on the LoginPage (amber panel) — pick any team member, no OAuth. Gated on
  `import.meta.env.DEV`. Gives app access but NOT a real Supabase session, so live
  data reads return nothing under RLS — use it for UI work; use real Google login
  to touch data.
- **Branch hygiene:** if `git push` reports a stray branch (a past session once
  landed on `security-tightening`), `git checkout master && git merge --ff-only <branch>`.

## Pending USER actions (dashboard/infra — Claude can't do these)

1. **Run `phase7a` migration** (blocks the Phase 0 push — see TL;DR).
2. **Run `phase6h` migration** — `supabase/migrations/20260609000000_phase6h_notifications_rls_hardening.sql`,
   committed earlier, likely still not applied. Hardens notifications INSERT.
3. **Tier 2 deploy** (only if shipping the WIP) — `ANTHROPIC_API_KEY` secret +
   `supabase functions deploy parse-intake`.
4. **Move off free Supabase tier** (stops the auto-pause).
5. **Custom domain** eventually — `balance.orbitalvs.com` (they own `orbitalvs.com`);
   CNAME + one more Supabase Site-URL update. `orbital.app` is someone else's — dead end.

## Next up — Phase 1 (from `docs/AUDIT-2026-07.md`)

1. **Split identity model** — legacy string ids (`'mark'`, `'danny'`) vs auth
   UUIDs; email-bridged at runtime, unbridgeable in the DB. Blocks proper RLS.
   Highest-value fix (~2-3 days). Doing this first unblocks the rest.
2. **Port localStorage-only entities to Supabase** — LED walls, To-Dos, Bugs &
   Ideas don't sync between users today (each browser is its own DB). ~1 day each.
3. Establish a **test baseline** (currently zero automated tests) — Vitest on the
   pure functions (intakeUtils, roadmapUtils, data mappers) first.

## Architecture quick-ref

- Data: Supabase (productions/tasks/contractors/notifications, realtime) +
  localStorage (walls/todos/feedback — see Phase 1 #2). All via
  `src/context/AppContext.jsx`; snake↔camel mappers in `src/lib/data/*.ts`.
- Auth: Google OAuth (PKCE) via Supabase; email→legacy-id map in
  `AppContext.currentUser`; explicit code exchange in `AuthContext.tsx`.
- Writes: optimistic + rollback + toast (Phase 0). Errors are now visible.
- 3D: three + @react-three/fiber@8 + drei@9 + postprocessing@2.19 (pinned for
  React 18). `src/features/prototype/GravMap.jsx` (3D) + `Constellation.jsx`
  (2D) are sibling tabs on `/resources`. Legend explains the visual language.
- Conventions: one-click state changes, ConfirmDialog for destructive actions,
  hud-label page headers, eager-create + 600 ms auto-save on forms.
- Deeper roadmap + rationale: `docs/ROADMAP.md`. Full audit: `docs/AUDIT-2026-07.md`.

---

## RESOLVED — Google OAuth login loop (verified 2026-07-08)

Loop after login (pick account → back to login, forever). Cause: Supabase's
Site-URL fallback dropped the user at `/?code=...`; React Router's catch-all
(`/` → `/dashboard`, `<Navigate replace>`) fired during the first render, before
any `useEffect`, stripping the `?code=` before the client could exchange it.
Fix (`b322128`, `3553910`): `detectSessionInUrl: false` in `src/lib/supabase.ts`;
in `src/context/AuthContext.tsx` capture the code at **module load**
(`CAPTURED_OAUTH_CODE`, before ReactDOM renders) and `exchangeCodeForSession` it.
Verified via fresh incognito login. **Keep** the `CAPTURED_OAUTH_CODE` logic and
the `[AuthContext]` diagnostic logs — they're the fastest way to diagnose the next
auto-pause/redirect incident.
