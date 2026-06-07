-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6g: Productions get a led_wall_id reference + auto-assignment hookup
--
-- WHAT CHANGED
-- ──────────────
-- 1. New column productions.led_wall_id (text, nullable). Foreign-key-ish
--    reference to an LED wall in the gear database. Not a real FK because
--    LED walls still live in localStorage (gear DB v1), not Supabase. Once
--    walls migrate to Postgres, this column can be tightened to a real FK.
-- 2. Frontend: ProductionForm's Type dropdown gets replaced with a Wall
--    picker sourced from the actual gear records (per Danny's feedback that
--    productionType and gear walls were two parallel lists for the same
--    underlying thing). Picking a wall on the production form auto-creates
--    a matching assignment on that wall for the production's date range —
--    no more two-step "create production, then go to /gear to book the
--    wall" dance.
-- 3. productionType stays as a text column. The form keeps it in sync with
--    the picked wall's name so existing display sites that read
--    productionType (cards, ticker, analytics) keep working without change.
--
-- ROLLBACK
-- ──────────
-- alter table public.productions drop column if exists led_wall_id;
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions
  add column if not exists led_wall_id text;

comment on column public.productions.led_wall_id is
  'Reference to an LED wall in the gear database. Nullable for productions without a wall (on-location shoots etc.). Not a real FK because gear walls still live in localStorage; tighten once walls move to Postgres.';

create index if not exists productions_led_wall_id_idx
  on public.productions (led_wall_id)
  where led_wall_id is not null;
