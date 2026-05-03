-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2a — Productions to Postgres
--
-- This migration moves the productions entity from localStorage to Postgres
-- with row-level security and realtime subscription support.
--
-- Design notes:
--  - Sub-objects that are essentially per-production blobs (addons, feedback,
--    instructionPackage, bible, roadmap) live as JSONB columns. They never
--    need to be queried independently. They'll be normalised in later phases
--    only if we hit query patterns that need it.
--  - assigned_members / assigned_contractors are JSONB arrays for now.
--    Proper join tables come in 2b alongside contractors.
--  - task_ids is a uuid[] referencing the tasks table that arrives in 2b.
--  - userId values inside assigned_members are TEXT because legacy sample
--    data uses string ids ('mark', 'aj', etc.) while real signed-in users
--    have UUIDs. The RLS policy compares against auth.uid()::text, which
--    matches UUIDs but never matches the legacy strings — so crew won't see
--    legacy seed productions, only ones assigned to them with real UUIDs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── RLS helpers ───────────────────────────────────────────────────────────
create or replace function public.is_admin_or_supervisor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'supervisor') from public.profiles where id = auth.uid()),
    false
  )
$$;

grant execute on function public.is_admin_or_supervisor() to authenticated;

-- ─── productions ───────────────────────────────────────────────────────────
create table public.productions (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  client                text not null default '',
  location_type         text not null default 'In-House (Orbital Studios)'
                          check (location_type in ('In-House (Orbital Studios)', 'Mobile')),
  location_address      text not null default '',
  production_type       text not null default 'LED Volume'
                          check (production_type in ('LED Volume', 'Mobile Build', 'Other')),
  status                text not null default 'Incoming'
                          check (status in ('Incoming', 'Active', 'Wrap', 'Completed')),
  start_date            date,
  end_date              date,
  stage_manager_id      text,
  assigned_members      jsonb not null default '[]'::jsonb,
  assigned_contractors  jsonb not null default '[]'::jsonb,
  task_ids              uuid[] not null default '{}',
  addons                jsonb not null default '[]'::jsonb,
  feedback              jsonb,
  instruction_package   jsonb not null default
                          '{"files":[],"voiceMemos":[],"notes":""}'::jsonb,
  bible                 jsonb not null default
                          '{"keyPlayers":[],"documents":[],"concerns":[],"frictionAndFlow":[]}'::jsonb,
  roadmap               jsonb not null default
                          '{"milestones":[],"logisticalConcerns":[]}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.productions is
  'Production records. Sub-objects live as JSONB until they need their own tables.';

create index productions_status_idx     on public.productions (status);
create index productions_created_by_idx on public.productions (created_by);
create index productions_dates_idx      on public.productions (start_date, end_date);

create trigger productions_set_updated_at
  before update on public.productions
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.productions enable row level security;

create policy "productions_select"
  on public.productions for select
  to authenticated
  using (
    public.is_admin_or_supervisor()
    or exists (
      select 1
      from jsonb_array_elements(assigned_members) m
      where m->>'userId' = auth.uid()::text
    )
  );

create policy "productions_insert"
  on public.productions for insert
  to authenticated
  with check (public.is_admin_or_supervisor());

create policy "productions_update"
  on public.productions for update
  to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

create policy "productions_delete"
  on public.productions for delete
  to authenticated
  using (public.is_admin());

-- ─── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.productions;
