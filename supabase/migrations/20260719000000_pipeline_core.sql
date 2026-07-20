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
  ('wilder@orbitalvs.com',     'pipeline')        -- Wilder — Head of AI
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
