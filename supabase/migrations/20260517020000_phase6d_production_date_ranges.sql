-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6d — Multiple date ranges per production
--
-- Some projects span weeks but only happen one or two days per week. The
-- existing single start_date / end_date can describe the OVERALL envelope
-- but not the working windows inside it. This migration adds a new
-- date_ranges JSONB array where each entry is { start, end } (both 'YYYY-MM-DD').
--
-- Backwards compatibility:
--  • start_date and end_date remain the canonical envelope, kept in sync
--    with min(date_ranges.start) / max(date_ranges.end) when ranges are
--    present. UI code that reads start/end (cards, Gantt, Constellation)
--    keeps working unchanged.
--  • Productions with a single working window can leave date_ranges as []
--    and continue to set start_date/end_date directly.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions
  add column date_ranges jsonb not null default '[]'::jsonb;

comment on column public.productions.date_ranges is
  'Optional array of {start, end} work windows for projects that span weeks but only run on certain days. start_date/end_date remain the overall envelope (min/max). Empty array = single-window project, use start/end directly.';
