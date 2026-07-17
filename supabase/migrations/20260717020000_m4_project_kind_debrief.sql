-- ─────────────────────────────────────────────────────────────────────────────
-- M4 — Project kinds + debrief groundwork (Danny's #5, #6)
--
--   * kind: 'production' (default) | 'tour' | 'internal'. Tours and internal
--     projects share the productions table (same statuses, dates, tasks,
--     milestones) but get their own creation path that skips
--     production-only fields (type / location / LED wall). Prelights and
--     wraps stay milestone TYPES on a parent production — decided in M0.
--   * debrief_notes: quick one-tap notes captured DURING a production
--     ([{ id, text, authorId, authorName, at }]) that accumulate and feed
--     the generated end-of-production debrief document.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.productions add column kind text not null default 'production'
  check (kind in ('production', 'tour', 'internal'));

alter table public.productions add column debrief_notes jsonb not null default '[]'::jsonb;

comment on column public.productions.kind is
  'production | tour | internal — drives creation path, badges, and which fields apply.';
comment on column public.productions.debrief_notes is
  'Quick notes captured during the production; compiled into the debrief document.';

create index productions_kind_idx on public.productions (kind);
