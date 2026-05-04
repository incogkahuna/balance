# Balance — Foundation Buildout Plan

Multi-day plan to take Balance from a single-user localStorage prototype to a real
multi-user production-management tool, with each phase gated by a verifiable check-in.

## Locked decisions (Phase 0)

| Decision | Choice |
|---|---|
| Region | Supabase US West (Oregon) — closest to LA studio |
| Tier | Free tier for dev, Pro for production (studio-billed) |
| Setup path | Path A — studio Pro org created in parallel; dev runs against free-tier project under personal account; point at Pro project once available |
| Auth | Google OAuth (Orbital uses Google Workspace), magic link as fallback |
| Hosting | Cloudflare Pages — unlimited bandwidth, predictable cost, fast edge |
| Domain | Deferred to Phase 6 (run on `*.pages.dev` until launch) |
| Edge functions | Supabase Edge Functions (Deno) for Whisper / Claude / email parsing |
| TypeScript | Incremental migration, `allowJs: true`, `strict: true` |
| Migrations | Supabase CLI + raw SQL files in `supabase/migrations/` |
| Tests | Deferred until architecture stabilizes (post-Phase 6) |

## Sequencing logic

The areas aren't independent. Auth gates everything (we need real identities before
real data has meaning), data gates intake (we need somewhere to write parsed
productions), and stable data + auth gate deploy. So the order is forced:

**Supabase auth → Supabase data + TS → Storage → Intake (voice + email) → Mobile → Deploy → Calendar → Slack.**

TypeScript is folded *into* the data migration rather than being its own phase —
typing-as-we-migrate is much cheaper than typing-then-migrating.

---

## Phase 0 — Decisions & Setup (½ day)

**Goal:** Make irreversible choices once, write them down, prepare the local repo.

**Deliverables:**
- This document
- `tsconfig.json` with `allowJs: true`, `strict: true`
- TypeScript installed as a dev dependency (Vite handles `.ts`/`.tsx` natively)
- `.env.example` with placeholder env vars
- `supabase/` directory initialized via Supabase CLI
- Empty Supabase free-tier project provisioned (dev)
- Studio Pro org creation kicked off in parallel
- `.gitignore` audited for new sensitive paths

**✅ Check-in:** User approves the decisions doc and confirms an empty Supabase project exists.

---

## Phase 1 — Real Auth (1–2 days)

**Goal:** Replace profile-picker login with Google OAuth. Real identities across devices.

1. Install `@supabase/supabase-js`, create `src/lib/supabase.ts` client singleton
2. `profiles` table mirroring sampleData user shape (id, name, role, avatar_url), keyed off `auth.users.id`
3. Seed existing 5 users (Mark, AJ, Danny, Brian, Wilder) as profile rows
4. Replace `LoginPage.jsx` with Google OAuth flow (request Calendar scopes upfront for Phase 7)
5. `AuthContext` reading the live Supabase session
6. Convert `currentUser` reads to come from session + profile join
7. Set up Row Level Security (RLS) — get the pattern in place even before other tables exist
8. Sign-out flow

Data still in localStorage at this point — productions, tasks, contractors. Isolating the auth change.

**✅ Check-in:** Two browsers, two real users, both logged in via Google. Sidebar shows correct identity. Sign-out works. Verified on phone + desktop simultaneously.

**Risks:** Google OAuth consent screen verification, Calendar scope incremental authorization, role-based UI gates need re-wiring.

---

## Phase 2 — Data Migration + TypeScript (3 days)

**Goal:** All studio data in Postgres. Multi-user collaboration real. TypeScript adopted file-by-file.

### 2a — Schema + Productions (1 day)
- SQL migrations: `productions`, `production_team_members`, `production_contractors`, `addons`, `feedback`
- RLS: admins/supervisors see all, crew see only assigned productions
- `src/lib/data/productions.ts` — typed data access layer with real-time subscription
- Convert `ProductionsPage`, `ProductionDetailPage`, `ProductionForm` to TypeScript
- Remove production CRUD from AppContext

**✅ Check-in 2a:** Create production on Browser A → appears on Browser B in ~1s. RLS verified — crew can't see unassigned productions.

### 2b — Tasks + Contractors (1 day)
- `tasks`, `task_comments`, `task_status_history`, `contractors`
- TS data layers + real-time subscriptions
- Convert task pages, contractor pages, two-tier completion workflow

**✅ Check-in 2b:** Assignee marks task complete on phone → admin sees "Needs Review" on desktop → verifies. Full chain works across devices in real time.

### 2c — Roadmap + Bible (1 day)
- `milestones`, `logistical_concerns`, `production_bible_sections`
- Convert roadmap and productionBible features

**✅ Check-in 2c:** Edit milestone on one device → updates live on another. Bible sections collaborative.

By end of Phase 2: AppContext mostly gone (or just orchestrates). All studio data in Postgres. Codebase ~70%+ TypeScript. Sample data is a SQL seed script.

