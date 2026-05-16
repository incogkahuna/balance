-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6a — Demo data flag
--
-- Adds `is_demo` to productions / tasks / contractors so the seeded demo
-- content can be wiped in one shot when the studio is ready to move out of
-- demo mode and into real data.
--
-- Usage:
--   • Demo seed inserts rows with is_demo = true (see supabase/demo-seed.sql).
--   • Real data created through the app gets is_demo = false (column default).
--   • To wipe all demo data:  DELETE FROM productions WHERE is_demo;
--     (tasks cascade-delete via the production_id FK; contractors wipe separately.)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions add column is_demo boolean not null default false;
alter table public.tasks       add column is_demo boolean not null default false;
alter table public.contractors add column is_demo boolean not null default false;

create index productions_is_demo_idx on public.productions (is_demo) where is_demo;
create index tasks_is_demo_idx       on public.tasks       (is_demo) where is_demo;
create index contractors_is_demo_idx on public.contractors (is_demo) where is_demo;

comment on column public.productions.is_demo is
  'True for seeded demo data. Wipe with: DELETE FROM productions WHERE is_demo;';
comment on column public.tasks.is_demo is
  'True for seeded demo data. Tasks also cascade-delete with their production.';
comment on column public.contractors.is_demo is
  'True for seeded demo data. Wipe with: DELETE FROM contractors WHERE is_demo;';
