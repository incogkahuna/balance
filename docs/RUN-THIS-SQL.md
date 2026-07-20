# Danny: run this SQL (one paste, Supabase dashboard → SQL Editor)

> **STATUS 2026-07-17: ✅ ALL SQL BELOW HAS BEEN RUN AND VERIFIED.** Danny
> pasted the migration block and the 5-way diagnostic returned all `true`.
> The profile-duplicates section is **superseded** — the DB was clean (3
> real people, no dupes); the duplication Danny saw was the hardcoded
> legacy roster rendering beside real profiles, fixed in code (`feeea44`,
> `buildRoster()`). **Do not delete any profiles.** The only remaining
> action is the two edge-function deploys (see "Voice transcription is
> down" below). This file is kept as the reference for what was applied.

## ⭑ NEW 2026-07-19 — JOB PIPELINE (Nitzkin quoting, #18) — RUN THIS ONE

> **STATUS: ⬜ NOT YET RUN.** One paste, fully idempotent (safe to re-run).
> Creates the pipeline tables (deals / quotes / money / handoffs / rate
> cards), the pipeline_role axis on profiles (Brian=admin_finance,
> AJ+Danny=admin_exec, Mark=production, Wilder=pipeline — pre-assigned by
> email, works even before they first sign in), RLS enforcing the
> money-separation rule at the data layer, and the analytics aggregate
> function. Until this runs, the live app quietly falls back to per-browser
> local storage for pipeline data — nothing breaks, nothing is shared.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PIPELINE CORE — Orbital job intake / quoting / production-handoff system
-- (Danny's #18 — the Nitzkin quoting app.)
--
-- Design law (see docs/pipeline/ARCHITECTURE-NOTES.md):
--   * The DEAL is the top-level object; quotes are optional artifacts.
--   * Mike Sill Rule: money lives in SEPARATE tables (deal_money, quotes,
--     rate_cards) whose RLS only answers to admin_finance / admin_exec.
--     Production/pipeline roles get ZERO ROWS from those tables — data-layer
--     enforcement, not hidden UI.
--   * Roles are a second axis on profiles (pipeline_role), pre-assignable by
--     email in pipeline_role_assignments so Brian/AJ can be authorized before
--     their first sign-in.
--   * Everything here is IDEMPOTENT — safe to paste twice into the SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── profiles.pipeline_role ──────────────────────────────────────────────────
alter table public.profiles add column if not exists pipeline_role text;

do $$ begin
  alter table public.profiles
    add constraint profiles_pipeline_role_check
    check (pipeline_role is null or pipeline_role in
           ('admin_finance', 'admin_exec', 'production', 'pipeline'));
exception when duplicate_object then null; end $$;

-- Pre-authorization by email (mirrors role_assignments): lets us map the four
-- pipeline users before they ever sign in. Explicit profiles.pipeline_role
-- always wins over this table.
create table if not exists public.pipeline_role_assignments (
  email          text primary key,
  pipeline_role  text not null check (pipeline_role in
                   ('admin_finance', 'admin_exec', 'production', 'pipeline')),
  created_at     timestamptz not null default now()
);

insert into public.pipeline_role_assignments (email, pipeline_role) values
  -- NOTE: brian@ is Brian NITZKIN (Business Manager). brodriguez@ is a
  -- different Brian (crew) and deliberately gets no pipeline role.
  ('brian@orbitalvs.com',      'admin_finance'),  -- Brian Nitzkin — Business Manager
  ('aj@orbitalvs.com',         'admin_exec'),     -- AJ — CEO
  ('dhorgan@orbitalvs.com',    'admin_exec'),     -- Danny — owner
  ('mark@orbitalvs.com',       'production'),     -- Mark — Production
  ('wilder@orbitalvs.com',     'admin_exec')      -- Wilder — Head of AI (dev team: full access)
on conflict (email) do nothing;

-- Resolve the caller's pipeline role. Fallback chain:
--   explicit profiles.pipeline_role → email match in pipeline_role_assignments
--   → 'admin_exec' for Balance admins (owner accounts keep working) → null.
-- SECURITY DEFINER so RLS policies can call it without recursive table grants.
create or replace function public.pipeline_role()
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role  text;
  v_email text;
  v_app   text;
begin
  select p.pipeline_role, p.email, p.role
    into v_role, v_email, v_app
  from public.profiles p
  where p.id = auth.uid();

  if v_role is not null then return v_role; end if;

  select a.pipeline_role into v_role
  from public.pipeline_role_assignments a
  where a.email = v_email;

  if v_role is not null then return v_role; end if;
  if v_app = 'admin' then return 'admin_exec'; end if;
  return null;
end;
$$;

create or replace function public.pipeline_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.pipeline_role() in ('admin_finance', 'admin_exec');
$$;

-- ─── pipeline_rate_cards — versioned rate card documents ─────────────────────
-- One jsonb doc per version. Editing creates a NEW version; quotes pin the
-- version they were built on. Rates are money → admin-only.
create table if not exists public.pipeline_rate_cards (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null unique,
  label       text not null default '',
  data        jsonb not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.pipeline_rate_cards is
  'Versioned rate card documents (TVC + Mobile templates, shared modules, dependency rules).';

-- ─── pipeline_deals — THE top-level object (no money columns) ────────────────
create table if not exists public.pipeline_deals (
  id              uuid primary key default gen_random_uuid(),
  client_company  text not null,
  client_contact  text not null default '',
  client_email    text not null default '',
  client_phone    text not null default '',
  project_name    text not null,
  venue           text not null check (venue in ('tvc', 'mobile')),
  mobile_location text not null default '',
  intake_mode     text not null default 'standard'
                    check (intake_mode in ('standard', 'budget_first', 'comparison_bid')),
  asset_class     text not null default ''
                    check (asset_class in ('', '2D', '2.5D', '3D', '3D+tracking')),
  status          text not null default 'new'
                    check (status in ('new', 'quote_sent', 'agreement', 'green_light', 'dead')),
  lost_reason     text not null default '',
  start_date      date,
  end_date        date,
  -- {"travel": n, "build": n, "shoot": n, "strike": n}
  days            jsonb not null default '{"travel":0,"build":0,"shoot":0,"strike":0}'::jsonb,
  -- Brian's paper-scrap replacement: [{id, text, at, by}]
  notes           jsonb not null default '[]'::jsonb,
  -- [{status, at}] appended on every status change — feeds cycle analytics.
  status_history  jsonb not null default '[]'::jsonb,
  production_id   uuid references public.productions(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.pipeline_deals is
  'Job pipeline deals — the top-level object. Money lives in pipeline_deal_money (RLS-scoped).';

create index if not exists pipeline_deals_status_idx  on public.pipeline_deals (status);
create index if not exists pipeline_deals_client_idx  on public.pipeline_deals (lower(client_company));
create index if not exists pipeline_deals_created_idx on public.pipeline_deals (created_at desc);

-- ─── pipeline_deal_money — quoted / agreed / actual (Mike Sill table) ────────
create table if not exists public.pipeline_deal_money (
  deal_id       uuid primary key references public.pipeline_deals(id) on delete cascade,
  quoted_total  numeric,
  agreed_total  numeric,
  actual_total  numeric,
  paid          boolean,
  updated_at    timestamptz not null default now()
);

comment on table public.pipeline_deal_money is
  'The three number states of a deal + paid flag. Admin-finance/exec eyes only (RLS).';

-- ─── pipeline_quotes — optional artifacts attached to a deal ─────────────────
create table if not exists public.pipeline_quotes (
  id                 uuid primary key default gen_random_uuid(),
  deal_id            uuid not null references public.pipeline_deals(id) on delete cascade,
  title              text not null default 'Quote',
  rate_card_version  integer not null,
  venue              text not null check (venue in ('tvc', 'mobile')),
  -- day-count snapshot at build time {"travel","build","shoot","strike"}
  days               jsonb not null default '{"travel":0,"build":0,"shoot":0,"strike":0}'::jsonb,
  -- Only the deltas: {lineId: {x, qty, rateOverride?, spec?, note?}}
  lines              jsonb not null default '{}'::jsonb,
  -- {mode: 'fixed'|'percent', value, label, reason, display: 'subtract'|'value_add'}
  discount           jsonb,
  status             text not null default 'draft'
                       check (status in ('draft', 'sent', 'accepted', 'superseded')),
  issued_at          date not null default current_date,
  sent_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.pipeline_quotes is
  'Quote variants per deal (comparison-bid = siblings). Line items + rates + discounts → admin-only RLS.';

create index if not exists pipeline_quotes_deal_idx on public.pipeline_quotes (deal_id);

-- ─── pipeline_handoffs — the production-facing projection (no money) ─────────
create table if not exists public.pipeline_handoffs (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid not null unique references public.pipeline_deals(id) on delete cascade,
  production_id  uuid references public.productions(id) on delete set null,
  state          text not null default 'pending' check (state in ('pending', 'active')),
  -- Mark's three sentences: what, when, where, what crew, what's on the wall.
  summary        text not null default '',
  -- [{role, source}] — bundles expanded to component roles.
  crew           jsonb not null default '[]'::jsonb,
  -- {frameRate, tracking, wallConfig, preLight, assetClass, flags: []}
  tech_spec      jsonb not null default '{}'::jsonb,
  -- [{date, dayType, label}] — 9:00–9:00 TBA blocks, written at green-light.
  schedule       jsonb not null default '[]'::jsonb,
  -- Deposit + COI hard-gate the tech scout. Status only — no amounts here.
  gates          jsonb not null default '{"deposit":false,"coi":false,"agreementSent":false,"firstInvoiceSent":false,"w9Sent":false,"rentalDueBeforePrelight":false}'::jsonb,
  -- Handoff container: creative deck slot + kickoff checklist.
  handoff        jsonb not null default '{"creativeDeck":null,"markIntro":false,"kickoffCall":false,"creativeReceived":false}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.pipeline_handoffs is
  'Auto-spawned production projection of a deal (yellow-lit → pending, green-lit → active). No money.';

-- ─── updated_at triggers (reuse set_updated_at) ──────────────────────────────
drop trigger if exists pipeline_deals_set_updated_at on public.pipeline_deals;
create trigger pipeline_deals_set_updated_at
  before update on public.pipeline_deals
  for each row execute function public.set_updated_at();

drop trigger if exists pipeline_quotes_set_updated_at on public.pipeline_quotes;
create trigger pipeline_quotes_set_updated_at
  before update on public.pipeline_quotes
  for each row execute function public.set_updated_at();

drop trigger if exists pipeline_handoffs_set_updated_at on public.pipeline_handoffs;
create trigger pipeline_handoffs_set_updated_at
  before update on public.pipeline_handoffs
  for each row execute function public.set_updated_at();

drop trigger if exists pipeline_deal_money_set_updated_at on public.pipeline_deal_money;
create trigger pipeline_deal_money_set_updated_at
  before update on public.pipeline_deal_money
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.pipeline_role_assignments enable row level security;
alter table public.pipeline_rate_cards       enable row level security;
alter table public.pipeline_deals            enable row level security;
alter table public.pipeline_deal_money       enable row level security;
alter table public.pipeline_quotes           enable row level security;
alter table public.pipeline_handoffs         enable row level security;

-- role assignments: pipeline admins only
drop policy if exists "pipeline_role_assignments_admin_all" on public.pipeline_role_assignments;
create policy "pipeline_role_assignments_admin_all"
  on public.pipeline_role_assignments for all to authenticated
  using (public.pipeline_is_admin())
  with check (public.pipeline_is_admin());

-- rate cards: rates are money → admin roles only (read + write)
drop policy if exists "pipeline_rate_cards_admin_select" on public.pipeline_rate_cards;
create policy "pipeline_rate_cards_admin_select"
  on public.pipeline_rate_cards for select to authenticated
  using (public.pipeline_is_admin());

drop policy if exists "pipeline_rate_cards_admin_insert" on public.pipeline_rate_cards;
create policy "pipeline_rate_cards_admin_insert"
  on public.pipeline_rate_cards for insert to authenticated
  with check (public.pipeline_is_admin());

-- deals (no money): all four pipeline roles read; admin roles write
drop policy if exists "pipeline_deals_select" on public.pipeline_deals;
create policy "pipeline_deals_select"
  on public.pipeline_deals for select to authenticated
  using (public.pipeline_role() is not null);

drop policy if exists "pipeline_deals_admin_insert" on public.pipeline_deals;
create policy "pipeline_deals_admin_insert"
  on public.pipeline_deals for insert to authenticated
  with check (public.pipeline_is_admin());

drop policy if exists "pipeline_deals_admin_update" on public.pipeline_deals;
create policy "pipeline_deals_admin_update"
  on public.pipeline_deals for update to authenticated
  using (public.pipeline_is_admin());

drop policy if exists "pipeline_deals_admin_delete" on public.pipeline_deals;
create policy "pipeline_deals_admin_delete"
  on public.pipeline_deals for delete to authenticated
  using (public.pipeline_is_admin());

-- deal money: admin roles ONLY — a production/pipeline query returns zero rows
drop policy if exists "pipeline_deal_money_admin_all" on public.pipeline_deal_money;
create policy "pipeline_deal_money_admin_all"
  on public.pipeline_deal_money for all to authenticated
  using (public.pipeline_is_admin())
  with check (public.pipeline_is_admin());

-- quotes: admin roles ONLY
drop policy if exists "pipeline_quotes_admin_all" on public.pipeline_quotes;
create policy "pipeline_quotes_admin_all"
  on public.pipeline_quotes for all to authenticated
  using (public.pipeline_is_admin())
  with check (public.pipeline_is_admin());

-- handoffs: no money in here — all four roles read; admin + production update
-- (Mark checks gates / kickoff boxes); admin roles insert/delete
drop policy if exists "pipeline_handoffs_select" on public.pipeline_handoffs;
create policy "pipeline_handoffs_select"
  on public.pipeline_handoffs for select to authenticated
  using (public.pipeline_role() is not null);

drop policy if exists "pipeline_handoffs_admin_insert" on public.pipeline_handoffs;
create policy "pipeline_handoffs_admin_insert"
  on public.pipeline_handoffs for insert to authenticated
  with check (public.pipeline_is_admin());

drop policy if exists "pipeline_handoffs_update" on public.pipeline_handoffs;
create policy "pipeline_handoffs_update"
  on public.pipeline_handoffs for update to authenticated
  using (public.pipeline_role() in ('admin_finance', 'admin_exec', 'production'));

drop policy if exists "pipeline_handoffs_admin_delete" on public.pipeline_handoffs;
create policy "pipeline_handoffs_admin_delete"
  on public.pipeline_handoffs for delete to authenticated
  using (public.pipeline_is_admin());

-- ─── Money-derived AGGREGATES for the pipeline role (Wilder) ────────────────
-- Wilder sees distributions, never per-deal numbers. SECURITY DEFINER bypasses
-- the money RLS, and the function only ever returns buckets/counts/averages.
create or replace function public.pipeline_money_aggregates()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text := public.pipeline_role();
  v_delta jsonb;
  v_discounts jsonb;
begin
  if v_role is null then
    raise exception 'not authorized for pipeline analytics';
  end if;

  -- Quoted → agreed delta distribution, 5%-wide buckets (what negotiation costs)
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', n) order by bucket), '[]'::jsonb)
    into v_delta
  from (
    select floor(((m.quoted_total - m.agreed_total) / nullif(m.quoted_total, 0)) * 100 / 5) * 5 as bucket,
           count(*) as n
    from public.pipeline_deal_money m
    where m.quoted_total is not null and m.agreed_total is not null and m.quoted_total <> 0
    group by 1
  ) t;

  -- Discount frequency / size / labels (across all non-draft quotes)
  select coalesce(jsonb_agg(jsonb_build_object(
           'label', label, 'count', n, 'avgPct', round(avg_pct::numeric, 1)) order by n desc), '[]'::jsonb)
    into v_discounts
  from (
    select q.discount->>'label' as label,
           count(*) as n,
           avg(case when q.discount->>'mode' = 'percent'
                    then (q.discount->>'value')::numeric end) as avg_pct
    from public.pipeline_quotes q
    where q.discount is not null
      and coalesce(q.discount->>'label', '') <> ''
      and q.status <> 'draft'
    group by 1
  ) t;

  return jsonb_build_object(
    'deltaBuckets', v_delta,
    'discounts',    v_discounts
  );
end;
$$;

-- ─── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.pipeline_deals;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pipeline_quotes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pipeline_handoffs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pipeline_deal_money;
exception when duplicate_object then null; end $$;
```

**Verify after running** (should return 6 rows of `true`):

```sql
select 'deals'    as t, exists (select from information_schema.tables where table_name = 'pipeline_deals') as ok
union all select 'money',    exists (select from information_schema.tables where table_name = 'pipeline_deal_money')
union all select 'quotes',   exists (select from information_schema.tables where table_name = 'pipeline_quotes')
union all select 'handoffs', exists (select from information_schema.tables where table_name = 'pipeline_handoffs')
union all select 'ratecards',exists (select from information_schema.tables where table_name = 'pipeline_rate_cards')
union all select 'role_fn',  exists (select from pg_proc where proname = 'pipeline_role');
```

---

## 0) ~~FIRST — profile duplicates (Danny/Wilder) + admin roles~~ — RESOLVED, SKIP

Profiles are 1:1 with Google sign-ins, so a "duplicate Danny" is a second
sign-in under a different email (e.g. personal gmail vs @orbitalvs.com). The
earlier promote-everyone SQL made those dupes admin too. Fix in two steps:

**Step 1 — see what exists** (run this, look at the output):

```sql
select p.id, p.email, p.name, p.role, p.created_at,
       (select count(*) from public.tasks t where t.created_by = p.id) as tasks_created
from public.profiles p
order by p.name, p.created_at;
```

**Step 2 — delete each duplicate at the AUTH level** (deleting only the
profile row would just let it recreate on next login). Easiest: dashboard →
Authentication → Users → find the duplicate email → Delete user (the profile
cascades). Or by SQL, one per dupe id from step 1:

```sql
delete from auth.users where id = 'PASTE-DUPE-ID-HERE';
```

**Step 3 — make the verified accounts admin and keep it sticky:**

```sql
update public.profiles set role = 'admin'
where email in ('dhorgan@orbitalvs.com');  -- add the other verified emails

insert into public.role_assignments (email, role, display_name)
values ('dhorgan@orbitalvs.com', 'admin', 'Danny')  -- repeat per person
on conflict (email) do update set role = 'admin';
```

The `role_assignments` upsert means if anyone ever signs in fresh with that
email, they come back as admin automatically. If the dupe emails are ones
people might accidentally sign in with again, DON'T pre-authorize those.

*Written 2026-07-16. Four modules shipped tonight need their tables/columns.
The app is already live and **degrades gracefully** until you run this —
activity silently doesn't count, to-dos/feedback stay in each browser,
kinds don't persist. Run it once and everything lights up.*

Paste the whole block below into the SQL editor and hit Run. It's **fully
idempotent** — safe to run any number of times. It creates only what's
missing and re-applies policies/triggers cleanly, so the
`relation "activity_events" already exists` error can't happen (that was
the old version; `create table` without `if not exists` aborts the whole
transaction). Re-run this exact block; whatever partially applied before
gets reconciled.

```sql
-- ═══════════════ M1 — activity_events (#12 real analytics) ═══════════════
create table if not exists public.activity_events (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_name     text not null default '',
  verb           text not null
                   check (verb in ('created', 'updated', 'deleted', 'completed',
                                   'assigned', 'status_changed', 'commented')),
  entity_type    text not null
                   check (entity_type in ('task', 'production', 'contractor',
                                          'milestone', 'concern', 'feedback')),
  entity_id      text not null default '',
  entity_label   text not null default '',
  production_id  uuid references public.productions(id) on delete set null,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists activity_events_created_at_idx    on public.activity_events (created_at desc);
create index if not exists activity_events_actor_id_idx      on public.activity_events (actor_id);
create index if not exists activity_events_production_id_idx on public.activity_events (production_id);
create index if not exists activity_events_entity_type_idx   on public.activity_events (entity_type);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select" on public.activity_events;
create policy "activity_events_select"
  on public.activity_events for select to authenticated
  using (true);

drop policy if exists "activity_events_insert" on public.activity_events;
create policy "activity_events_insert"
  on public.activity_events for insert to authenticated
  with check (actor_id = auth.uid());

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_events') then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end $$;

-- ═══════════════ M2 — tasks + to-dos merge (#14) ═══════════════
alter table public.tasks alter column production_id drop not null;

alter table public.tasks add column if not exists visibility text not null default 'team'
  check (visibility in ('team', 'personal'));

alter table public.tasks add column if not exists completed_at timestamptz;

create or replace function public.stamp_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('Complete', 'Verified') then
    if tg_op = 'INSERT' then
      new.completed_at := now();
    elsif old.status not in ('Complete', 'Verified') then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_stamp_completed_at on public.tasks;
create trigger tasks_stamp_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completed_at();

create or replace function public.sync_production_task_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.production_id, old.production_id);
  if pid is null then
    return null;
  end if;
  update public.productions
  set task_ids = coalesce(
    (select array_agg(id order by created_at)
     from public.tasks
     where production_id = pid),
    '{}'::uuid[]
  )
  where id = pid;
  return null;
end;
$$;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select"
  on public.tasks for select to authenticated
  using (
    case when production_id is null then
      visibility = 'team'
      or created_by = auth.uid()
      or assignee_id = auth.uid()::text
    else
      public.is_admin_or_supervisor()
      or assignee_id = auth.uid()::text
      or public.is_assigned_to_production(production_id)
    end
  );

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert to authenticated
  with check (
    public.is_admin_or_supervisor()
    or (production_id is null and created_by = auth.uid())
  );

drop policy if exists "tasks_update_creator_todo" on public.tasks;
create policy "tasks_update_creator_todo"
  on public.tasks for update to authenticated
  using (production_id is null and created_by = auth.uid())
  with check (production_id is null and created_by = auth.uid());

drop policy if exists "tasks_delete_creator_todo" on public.tasks;
create policy "tasks_delete_creator_todo"
  on public.tasks for delete to authenticated
  using (production_id is null and created_by = auth.uid());

-- ═══════════════ M4 — project kinds + debrief notes (#5, #6) ═══════════════
alter table public.productions add column if not exists kind text not null default 'production'
  check (kind in ('production', 'tour', 'internal'));

alter table public.productions add column if not exists debrief_notes jsonb not null default '[]'::jsonb;

create index if not exists productions_kind_idx on public.productions (kind);

-- ═══════════════ M5 — feedback_items (#3 frictionless feedback) ═══════════════
create table if not exists public.feedback_items (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null default 'note'
                       check (kind in ('bug', 'idea', 'note')),
  title              text not null,
  description        text not null default '',
  status             text not null default 'New'
                       check (status in ('New', 'Acknowledged', 'In Progress', 'Shipped', 'Won''t Fix')),
  submitted_by       uuid references public.profiles(id) on delete set null,
  submitted_by_name  text not null default '',
  resolution_note    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists feedback_items_created_at_idx on public.feedback_items (created_at desc);
create index if not exists feedback_items_status_idx     on public.feedback_items (status);

drop trigger if exists feedback_items_set_updated_at on public.feedback_items;
create trigger feedback_items_set_updated_at
  before update on public.feedback_items
  for each row execute function public.set_updated_at();

alter table public.feedback_items enable row level security;

drop policy if exists "feedback_items_select" on public.feedback_items;
create policy "feedback_items_select"
  on public.feedback_items for select to authenticated
  using (true);

drop policy if exists "feedback_items_insert" on public.feedback_items;
create policy "feedback_items_insert"
  on public.feedback_items for insert to authenticated
  with check (submitted_by = auth.uid());

drop policy if exists "feedback_items_update" on public.feedback_items;
create policy "feedback_items_update"
  on public.feedback_items for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

drop policy if exists "feedback_items_delete" on public.feedback_items;
create policy "feedback_items_delete"
  on public.feedback_items for delete to authenticated
  using (public.is_admin());

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback_items') then
    alter publication supabase_realtime add table public.feedback_items;
  end if;
end $$;
```

### After it runs — confirm everything landed (optional)

Paste this to see all four modules in one result (expect `t` in every column):

```sql
select
  to_regclass('public.activity_events') is not null                                    as m1_activity_table,
  exists(select 1 from information_schema.columns
         where table_name='tasks' and column_name='visibility')                        as m2_tasks_visibility,
  exists(select 1 from information_schema.columns
         where table_name='tasks' and column_name='completed_at')                      as m2_tasks_completed_at,
  exists(select 1 from information_schema.columns
         where table_name='productions' and column_name='kind')                        as m4_productions_kind,
  to_regclass('public.feedback_items') is not null                                     as m5_feedback_table;
```

## Voice transcription is down — one terminal command

Danny's "transcription service is unreachable" error is real: the
**`transcribe` edge function returns 404 (no longer deployed)** while
parse-intake is fine (401 = deployed, auth-gated). The source is in the repo;
redeploy from the repo root:

```
supabase functions deploy transcribe --project-ref ectyohuqgpnwivpjpuga
supabase functions deploy parse-intake --project-ref ectyohuqgpnwivpjpuga
```

(parse-intake needs a redeploy too: it now extracts dated EVENTS — tech
scouts, prelights, shoot days — which fill the form dates when a screenshot
has no explicit shoot dates, and seed the editable milestone list in review.
Until redeployed, the parser works as before, just without events.)

(The CLI on this machine is already logged in. The OpenAI key secret should
still be set project-side — if the mic errors after redeploy, re-run
`supabase secrets set OPENAI_API_KEY=... --project-ref ectyohuqgpnwivpjpuga`.)

## Also still on you (from before)

1. **Fake-data wipe (#10):** run `supabase/demo-wipe.sql`, then
   `delete from public.contractors;` (you said clear ALL contractors), and
   eyeball `select id, name, client, is_demo from public.productions order by created_at;`
2. **Confirm `phase6h` migration** was ever run (notifications RLS hardening).
3. Free→paid Supabase upgrade (stability — free tier pauses after ~7 idle days).

## What happens after you run the block

- Every task/production/contractor/milestone/comment action starts logging
  to `activity_events` → Analytics fills in (Team Activity, feed, Task Flow).
- Each person's browser auto-imports their old localStorage to-dos and
  feedback reports into the shared tables on next load (originals kept in
  `*_backup` localStorage keys).
- To-dos become real shared tasks (team/personal visibility enforced by RLS).
- New Tour / Internal projects persist their kind; debrief quick notes save.
- The floating feedback widget's reports reach everyone, not just your browser.