**Risks:** Real-time subscription complexity, RLS misconfigurations leaking data, migration of existing localStorage data.

---

## Phase 3 — File Storage (1 day)

**Goal:** Real files. No more base64.

1. ✅ Supabase Storage buckets: `instruction-packages`, `task-completion-photos`, `contractor-photos`, `damage-photos`, `voice-memos` — created in `phase3_storage` migration with tiered RLS (admin-only write vs crew-writable)
2. ✅ Bucket-level RLS (production-scoped reads, owner/admin update/delete)
3. ✅ Shared upload primitives in `src/lib/storage.ts` (BUCKETS, paths, uploadFile, signedUrl(s), deleteFile) and components in `src/components/files/` (FileUploadButton, StoredImage, StoredFileLink, ContractorPhoto)
4. ✅ Mobile camera capture wired in upload sites (`capture="environment"`)
5. ✅ Wired surfaces: InstructionPackage (PDFs/images), TaskCard (completion photos), AddonForm (damage photos), ContractorForm (headshots)
6. ⏳ Cross-device verification check-in still pending — needs user-driven Test 1 (PDF upload + cross-tab refresh) and Test 2 (task photo cross-device)

**Implementation notes:**
- Photos in JSONB sub-objects (task `completionPhotos`, addon `damagePhotos`) carry `storage_path` alongside legacy `url`/base64 — display sites branch on which is present.
- Contractor headshots reuse the existing `photo_url` column to store storage paths going forward; legacy `data:`/`http(s)` values still render via `<img>` thanks to the shared `ContractorPhoto` component. Sample data has `photoUrl: null`, so no real legacy data to migrate.
- Path conventions documented in the `phase3_storage` migration header.

**✅ Check-in:** Upload PDF on desktop → open on phone. Take damage photo on phone → see on desktop. Verify storage quotas.

---

## Phase 4 — Real Intake: Voice + Email (3 days)

**Goal:** Intake automation becomes the actual differentiator. Two input paths feed the same Claude pipeline.

### 4a — Server-side proxies (½ day)
- Edge Function `transcribe`: audio blob → Whisper → transcript (keeps OpenAI key server-side)
- Edge Function `parse-production-intake`: transcript or email body → Claude with structured output → typed JSON matching production shape
- Edge Function `email-webhook`: receives inbound emails, extracts body + attachments, calls parse function
- CORS, auth check, rate limiting

### 4b — Voice intake (1 day)
- Replace Web Speech API with MediaRecorder → upload → Whisper
- Replace `mockParseInputs` with real Claude call
- Streaming UX: show parsing as Claude streams structured output
- Editable review stage

### 4c — Email intake (1 day)
- Inbound email handling: `intake@<domain>` (via Cloudflare Email Routing → Worker → Supabase Edge Function, or via SendGrid/Postmark inbound)
- Parse subject + body + attachments
- Auto-create intake records in "pending review" status
- Notification to admin: "New email intake from <client>"
- Review UI: shows original email alongside parsed fields, admin approves or edits before creating production

### 4d — Quality pass (½ day)
- Test with 3–5 real production briefings (voice + email)
- Tune Claude prompt for studio vocabulary
- Edge cases: missing dates, ambiguous people, multi-day shoots, attachments without context

**✅ Check-in:** Record 2-min voice memo → fully populated production record. Forward a real client briefing email → it shows up in intake queue, parsed correctly. Done together over screen-share.

**Risks:** Whisper cost/latency, Claude prompt brittleness, audio permissions on Safari mobile, inbound email DNS configuration, attachment handling.

---

## Phase 5 — Mobile Polish (1 day)

**Goal:** Works on a phone for crew checking tasks on-set.

1. ⏳ Audit every page at 375px width — Dashboard / Productions / Tasks / ProductionDetail / Contractors covered; Schedule (Gantt) and IntakePage deferred (admin flows, lower priority for crew)
2. ✅ Bottom navigation bar — `MobileNav` exists, `<lg:hidden>` sidebar handles desktop; AppShell pb on mobile now clears MobileNav + safe-area on notched iPhones
3. ✅ Touch target audit — TopBar 44×44, Modal close 44×44, button classes get a mobile-only @media padding bump (~40px), tab strips py-3, filter chips py-2/2.5, photo-remove X buttons get a 36px hit area on mobile
4. ⏭️ Task card swipe actions — deferred (touch gesture surface is finicky; current expand-to-action UX is workable)
5. ✅ Camera capture — already wired in Phase 3 (`capture="environment"` on file inputs)
6. ⏭️ Mobile variant of the ticker — deferred (Danny redesigned the ticker in recent commits; not restructuring without his input)
7. ✅ Today-focused crew dashboard — `myPendingTasks` now sorts by due date asc with overdue first and undated last, so the next thing to do floats to the top. Visual urgency via the existing `DueLabel` (Today / Tomorrow / Overdue).

