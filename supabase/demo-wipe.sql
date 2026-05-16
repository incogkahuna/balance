-- ─────────────────────────────────────────────────────────────────────────────
-- Demo wipe — remove all seeded demo data in one shot.
--
-- Run this in the Supabase SQL editor when the studio is ready to move out
-- of demo mode and into real data only. Real data (is_demo = false) is left
-- completely untouched.
--
-- Tasks tied to demo productions cascade-delete via the production_id FK,
-- but we also wipe by flag for safety in case someone added a task to a
-- demo production without inheriting the flag.
-- ─────────────────────────────────────────────────────────────────────────────

-- Wipe tasks first (defensive — productions cascade would handle this too)
delete from public.tasks       where is_demo;

-- Wipe productions (cascades to any remaining tasks via FK)
delete from public.productions where is_demo;

-- Wipe contractors
delete from public.contractors where is_demo;

-- Confirm
select 'productions remaining' as kind, count(*) from public.productions where is_demo
union all
select 'tasks remaining',        count(*) from public.tasks       where is_demo
union all
select 'contractors remaining',  count(*) from public.contractors where is_demo;
-- Expected: all three counts = 0.
