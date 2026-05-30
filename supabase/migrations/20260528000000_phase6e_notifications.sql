-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6e — In-app notifications
--
-- The simplest possible notification system: a row per "something happened
-- that this person should know about", surfaced as a bell icon + dropdown in
-- the TopBar.
--
-- recipient_id is TEXT to mirror tasks.assignee_id — the app uses legacy
-- string ids ('mark', 'danny', etc.) alongside real auth UUIDs. RLS for
-- SELECT is permissive (the frontend filters by recipient_id matching the
-- current user's resolved identity); the notification payload itself isn't
-- sensitive. RLS for UPDATE/DELETE is restricted so only the recipient (or
-- an admin) can mark their own as read.
--
-- v1 only fires on task assignment changes. Milestone / concern assignments
-- already create tasks via the auto-task pattern, so they're covered
-- transitively without a separate trigger.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   text not null,                -- matches tasks.assignee_id (legacy string or UUID-as-text)
  type           text not null,                -- 'task_assigned' | future: 'comment' | 'status_change' | ...
  entity_type    text,                         -- 'task' | 'milestone' | 'concern' | 'production'
  entity_id      uuid,                         -- the entity's id (nullable if entity_type is null)
  production_id  uuid references public.productions(id) on delete cascade,
                                               -- always set for navigation; null means standalone
  title          text not null,
  body           text not null default '',
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notification feed. recipient_id format matches tasks.assignee_id (legacy string or UUID-as-text).';

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create index notifications_recipient_recent_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- Permissive read — frontend filters by recipient_id. Notification content
-- isn't sensitive (just "you got assigned: <task title>").
create policy "notifications_select_authenticated"
  on public.notifications for select to authenticated
  using (true);

-- Mark-as-read: only the recipient (matched against auth.uid()::text), or
-- admin/supervisor.
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid()::text or public.is_admin_or_supervisor())
  with check (recipient_id = auth.uid()::text or public.is_admin_or_supervisor());

-- Inserts are gated by triggers using SECURITY DEFINER — but allow
-- authenticated direct inserts too (e.g. client-side fallback if a trigger
-- doesn't cover some future case).
create policy "notifications_insert_authenticated"
  on public.notifications for insert to authenticated
  with check (true);

-- Admin can clean up
create policy "notifications_delete_own_or_admin"
  on public.notifications for delete to authenticated
  using (recipient_id = auth.uid()::text or public.is_admin());

-- ─── Trigger: notify the assignee when a task is created or reassigned ──
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prod_name text;
begin
  -- Skip if no assignee
  if new.assignee_id is null then return new; end if;

  -- On UPDATE: only fire when assignee actually changed
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  -- Don't self-notify (you assigned the task to yourself)
  if new.assignee_id = coalesce(auth.uid()::text, '') then
    return new;
  end if;

  -- Production name for the notification body
  select name into prod_name from public.productions where id = new.production_id;

  insert into public.notifications
    (recipient_id, type, entity_type, entity_id, production_id, title, body)
  values (
    new.assignee_id,
    'task_assigned',
    'task',
    new.id,
    new.production_id,
    'New task: ' || new.title,
    coalesce(prod_name, '')
  );
  return new;
end;
$$;

create trigger tasks_notify_assignment
  after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assignment();

-- ─── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;