**iOS-specific fixes shipped:**
- `font-size: 16px !important` on `input/select/textarea` below 768px — stops Safari's zoom-and-scroll dance on focus
- `viewport-fit=cover` so safe-area insets resolve at the edges
- `env(safe-area-inset-top)` on TopBar, `env(safe-area-inset-bottom)` on MobileNav and AppShell main pb

**✅ Check-in:** Walk full task lifecycle on a real phone — log in, see assignments, complete with photo, comment, log out.

**Risks:** Safari iOS quirks (input zoom, viewport units, audio context), ticker may need significant redesign.

---

## Phase 6 — Deploy (½ day)

**Goal:** Real URL. Real users. Real data.

1. Cloudflare Pages project linked to GitHub repo
2. Environment variables in Cloudflare dashboard
3. Production Supabase project (separate from dev — point hosting at it)
4. Custom domain (e.g. `balance.<orbital-domain>`)
5. Sentry or similar for error tracking — replaces silent PageBoundary failures
6. Initial real user accounts seeded

**✅ Check-in:** Studio team can log in at the real domain on the device they'll use day-to-day. Watch them use it for 15 minutes, triage issues.

---

## — LAUNCH BOUNDARY —

Phase 6 ships a working product. Phases 7 and 8 are post-launch enhancements that can ship incrementally while real users are already using the core app.

---

## Phase 7 — Google Calendar Integration (1.5 days)

**Goal:** Productions and milestones automatically appear on the right people's Google calendars.

**Scope (v1 = one-way push Balance → Calendar):**
- Production = multi-day calendar event on production date range
- Milestone = calendar event on its date
- Each assigned team member gets events on personal calendar
- Events update when production/milestone changes; delete on cancellation

Two-way sync (Calendar → Balance) deferred — much more complex (conflict resolution, external edits), and Balance should be source of truth.

1. Google Cloud project + Calendar API + OAuth consent
2. Calendar scope already requested in Phase 1 OAuth flow → token already on hand
3. Encrypt + store refresh tokens in `user_calendar_tokens` table
4. Edge function `sync-to-calendar` triggered by Postgres database webhooks
5. `calendar_event_mapping` table linking Balance entities → Google `eventId`s
6. Settings UI: "Connected to Google Calendar ✓" with disconnect option
7. Token refresh, revoked permissions, calendar deletion handling

**✅ Check-in:** Create production assigning yourself + teammate. Both calendars get the event in ~10s. Edit dates → events update. Cancel production → events disappear.

**Risks:** Google's OAuth verification for production scaling, silent token refresh failures, rate limits on bulk historical sync.

---

## Phase 8 — Slack Integration (2 days)

**Goal:** Balance pushes status into channels people already live in.

**Scope (v1):**
- Workspace-level Slack app install (one-time, by admin)
- Notifications routed to configurable channel (e.g. `#productions`):
  - New production created
  - Production status change
  - Task verified
  - Milestone hit
  - High-priority logistical concern
- Daily morning DM to each user: "You have N tasks due today across M productions"
- Optional per-production channel auto-creation deferred to v2
- No slash commands or interactive bot in v1

1. Slack app manifest: bot scopes (`chat:write`, `users:read`, `users:read.email`, `im:write`), redirect URLs
2. OAuth install flow → `slack_workspaces` table
3. Map Balance users to Slack users via email
4. Edge function `notify-slack` triggered by Postgres webhooks
5. Daily digest cron (Supabase scheduled function) at 8am studio time
6. Settings UI: connection status, channel picker, per-event toggles
7. Message templates with deep-links back to Balance

**✅ Check-in:** Real task verified in Balance → Slack channel shows notification with link. Next morning, you receive a DM listing your tasks.

**Risks:** Slack rate limits on bursty events (need batching), email-based user mapping fails for mismatched emails (manual mapping UI), notification fatigue if defaults aren't tuned.

---

## Estimate

| Phase | Days |
|---|---|
| 0. Setup | 0.5 |
| 1. Auth | 1–2 |
| 2. Data + TS | 3 |
| 3. Storage | 1 |
| 4. Intake (voice + email) | 3 |
| 5. Mobile | 1 |
| 6. Deploy | 0.5 |
| **— launch boundary —** | |
| 7. Calendar | 1.5 |
| 8. Slack | 2 |
| **Total** | **~12.5 working days** |

Realistic calendar buffer: 15–16 days end-to-end.

## Working agreement

1. User approves this plan before any code lands
2. Phase 0 done jointly (decisions are joint)
3. After that, work through each phase, **stop at every check-in** for verification
4. If a phase blows past estimate by >50%, pause and reassess scope
5. Tests, observability beyond Sentry, AppContext splitting, Whisper streaming, Orbital internal-tool integrations all explicitly deferred

## Out of scope (for now)

- Reading user Gmail inboxes (vs. inbound parsing of dedicated `intake@` address — that IS in scope as Phase 4c)
- Two-way Calendar sync
- Slack slash commands / interactive bot
- Native mobile apps (mobile is responsive web only)
- Multi-tenant / multi-studio architecture (single-tenant for Orbital)
