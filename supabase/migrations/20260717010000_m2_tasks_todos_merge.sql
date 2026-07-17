-- ─────────────────────────────────────────────────────────────────────────────
-- M2 — Tasks + To-Dos merge (Danny's #14: one work system instead of two)
--
-- To-Dos stop being a localStorage side-list and become tasks with no
-- production. One table, one CRUD path, two views (Tasks page = production
-- work, To-Dos page = daily quick list).
--
--   * production_id becomes NULLABLE — null = freestanding to-do.
--   * visibility ('team' | 'personal') controls who sees freestanding tasks:
--     team = whole roster, personal = creator + assignee only (yes, even
--     admins don't see others' personal items — private means private).
--   * completed_at is stamped by trigger when status enters Complete/Verified
--     (cleared if it leaves) — powers "done today" stats and Analytics
--     without trusting client clocks.
--   * Crew can now CREATE freestanding tasks (quick-add for everyone) and
--     update/delete their own; production-bound task rules are unchanged
--     (admin/supervisor create, assignee can update).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Schema ─────────────────────────────────────────────────────────────────
alter table public.tasks alter column production_id drop not null;

alter table public.tasks add column visibility text not null default 'team'
  check (visibility in ('team', 'personal'));

alter table public.tasks add column completed_at timestamptz;

comment on column public.tasks.production_id is
  'Nullable since M2 — null means a freestanding to-do.';
comment on column public.tasks.visibility is
  'Freestanding tasks only: team = roster-visible, personal = creator+assignee.';

-- Stamp completed_at on entering a done status; clear it on leaving.
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

create trigger tasks_stamp_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completed_at();

-- Null-guard the task_ids sync trigger — freestanding tasks have no
-- production row to sync.
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

-- ─── RLS rework ─────────────────────────────────────────────────────────────
drop policy "tasks_select" on public.tasks;
create policy "tasks_select"
  on public.tasks for select to authenticated
  using (
    case when production_id is null then
      -- Freestanding: team items are roster-visible; personal items are
      -- creator + assignee only (no admin bypass — private means private).
      visibility = 'team'
      or created_by = auth.uid()
      or assignee_id = auth.uid()::text
    else
      public.is_admin_or_supervisor()
      or assignee_id = auth.uid()::text
      or public.is_assigned_to_production(production_id)
    end
  );

drop policy "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert to authenticated
  with check (
    public.is_admin_or_supervisor()
    or (production_id is null and created_by = auth.uid())
  );

-- Freestanding tasks: the creator owns the whole lifecycle.
create policy "tasks_update_creator_todo"
  on public.tasks for update to authenticated
  using (production_id is null and created_by = auth.uid())
  with check (production_id is null and created_by = auth.uid());

create policy "tasks_delete_creator_todo"
  on public.tasks for delete to authenticated
  using (production_id is null and created_by = auth.uid());
