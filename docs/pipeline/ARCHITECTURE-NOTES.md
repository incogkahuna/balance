# Orbital Job Pipeline — Architecture Notes

*Phase-0 exploration record + how the pipeline module slots into Balance.
Written 2026-07-19 at the start of the pipeline build (Danny's #18 — the
Nitzkin quoting app, now fully specced from the Brian/AJ/Mark/Wilder meeting).*

## What Balance is (found in exploration)

- **Stack:** React 18 + Vite + Tailwind, Supabase (Postgres + RLS + realtime
  + edge functions), Vercel deploy, react-router v6, lucide icons, date-fns,
  Recharts (already used by AnalyticsPage — reused for pipeline analytics).
- **Auth:** Google OAuth via Supabase (`AuthContext.tsx`), `profiles` table
  keyed to `auth.users`, roles `admin | supervisor | crew`, pre-authorization
  via `role_assignments` (email → role, applied by signup trigger).
- **Data pattern:** every domain gets a typed module in `src/lib/data/*.ts`
  (snake_case rows ↔ camelCase app objects at the boundary, CRUD + realtime
  subscription). `AppContext.jsx` is the hub: hydrate on session, optimistic
  local update, remote write, toast + rollback on failure, realtime
  reconciliation, `logActivity()` fire-and-forget into `activity_events`.
- **UI conventions:** feature folders under `src/features/<domain>/`, pages
  in `src/pages/`, `hud-label` telemetry headers, `card-elevated`,
  `btn-primary/secondary`, `Modal`/`ConfirmDialog`/`EmptyState`/`StatusBadge`
  primitives, orbital-* Tailwind tokens (CSS variables, light+dark).
- **SQL law (Danny):** every block he pastes into the Supabase editor must be
  idempotent — `if not exists` / `drop policy if exists` / guarded publication
  adds. One already-exists error rolls back the whole block.
- **Dev mode:** login bypass on /login means no real session → RLS returns no
  rows. Features that need to be testable in dev use a localStorage fallback
  (M5 feedback_items precedent). Verification happens via the Vite dev server.

## How the pipeline module slots in

Own domain, native conventions:

- `src/features/pipeline/` — all pipeline UI + `PipelineContext.jsx`
  (a sibling provider to AppContext, mounted inside it so it can reuse
  auth/toast/productions).
- `src/lib/data/pipeline.ts` — the data layer. **Dual-mode:** Supabase when a
  session exists and the tables answer; localStorage otherwise (dev bypass,
  pre-migration live). Same API shape either way, so the UI never knows.
- `supabase/migrations/20260719000000_pipeline_core.sql` — fully idempotent,
  also mirrored in `docs/RUN-THIS-SQL.md` style for Danny to paste.
- Routes under `/pipeline/*`, its own "Pipeline" sidebar section, gated on
  having a pipeline role at all.

### The deal is the top-level object

`pipeline_deals` — client (company/contact/email/phone), project, venue
(`tvc | mobile` + mobile location), intake mode (`standard | budget_first |
comparison_bid`), dates + DAYS breakdown (travel/build/shoot/strike), asset
class, status ladder `new → quote_sent → agreement → green_light` (+ `dead`
with lost reason), timestamped freeform notes (Brian's paper-scrap
replacement), 0..n quotes, 0..1 linked production. Quotes are optional
artifacts — budget-first deals go `new → agreement` with zero quotes as a
first-class path.

### The Mike Sill Rule = table separation + RLS (data layer, not hidden divs)

Money is the sensitive axis, so money lives in **separate tables** and RLS
does the scoping server-side:

