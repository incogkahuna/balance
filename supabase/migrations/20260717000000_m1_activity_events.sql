-- ─────────────────────────────────────────────────────────────────────────────
-- M1 — Activity events (Danny's #12: analytics with real data)
--
-- One append-only table recording who did what, when. The client writes a row
-- on every meaningful action (task create/complete/assign, status changes,
-- production create, comments, contractor adds, milestone adds). Analytics
-- reads from here — no derived/fake numbers anywhere.
--
-- Design notes:
--   * actor_name is denormalized so the feed renders even if the profile row
--     is later deleted (matches task_comments.author_name precedent).
--   * production_id is `on delete set null` (NOT cascade) — activity is an
--     audit trail; deleting a production shouldn't erase who did what.
--   * entity_id is TEXT for the same dual-id reality as tasks.assignee_id.
--   * Append-only: no UPDATE/DELETE policies at all. Admin cleanup, if ever
--     needed, happens in the dashboard with the service role.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.activity_events (
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

comment on table public.activity_events is
  'Append-only activity log — feeds Analytics. Client-written, RLS-guarded.';

create index activity_events_created_at_idx    on public.activity_events (created_at desc);
create index activity_events_actor_id_idx      on public.activity_events (actor_id);
create index activity_events_production_id_idx on public.activity_events (production_id);
create index activity_events_entity_type_idx   on public.activity_events (entity_type);

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.activity_events enable row level security;

-- Everyone signed in can read the feed — it drives shared analytics and the
-- per-person views. (The data is workplace activity, not private notes.)
create policy "activity_events_select"
  on public.activity_events for select to authenticated
  using (true);

-- You can only write events as yourself.
create policy "activity_events_insert"
  on public.activity_events for insert to authenticated
  with check (actor_id = auth.uid());

-- No UPDATE / DELETE policies — append-only by construction.

-- ─── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.activity_events;
