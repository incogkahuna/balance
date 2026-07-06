# Balance — Engineering Roadmap & Health Assessment

*Last updated: June 2026 · Maintained alongside the codebase — update when phases land.*

Balance is feature-rich for its age: productions, tasks, to-dos, gear, scheduling,
a 3D allocation map, drafts/publishing, notifications, and an AI-assisted intake.
The gap between "works in a demo" and "the studio runs on it" is now mostly
**foundations**, not features. This document is the honest map of that gap.

---

## Part 1 — Core issues (ranked by risk)

### 1. Split identity model (highest risk, blocks everything below it)
The app has two parallel user identities: legacy string ids (`'mark'`, `'danny'`, …)
hardcoded in `src/data/models.js` USERS, and real Supabase auth UUIDs in `profiles`.
Email-matching in `AppContext.currentUser` bridges them at runtime, but the DB
can't: `tasks.assignee_id`, `notifications.recipient_id`, and
`assigned_members[].userId` all store legacy strings that Postgres can't join to
`auth.uid()`.

**Consequences today:**
- Notifications SELECT policy must stay wide-open (`using (true)`) — any user can
  technically read anyone's notifications.
- Adding an employee requires a code deploy (edit USERS array), not a DB row.
- Every visibility feature has to be solved app-side instead of with RLS.

**Fix:** one migration that (a) adds `legacy_id` to `profiles`, (b) backfills, then
(c) rewrites stored ids to UUIDs table-by-table. After that, USERS becomes a
read-through cache of `profiles` and the roster is DB-managed. **Estimate: 2–3 focused days.**

### 2. localStorage-only entities don't sync between people
LED Walls (`balance_led_walls_v1`), To-Dos (`balance_todos_v1`), and Bugs & Ideas
(`balance_feedback_v1`) live in each browser's localStorage. Two people looking at
/gear see **different databases**. Fine for one evaluator; broken the day Wilder
and Mark both book walls.

**Fix:** port all three to Supabase tables with realtime + RLS, following the exact
pattern productions/tasks already use. The data layers are already shaped for it.
**Estimate: 1 day per entity.**

### 3. Silent write failures
Every Supabase write failure lands in `console.error` and nowhere else. A user
whose task update fails sees... nothing. The optimistic update makes it look saved
until refresh.

**Fix:** a small toast system (one context + one component) wired into the ~10
`.catch` sites in AppContext. **Estimate: half a day.**

### 4. Zero automated tests
Every regression this project has ever had was found by a human clicking. The
intake parser (pure functions) and roadmap utils are trivially unit-testable;
the auth/RLS behavior deserves a Playwright smoke.

**Fix:** Vitest for `intakeUtils`, `roadmapUtils`, data-layer mappers (fast, high
value); one Playwright script covering login → create production → assign → complete.
**Estimate: 2 days initial, then maintained.**

### 5. Pending SQL migration
`phase6h` (notifications INSERT hardening) is committed to the repo but **has not
been run against Supabase**. Run it. Two dev-only npm advisories (esbuild via vite)
remain, deferred pending a Vite major bump.

---

## Part 2 — Phased roadmap

### Phase A — Make it trustworthy (≈2 weeks)
| Item | Why |
|---|---|
| Identity unification (issue #1) | Unblocks proper RLS everywhere |
| Port LED Walls / To-Dos / Feedback to Supabase | Multi-user correctness |
| Error toasts (issue #3) | Users must see failed writes |
| Run phase6h; tighten notifications SELECT post-identity-fix | Close the audit findings |
| Production Supabase project + custom domain (`balance.orbitalvs.com`) | Get off the dev project before real data accumulates |

### Phase B — Make it complete (≈4 weeks)
| Item | Why |
|---|---|
| **Claude-powered intake (Tier 2)** — edge function, vision on screenshots, structured output; heuristics stay as offline fallback | The intake is the app's front door; heuristics only get ~60% of the way |
| Notification expansion — comments, status changes, milestone-approaching; daily email digest | Bell exists; coverage is thin |
| Slack bot (edge function already built — needs workspace setup) | Meet the crew where they already are |
| Per-production activity feed | "What changed since I last looked" — repeatedly requested theme |
| Global search (productions, tasks, contractors, to-dos) | 8 nav items deep, no way to jump |
| Calendar sync (Google) — productions + milestones out | Long-planned Phase 7 |

### Phase C — Make it scale (ongoing)
- Test suite (issue #4) and CI on push
- Error monitoring (Sentry) in production
- Bundle diet: main chunk is ~700 kB min; split TickerBanner/NotificationBell,
  audit Recharts usage on Analytics (400 kB for four charts)
- Onboarding flow for new team members; tooltips on telemetry-dense screens
- PDF export of production reports (client-facing artifact)
- Gear DB v2: more categories (camera, server, vehicles), optional per-unit
  serial tracking, photos
- Milestone dependencies UI (`dependencies[]` exists in the model, unused)

### Grav Map — future iterations
The 3D map is now legible (legend, status rings, names, orbit paths) and
film-looking (shaders, bloom, nebula). Next high-value steps, in order:
1. **Camera fly-to** on planet click (smooth tween instead of static orbit)
2. **Milestone satellites** — small markers orbiting each planet at dates
3. **Real client logos** — `logoUrl` slot is already wired; add an upload field
   or Clearbit lookup (`logo.clearbit.com/<domain>`)
4. **Perf mode** — reduced-quality path for mobile (fewer particles, no bloom)

---

## Part 3 — Architecture notes for future contributors

- **Data flow:** Supabase (productions/tasks/contractors/notifications, realtime)
  + localStorage (walls/todos/feedback — see issue #2). All access through
  `src/context/AppContext.jsx`; typed mappers in `src/lib/data/*.ts` translate
  snake_case ↔ camelCase at the boundary.
- **Auth:** Google OAuth via Supabase; email → legacy-id mapping in
  `AppContext.currentUser`; DEV-only bypass on LoginPage (never renders in prod
  builds).
- **Visibility:** productions use published/draft + role; crew see all published.
- **3D stack:** three + @react-three/fiber@8 + drei@9 + postprocessing@2.19 —
  pinned for React 18. Upgrading React to 19 unlocks the current majors; do it
  as one bundle.
- **Conventions:** one-click state changes (status picker, publish, milestone
  complete toggle); ConfirmDialog for destructive actions; hud-label header
  pattern on every page; eager-create + 600 ms auto-save on forms.
