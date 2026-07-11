-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 7a — Persist silently-dropped fields + define is_admin()
--
-- The July 2026 audit (docs/AUDIT-2026-07.md) found several fields the UI
-- writes and displays that have no DB column — they silently vanish on
-- reload. This migration adds the columns. The client mappers gain the
-- corresponding fields in the same commit series.
--
-- Also fixes a long-standing drift: public.is_admin() has been referenced by
-- DELETE policies since phase2a but was never defined in any migration (it
-- presumably exists only in the live DB, created by hand). Defining it here
-- is idempotent if it already exists and makes clean `db reset` work.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. is_admin() — admin-only twin of is_admin_or_supervisor() ────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

grant execute on function public.is_admin() to authenticated;

-- ─── 2. tasks — fields the UI already writes and renders ────────────────────
-- expectations_note: "From assigner" context shown on the task card.
-- completion_note:   note captured by the Mark Complete flow.
-- assigned_by:       who assigned the task (TEXT like assignee_id — legacy
--                    string ids until the identity unification migration).
alter table public.tasks
  add column if not exists expectations_note text not null default '',
  add column if not exists completion_note   text not null default '',
  add column if not exists assigned_by       text;

-- ─── 3. task_comments — photo attachment + author-name snapshot ─────────────
-- photo_storage_path/photo_name: the comment photo upload has existed in the
-- UI since phase3 but was discarded before insert. Path points into the
-- task-completion-photos bucket (same one the upload component already uses).
-- author_name: denormalized display-name snapshot so comments render a name
-- without joining profiles (author_id stays the authoritative UUID).
alter table public.task_comments
  add column if not exists photo_storage_path text,
  add column if not exists photo_name         text,
  add column if not exists author_name        text not null default '';

-- ─── 4. contractors — fields the form collects but the table lacked ─────────
-- The client model/form has had these since v1; contractorToRow silently
-- dropped them. dayRate maps onto the existing rate_per_day column (no new
-- column needed) — the rest are new.
alter table public.contractors
  add column if not exists location          text  not null default '',
  add column if not exists secondary_roles   jsonb not null default '[]'::jsonb,
  add column if not exists skills            jsonb not null default '[]'::jsonb,
  add column if not exists weekly_rate       text  not null default '',
  add column if not exists rate_notes        text  not null default '',
  add column if not exists emergency_contact jsonb;
