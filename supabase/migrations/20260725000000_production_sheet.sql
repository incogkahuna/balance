-- ─────────────────────────────────────────────────────────────────────────────
-- Production cheat sheet (Danny 2026-07-25, modelled on the old
-- orbitalvs.com/schedule cards). One jsonb column holding ONLY the facts
-- that live nowhere else on the record:
--   { "assetClass": "2D|2.5D|3D|3D+tracking", "content": "...",
--     "hoursPerDay": 10|12, "spaces": ["Loading Dock", ...] }
-- Supervisor / operators / stage manager / volume / dates are DERIVED from
-- existing fields (assigned_members, stage_manager_id, location_type,
-- led_wall_id) — deliberately NOT duplicated here.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions add column if not exists sheet jsonb not null
  default '{"assetClass":"","content":"","hoursPerDay":10,"spaces":[]}'::jsonb;

comment on column public.productions.sheet is
  'Day-of cheat sheet: assetClass / content / hoursPerDay / spaces. Everything else on the card is derived.';
