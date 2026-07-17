-- ─────────────────────────────────────────────────────────────────────────────
-- M5 — Feedback off localStorage (Danny's #3: frictionless feedback)
--
-- The Bugs & Ideas reports were trapped per browser. Now they're a table, so
-- the global floating feedback widget on every page actually reaches the
-- people who can act on it. Kinds grow a plain 'note' per the #3 spec
-- (notes / feature / bug dropdown).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.feedback_items (
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

comment on table public.feedback_items is
  'App-level feedback (notes / features / bugs) — distinct from production debriefs.';

create index feedback_items_created_at_idx on public.feedback_items (created_at desc);
create index feedback_items_status_idx     on public.feedback_items (status);

create trigger feedback_items_set_updated_at
  before update on public.feedback_items
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.feedback_items enable row level security;

-- Everyone can read the board and file reports as themselves; triage
-- (status / resolution) is admin+supervisor; delete is admin.
create policy "feedback_items_select"
  on public.feedback_items for select to authenticated
  using (true);

create policy "feedback_items_insert"
  on public.feedback_items for insert to authenticated
  with check (submitted_by = auth.uid());

create policy "feedback_items_update"
  on public.feedback_items for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

create policy "feedback_items_delete"
  on public.feedback_items for delete to authenticated
  using (public.is_admin());

-- ─── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.feedback_items;
