-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2b — Tasks + Contractors to Postgres
--
-- Builds on Phase 2a (productions). Adds:
--   * tasks                — replaces localStorage 'balance_tasks'
--   * task_comments        — pulled out of the embedded comments[] JSONB
--   * task_status_history  — audit log of status transitions (trigger-driven)
--   * contractors          — replaces localStorage 'balance_contractors'
--
-- Key design decisions:
--   * `assignee_id` is TEXT, not UUID — same dual-id reality as productions:
--     can be a profile UUID OR a contractor UUID OR a legacy 'mark'/'aj' string.
--     RLS policies cast auth.uid() to text for comparison.
--   * `task_comments` lives in its own table rather than as a JSONB array on
--     tasks. Lets us subscribe to realtime change-feed at the comment level
--     and keeps comment authorship FK-validated.
--   * `task_status_history` is fully audit-only. Insert via trigger only;
--     no manual writes (no INSERT policy means RLS rejects all manual inserts,
--     but the SECURITY DEFINER trigger bypasses RLS).
--   * `productions.task_ids` is auto-maintained by a trigger so existing
--     components reading `production.tasks` continue to work unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helpers ───────────────────────────────────────────────────────────────
create or replace function public.is_assigned_to_production(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.productions p,
         jsonb_array_elements(p.assigned_members) m
    where p.id = p_id
      and m->>'userId' = auth.uid()::text
  )
$$;

grant execute on function public.is_assigned_to_production(uuid) to authenticated;

-- ─── tasks ─────────────────────────────────────────────────────────────────
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  production_id      uuid not null references public.productions(id) on delete cascade,
  title              text not null,
  description        text not null default '',
  assignee_id        text,
  priority           text not null default 'Medium'
                       check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status             text not null default 'Not Started'
                       check (status in ('Not Started', 'In Progress', 'Needs Review', 'Complete', 'Verified', 'Blocked')),
  blocked_reason     text not null default '',
  due_date           date,
  completion_photos  jsonb not null default '[]'::jsonb,
  instruction_package jsonb,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.tasks is
  'Production tasks. Comments and status history live in their own tables.';

create index tasks_production_id_idx on public.tasks (production_id);
create index tasks_assignee_id_idx   on public.tasks (assignee_id);
create index tasks_status_idx        on public.tasks (status);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─── task_comments ─────────────────────────────────────────────────────────
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index task_comments_task_id_idx on public.task_comments (task_id);

-- ─── task_status_history ───────────────────────────────────────────────────
create table public.task_status_history (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references public.profiles(id) on delete set null,
  changed_at   timestamptz not null default now(),
  note         text not null default ''
);

create index task_status_history_task_id_idx on public.task_status_history (task_id);

-- Trigger: append a row to history on every status change
create or replace function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger tasks_log_status_change
  after insert or update of status on public.tasks
  for each row execute function public.log_task_status_change();

-- ─── productions.task_ids sync ─────────────────────────────────────────────
-- Keep productions.task_ids array in sync with the tasks FK so existing
-- components reading production.tasks (the array of IDs) continue to work.
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

create trigger tasks_sync_production_task_ids
  after insert or delete or update of production_id on public.tasks
  for each row execute function public.sync_production_task_ids();

-- ─── contractors ───────────────────────────────────────────────────────────
create table public.contractors (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  primary_role      text not null default '',
  phone             text not null default '',
  email             text not null default '',
  availability      text not null default 'Available'
                      check (availability in ('Available', 'Booked', 'Tentative', 'Unavailable')),
  experience_level  text not null default 'Mid'
                      check (experience_level in ('Junior', 'Mid', 'Senior', 'Lead')),
  specialties       jsonb not null default '[]'::jsonb,
  photo_url         text not null default '',
  company_name      text not null default '',
  company_role      text not null default '',
  rate_per_day      text not null default '',
  flag              text not null default 'Neutral'
                      check (flag in ('Recommended', 'Neutral', 'Do Not Rehire')),
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index contractors_name_idx         on public.contractors (name);
create index contractors_availability_idx on public.contractors (availability);

create trigger contractors_set_updated_at
  before update on public.contractors
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.tasks                enable row level security;
alter table public.task_comments        enable row level security;
alter table public.task_status_history  enable row level security;
alter table public.contractors          enable row level security;

-- tasks: admin/supervisor see all; others see tasks they're assigned to
create policy "tasks_select"
  on public.tasks for select to authenticated
  using (
    public.is_admin_or_supervisor()
    or assignee_id = auth.uid()::text
    or public.is_assigned_to_production(production_id)
  );

create policy "tasks_insert"
  on public.tasks for insert to authenticated
  with check (public.is_admin_or_supervisor());

-- Two UPDATE policies: admin/supervisor (any task) OR assignee (own task only).
-- Postgres OR-combines policies for the same command.
create policy "tasks_update_admin"
  on public.tasks for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

create policy "tasks_update_assignee"
  on public.tasks for update to authenticated
  using (assignee_id = auth.uid()::text)
  with check (assignee_id = auth.uid()::text);

create policy "tasks_delete"
  on public.tasks for delete to authenticated
  using (public.is_admin());

-- task_comments: admin/supervisor + author + assignee of the task
create policy "task_comments_select"
  on public.task_comments for select to authenticated
  using (
    public.is_admin_or_supervisor()
    or author_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and t.assignee_id = auth.uid()::text
    )
  );

create policy "task_comments_insert"
  on public.task_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin_or_supervisor()
      or exists (
        select 1 from public.tasks t
        where t.id = task_comments.task_id
          and t.assignee_id = auth.uid()::text
      )
    )
  );

-- Comments are immutable for now (no UPDATE/DELETE policies).
-- Add admin-only delete in a follow-up if moderation becomes a need.

-- task_status_history: read-only audit trail
create policy "task_status_history_select"
  on public.task_status_history for select to authenticated
  using (
    public.is_admin_or_supervisor()
    or exists (
      select 1 from public.tasks t
      where t.id = task_status_history.task_id
        and (t.assignee_id = auth.uid()::text or public.is_assigned_to_production(t.production_id))
    )
  );

-- Inserts only via the SECURITY DEFINER trigger; no INSERT policy means
-- manual inserts from the client are rejected.

-- contractors: admin/supervisor only (existing app behaviour)
create policy "contractors_select"
  on public.contractors for select to authenticated
  using (public.is_admin_or_supervisor());

create policy "contractors_insert"
  on public.contractors for insert to authenticated
  with check (public.is_admin_or_supervisor());

create policy "contractors_update"
  on public.contractors for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

create policy "contractors_delete"
  on public.contractors for delete to authenticated
  using (public.is_admin());

-- ─── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.task_status_history;
alter publication supabase_realtime add table public.contractors;
