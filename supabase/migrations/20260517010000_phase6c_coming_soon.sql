-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6c — Coming Soon items
--
-- Lightweight "what's planned next" list. Two write paths:
--   1. Manual entry via the Coming Soon page (admin/supervisor only)
--   2. Slack bot — when a user @-mentions the Balance bot in any channel,
--      the message body becomes a new item (source = 'slack')
--
-- Anyone authenticated can read; only admin/supervisor can mutate via the
-- web UI. The Slack edge function uses the service role key to bypass RLS
-- when posting from the bot.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.coming_soon_items (
  id                  uuid primary key default gen_random_uuid(),
  text                text not null,
  source              text not null default 'manual'
                        check (source in ('manual', 'slack')),
  added_by            uuid references public.profiles(id) on delete set null,
  slack_user_name     text,                   -- if from slack
  slack_channel_name  text,                   -- if from slack
  is_done             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.coming_soon_items is
  'Coming-soon / roadmap items. Two sources: manual web entry and Slack @-bot mentions.';

create index coming_soon_items_created_at_idx on public.coming_soon_items (created_at desc);
create index coming_soon_items_is_done_idx    on public.coming_soon_items (is_done);

create trigger coming_soon_items_set_updated_at
  before update on public.coming_soon_items
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.coming_soon_items enable row level security;

-- Anyone authenticated can read
create policy "coming_soon_select"
  on public.coming_soon_items for select to authenticated
  using (true);

-- Admin/supervisor can add manually via the web UI
create policy "coming_soon_insert"
  on public.coming_soon_items for insert to authenticated
  with check (public.is_admin_or_supervisor());

-- Admin/supervisor can toggle done / edit
create policy "coming_soon_update"
  on public.coming_soon_items for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

-- Admin only can delete
create policy "coming_soon_delete"
  on public.coming_soon_items for delete to authenticated
  using (public.is_admin());

-- ─── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.coming_soon_items;
