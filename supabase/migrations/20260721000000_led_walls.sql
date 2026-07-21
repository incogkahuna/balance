-- ─────────────────────────────────────────────────────────────────────────────
-- LED walls off localStorage (Danny's report: wall pickers show stale options).
--
-- The Gear database was per-browser localStorage (v1) — walls edited on one
-- device never reached another, so the production-form / intake wall dropdowns
-- showed the stale seed list everywhere else. One shared table fixes every
-- picker at once; the client keeps a localStorage fallback until this runs.
--
-- assignments stays jsonb (same shape the app already uses:
-- [{id, productionId, startDate, endDate, notes, createdAt, createdBy}]) —
-- the wall as a whole is the bookable unit, matching the existing model.
--
-- Idempotent: safe to paste twice.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.led_walls (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text not null default '',
  photo        text not null default '',
  status       text not null default 'In Service',
  notes        text not null default '',
  assignments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.led_walls is
  'Gear database: LED walls + their production assignments (shared source for every wall picker).';

drop trigger if exists led_walls_set_updated_at on public.led_walls;
create trigger led_walls_set_updated_at
  before update on public.led_walls
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.led_walls enable row level security;

-- Everyone signed in can see the gear list (pickers need it app-wide);
-- editing gear is admin/supervisor, matching the Gear page UI gating.
drop policy if exists "led_walls_select" on public.led_walls;
create policy "led_walls_select"
  on public.led_walls for select to authenticated
  using (true);

drop policy if exists "led_walls_insert" on public.led_walls;
create policy "led_walls_insert"
  on public.led_walls for insert to authenticated
  with check (public.is_admin_or_supervisor());

drop policy if exists "led_walls_update" on public.led_walls;
create policy "led_walls_update"
  on public.led_walls for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

drop policy if exists "led_walls_delete" on public.led_walls;
create policy "led_walls_delete"
  on public.led_walls for delete to authenticated
  using (public.is_admin_or_supervisor());

-- ─── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.led_walls;
exception when duplicate_object then null; end $$;
