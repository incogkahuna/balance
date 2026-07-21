-- ─────────────────────────────────────────────────────────────────────────────
-- Feedback reports gain two optional fields (Danny's prompt-export workflow):
--   context    — a short "where / expected" line (e.g. "Team tab, inside a
--                production") that makes terse feature ideas buildable first-try
--   screenshot — a compressed JPEG data URL; the single biggest unblock for UI
--                bugs. Stored inline (low volume) so it works in both the remote
--                and localStorage-fallback modes without a storage bucket.
--
-- Idempotent: add-column-if-not-exists only. The client omits these fields when
-- empty, so plain reports kept working before this ran.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.feedback_items add column if not exists context    text not null default '';
alter table public.feedback_items add column if not exists screenshot text not null default '';
