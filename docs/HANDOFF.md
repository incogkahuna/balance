# Balance — Session Handoff

*Written 2026-07-08. Read this first in a new session, then delete/replace when stale.*

## TL;DR — the one thing that matters right now

**An auth-loop fix was just shipped (`3553910`) but is NOT yet verified working.**
The user must test it and report back before anything else proceeds. See "IN
FLIGHT" below. Everything else is stable.

---

## IN FLIGHT — Google OAuth login loop (unverified fix)

**Symptom:** On the production site, signing in with Google looped — pick
account → back to the login page → repeat. Never reached the dashboard.

**Root cause (confirmed via console logs):** After Google, Supabase redirects
back with `?code=...` at the **site root** (`/?code=...`, its Site-URL
fallback). React Router's catch-all route (`/` → `/dashboard`,
`<Navigate replace>`) fires during the first render — before any `useEffect` —
and rewrites the URL to `/dashboard`, **stripping the `?code=`** before the
Supabase client can exchange it. No exchange → no session → bounce to
`/login` → loop.

**Fix shipped (commits `b322128` then `3553910`):**
- `src/lib/supabase.ts`: `detectSessionInUrl: false` (we exchange manually).
- `src/context/AuthContext.tsx`: capture the code at **module load**
  (`CAPTURED_OAUTH_CODE`, evaluated before ReactDOM renders, so the router
  can't strip it), then `exchangeCodeForSession(CAPTURED_OAUTH_CODE)` in the
  init effect. Added log line `[AuthContext] captured OAuth code: present|none`.

**What the user needs to do to verify** (waiting on this):
1. Let Vercel finish deploying `3553910` (Deployments tab → "Ready").
2. Fresh incognito → `https://balance-orbital.vercel.app` → Continue with Google.
3. Open console (F12) and read the new log line:
   - **`captured OAuth code: present`** + `code exchange succeeded` → fixed, done.
   - **`captured OAuth code: present`** + `exchangeCodeForSession failed: <msg>`
     → PKCE verifier/config issue; the `<msg>` names it. Likely fix: Supabase
     Site URL must exactly equal the browsing URL.
   - **`captured OAuth code: none`** → Supabase isn't returning a code at all →
     pure dashboard config. Check Supabase → Auth → Providers → Google (enabled +
     client id/secret) and Auth → URL Configuration → Redirect URLs contains
     `https://balance-orbital.vercel.app/**`.

**If verified working:** delete the extra `[AuthContext]` debug logs if desired
(optional), and move on to the debt list below.

---

## Environment / access facts

- **Production URL:** `https://balance-orbital.vercel.app` (NEW — set up this
  session). The old `balance-six-gamma.vercel.app` is **dead** (returns
  DEPLOYMENT_NOT_FOUND) — do not reference it.
- **Supabase project:** ref `ectyohuqgpnwivpjpuga` (ONE `q` — the two-`q`
  version seen in an error was a red herring). It was **paused** (free-tier
  inactivity auto-pause pulls DNS → NXDOMAIN); user reactivated it. **It will
  re-pause after ~7 days of no authenticated traffic** until moved to a paid
  project. This is a recurring trap.
- **Repo:** user's working copy is under **OneDrive**
  (`C:\Users\danie\OneDrive\Documents\GitHub\balance`) — OneDrive sync causes
  file-watcher and lock issues; a future cleanup is to move it to e.g.
  `C:\dev\balance`. Claude works in a git worktree; commits land on `master`
  and push to `github.com/incogkahuna/balance`.
- **Local dev:** `npx vite --port 5174 --host` from the repo root. There's a
  **DEV-only login bypass** on the LoginPage (amber panel) — pick any team
  member, no OAuth. Gated on `import.meta.env.DEV`, never in prod. NOTE: dev
  bypass gives app access but NOT a real Supabase session, so live data reads
  return nothing under RLS — use it for UI work, real Google login for data.
- **Git branch:** `master`. Watch out: a prior session once committed onto a
  stray `security-tightening` branch inside the worktree — if `git push` reports
  an unexpected branch, `git checkout master && git merge --ff-only <branch>`.

## Pending USER actions (dashboard/infra — Claude can't do these)

1. **Run migration `phase6h`** — `supabase/migrations/20260609000000_phase6h_notifications_rls_hardening.sql`
   is committed but likely **not yet run** in Supabase (6f + 6g were run this
   session; 6h came later). Paste it into the Supabase SQL editor. It hardens
   the notifications INSERT policy (removes a spoofing vector).
2. **Move to a paid Supabase project** (or ping it regularly) to stop the
   auto-pause. This is the #1 stability issue.
3. **Custom domain** eventually — `balance.orbitalvs.com` (they own
   `orbitalvs.com`) is the elegant end state; needs a CNAME in that domain's DNS
   + updating the Supabase Site URL once more. `orbital.app` is a dead end
   (owned by someone else).

## What shipped this session (most recent first)

- Auth loop fix (`b322128`, `3553910`) — see IN FLIGHT.
- Grav Map click/demo-mode/breadcrumb fixes + **`docs/ROADMAP.md`** (`322c5ce`).
- Streamline pass (`7ed9735`): Grav Map legend + status rings + orbit rings +
  selection ring + planet names; sidebar grouped into sections (Work / People &
  Gear / Studio) and **Tasks re-added to desktop sidebar** (was missing);
  ConfirmDialog swapped in for `window.confirm` in 4 places; hud-label headers
  on Tasks/Analytics/Schedule; loading states; "Coming Soon" → "Roadmap"; fixed
  a latent crew-detect regex crash.
- Security tightening (`716f5cd`): npm audit fixes + phase6h migration authored.
- To-Dos feature (`92225b5`): new `/todos` page + dashboard widget, distinct
  from production Tasks. Shared-by-default with Direct (private) option.
  localStorage-backed.
- Dev OAuth bypass (`8f9af10`).
- Tasks page upgrade (`00e8bc5`): stats strip, search, scope + sort controls.
- Bugs & Ideas feature (`a330e84`): `/feedback` page. localStorage-backed.
- Intake Tier 1 (`3395e10`): chrono-node dates, crew auto-detect, email-header
  contacts, smarter concern detection. **Tier 2 (Claude edge function) is
  deliberately deferred** — user said "come back to Claude later"; will need an
  ANTHROPIC_API_KEY as a Supabase secret + edge-function deploy.

## Core debt (full detail in `docs/ROADMAP.md`)

1. **Split identity model** — legacy string ids (`'mark'`, `'danny'`) vs auth
   UUIDs; email-bridged at runtime, unbridgeable in the DB. Blocks proper RLS.
   Highest-value fix (~2-3 days).
2. **localStorage-only entities** — LED walls, To-Dos, Bugs & Ideas don't sync
   between users. Port to Supabase (~1 day each).
3. **Silent write failures** — Supabase errors only hit `console.error`. Needs a
   toast system (~half day).
4. **Zero automated tests.**

## Architecture quick-ref

- Data: Supabase (productions/tasks/contractors/notifications, realtime) +
  localStorage (walls/todos/feedback). All via `src/context/AppContext.jsx`;
  snake↔camel mappers in `src/lib/data/*.ts`.
- Auth: Google OAuth via Supabase; email→legacy-id map in `AppContext.currentUser`.
- 3D: three + @react-three/fiber@8 + drei@9 + postprocessing@2.19 (pinned for
  React 18). `src/features/prototype/GravMap.jsx` (3D) and `Constellation.jsx`
  (original 2D) are sibling tabs on `/resources`.
- Conventions: one-click state changes, ConfirmDialog for destructive actions,
  hud-label page headers, eager-create + 600ms auto-save on forms.