| table | contents | who can SELECT |
|---|---|---|
| `pipeline_deals` | everything except money | all four pipeline roles |
| `pipeline_deal_money` | quoted / agreed / actual, paid flag | admin_finance, admin_exec |
| `pipeline_quotes` | line items, rates, discounts, floors | admin_finance, admin_exec |
| `pipeline_rate_cards` | versioned rate card docs | admin_finance, admin_exec |
| `pipeline_handoffs` | summary, crew, tech spec, gates, schedule (no money) | all four roles (Mark's surface) |

A production-role query for quote data returns **zero rows** (RLS), not a
hidden div. Wilder's analytics come from a `security definer` RPC
(`pipeline_analytics()`) that returns aggregates only — revenue series are
included in the payload only when the caller is an admin role.

**Roles:** new nullable `profiles.pipeline_role` column
(`admin_finance` = Brian, `admin_exec` = AJ (+ Danny as owner), `production`
= Mark, `pipeline` = Wilder), seeded by email in the migration. Fallback: a
Balance `admin` profile with no explicit pipeline_role gets `admin_exec`
(covers Danny's alt accounts); everyone else gets nothing (no pipeline nav).
`public.pipeline_role()` is the SQL helper all policies call. This is the
least-invasive add on the existing auth — real per-user auth already exists,
we just project a second role axis onto it. In dev (no session) the
DevProfileSwitcher-style "view as" override in PipelineContext simulates each
role and the data layer applies the same scoping functions client-side, so
role UX is testable without four Google accounts.

### Rate card = versioned data, not code

One jsonb document per version in `pipeline_rate_cards` (matches Balance's
jsonb-heavy style — productions.bible/roadmap). Editing in the admin UI
writes a **new version row**; quotes store `rate_card_version` and render
against the version they were built on, forever. v1 is seeded from the
meeting data (`src/features/pipeline/rateCardSeed.js` is the source of truth
and is inserted by the data layer on first use if the table is empty).
**Little Dipper is excluded — the stage no longer exists.**

Document shape: `{ version, label, lines: {id → line}, templates: {tvc,
mobile} (section → line ids), presets (Big Dipper stack), discountLabels }`.
Shared config/rental/services modules are defined once with per-venue rates
(`rate: {tvc, mobile}`) and referenced from both templates. Line extras that
are live logic, not prose: `requires` (dependency rules → auto-activate or
block), `autoQty` (day-type driven quantities, always overridable),
`spec` (Genlock frame-rate select etc.), `bundle` (components listed, not
priced), `internal` (internal-only annotation layer — the Hercules
panel-count floor lives here and **never** renders on the client PDF),
`perAsset` (multi-cam optimization asset-count prompt).

### Quote engine

`pipeline_quotes.lines` stores only the deltas: `{lineId: {x, qty,
rateOverride?, spec?, note?}}` joined against the version doc at render.
`quoteMath.js` is a pure, dependency-free module (unit-testable under plain
node): line totals (QTY × X × Rate), section subtotals, grand total,
discount (fixed/percent, required label, optional value-add display mode),
day-driven qty proposals, dependency resolution, internal floor, 30-business-
day expiry from `issued_at`. Two renders: the internal build view
(`QuoteBuilderPage`) and the client PDF (`QuotePdfPage` — full master menu
with $0 lines, Services/Item/Description/QTY/Units/X/Rate/SubTotals columns,
DAYS box, print CSS with `page-break-inside: avoid`).

### Auto-triggers ride the status change (trigger hygiene)

Implemented in `PipelineContext.setDealStatus` — client-side orchestration
(matching how Balance does auto-status), producing **artifacts, not pings**:

- → `agreement` (YELLOW-LIT): spawn `pipeline_handoffs` row (state
  `pending`) fully derived from deal + best quote — crew (bundles expanded to
  component roles), tech spec (frame rate from Genlock spec, tracking,
  wall config, pre-light, asset class), Mark's three-sentence summary — and
  create a **real Balance production** (`published: false` = draft/pending,
  kind `production`, client/name/dates/location prefilled). Linked both ways
  (`deals.production_id`, `handoffs.production_id`).
- → `green_light` (GREEN-LIT): handoff flips `active`, production publishes
  (`published: true`) with dateRanges set → it appears on the existing
  Schedule/Gantt for everyone (the "day is taken, no tours" surface). The
  handoff also carries explicit per-day calendar blocks (9:00–9:00, "TBA —
  times to be adjusted"). Gate checklist instantiated: **Deposit ☐ + COI ☐
  hard-gate the tech scout**, plus agreement/first invoice/W9/rental-due
  tracking. Handoff container: creative-deck slot + kickoff checklist (Mark
  intro / kickoff call / creative received) — auto-created, humans do the
  intros.
- No notification is ever sent to the actor. Activity logging reuses
  `activity_events` (fire-and-forget) — receivers see populated artifacts.
- Google Calendar is a future integration; the clean hook point is
  `buildCalendarBlocks()` in `pipelineTriggers.js` (returns the day blocks —
  swap the persistence target).

### Client history (the payback) & analytics

History = query over deals joined with money+quotes (admin roles get the
full picture: quoted → agreed → actual, discount amount + label, paid flag,
expired-quote flags). Surfaced at `/pipeline/clients` (type-ahead) and
inline during deal creation for known clients. Analytics (`/pipeline/
analytics`): close rate, per-stage cycle times, quoted→agreed delta
distribution, discount frequency/size/label mix, line-item popularity, venue
mix, asset-class mix, monthly flow (+revenue for admin roles only) — all
derived from Brian's own workflow data, zero extra entry.

## Gaps / deliberate v1 scope calls

- **Calendar**: no Google Calendar connection exists in Balance yet — v1
  uses the internal Schedule (real productions) + explicit block list on the
  handoff. Integration point stubbed and documented.
- **Quote PDF export** = browser print-to-PDF from the print-styled render
  (no server-side PDF pipeline in Balance; this matches how Brian works —
  File → Print → Save as PDF, or the Export button which calls
  `window.print()`).
- **Attachments** (creative deck slot) reuse Balance's existing storage
  helpers (`src/lib/storage.ts`) — slot stores a storage path.
- **Comparison-bid**: multiple quotes per deal with one markable
  `sent`/`accepted` — variants are plain sibling quotes with titles.
- **Local mode** is a first-class fallback, not a demo hack — it's how dev
  bypass works app-wide. Real four-way RLS enforcement activates the moment
  Danny runs the migration and the four emails sign in.
- **International air transport / Live MOCAP / installation fees** are
  manual-price lines (`priceMode: 'manual'`) — Brian types the number.

## Hooks for what comes next (contract generation, invoicing, A&E pricing)

- Deal + accepted quote + agreed number are all queryable in one place —
  contract generation should read `deal + pipeline_deal_money + accepted
  quote` and template from there.
- `pipeline_handoffs.gates` already tracks invoice/W9/rental-due state —
  invoicing automation can flip those.
- Rate card versioning gives A&E program pricing a place to live as its own
  template key alongside `tvc`/`mobile` (templates are data).
