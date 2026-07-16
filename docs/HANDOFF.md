# Balance — Session Handoff

*Updated 2026-07-16. Read this first, then delete/replace when stale.*
*Working copy that has all this state: `C:\Users\danie\OneDrive\Documents\GitHub\balance` (the OneDrive checkout — NOT the Claude worktree, which is behind).*

## TL;DR — start here

**SHIPPED 2026-07-16:** the phase7a migration was run in Supabase (user-confirmed),
then Phase 0 + the Tier 2 intake parser were pushed (`master @ a564db9`+) and the
Vercel deploy verified live (new bundle's toast CSS confirmed on
`balance-orbital.vercel.app`). Nothing is sitting locally.

Remaining, in order:

1. **Smoke-test prod** — real Google login → create a production → add a task
   with a note → move it through the status workflow → confirm no error toasts.
2. **Turn on Tier 2** (optional, anytime) — `supabase secrets set
   ANTHROPIC_API_KEY=sk-ant-...` + `supabase functions deploy parse-intake`.
3. **Run `phase6h`** in the SQL editor if it wasn't run alongside phase7a.
4. **Start Phase 1** (identity unification → localStorage ports → tests) from
   `docs/AUDIT-2026-07.md`.

The auth-loop fix is verified working (2026-07-08). Details near the bottom.

---

## COMMITTED — Intake Tier 2 (Claude screenshot parser), 2026-07-15

The long-deferred screenshot parser is **finished, browser-verified, and
committed** at both sites that requested a parser:

1. **Intake wizard** (`/productions/new`) — Tier 1 heuristics run synchronously
   (instant, offline-safe); Tier 2 (`parse-intake` edge function,
   `claude-opus-4-8` with vision + structured output) runs during the Analysing
   stage and merges over Tier 1 via `mergeTier2Results`. Screenshots, pasted
   text, and voice transcripts all flow through it. The Analysing stage holds
   ("Reading screenshots & fine detail…") until the AI settles; the client caps
   the wait at 60s.
2. **Production Bible → Documents Received** — image documents get a ✨ "Scan
   with AI" button that folds extracted contacts into Key Players and concerns
   into Key Concerns (deduped, single bible write, toast feedback).

**Fallback verified live** (browser test, function undeployed): the wizard logs
`[Intake] AI parse unavailable, using heuristics` and completes on Tier 1 —
paste-brief → Review stage fully populated. So the code is safe in prod before
the function exists; Tier 2 lights up when deployed. (Note: the in-app browser's
console reader duplicates every entry — two identical log lines ≠ two runs.)

**To turn Tier 2 on (user actions):**
- `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
- `supabase functions deploy parse-intake`
- Then test: an intake with a call-sheet screenshot should populate dates and
  contacts from the image, not just the pasted text.

Email intake (foundation-plan 4c) remains out of scope — it needs inbound-email
DNS/routing infrastructure, not just a parser.

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
