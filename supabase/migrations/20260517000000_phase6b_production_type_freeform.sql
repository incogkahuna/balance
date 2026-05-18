-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6b — Production type becomes free-form
--
-- The original CHECK constraint locked production_type to one of three values
-- ('LED Volume', 'Mobile Build', 'Other'). The studio has now codified a
-- different vocabulary (TVC AOTO, Mobile CAR process CLI, Little Dipper)
-- and wants the option to type a custom value for one-off projects.
--
-- Dropping the CHECK lets us:
--  • Switch the dropdown to the new presets
--  • Allow free-form entry via a "Custom…" option
--  • Avoid a CHECK-constraint update every time the studio coins a new term
--
-- Existing rows that still have 'LED Volume', 'Mobile Build', or 'Other' are
-- not modified — they remain valid because the column is plain text now.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions
  drop constraint if exists productions_production_type_check;

-- Update the column default to the new most-common preset
alter table public.productions
  alter column production_type set default 'TVC AOTO';

comment on column public.productions.production_type is
  'Free-form production type. UI presets: TVC AOTO, Mobile CAR process CLI, Little Dipper. Any string allowed for one-off projects.';
