-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-07-25 (Danny's 3-item list)
--   1. productions.card_image — brand logo / artwork on the production card:
--      { "bucket": "instruction-packages", "path": "card-images/<id>/<file>" }
--   2. pipeline_quotes.mode   — 'standard' | 'custom'. A custom quote IS its
--      custom line list: only those items are totalled and printed. Explicit
--      rather than inferred from custom_lines, so adding one custom item to a
--      standard quote can never silently drop everything else off the PDF.
-- Both idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions
  add column if not exists card_image jsonb;

comment on column public.productions.card_image is
  'Card artwork / brand logo: {bucket, path} into Supabase storage. Null = no image.';

alter table public.pipeline_quotes
  add column if not exists mode text not null default 'standard';

do $$ begin
  alter table public.pipeline_quotes
    add constraint pipeline_quotes_mode_check check (mode in ('standard', 'custom'));
exception when duplicate_object then null; end $$;

comment on column public.pipeline_quotes.mode is
  'standard = full rate-card menu drives the quote; custom = the custom_lines list IS the quote (only it totals and prints).';
