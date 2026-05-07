-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — File Storage
--
-- Creates the five Supabase Storage buckets the app needs and the RLS
-- policies that govern who can read and write each one.
--
-- Path conventions (enforced by the upload component, not by RLS yet):
--   instruction-packages/{production_id}/{file_id}.{ext}
--   task-completion-photos/{task_id}/{photo_id}.{ext}
--   damage-photos/{production_id}/{addon_id}/{photo_id}.{ext}
--   contractor-photos/{contractor_id}.{ext}
--   voice-memos/{production_id}/{memo_id}.{ext}
--
-- RLS strategy (V1):
--   Read   — any authenticated user. (The app filters file references
--            through table-level RLS already; users only see paths in records
--            they're authorised to read.)
--   Write  — admin/supervisor for most. Task completion photos and damage
--            photos can be written by any authenticated user, since crew
--            members need to upload them as part of their normal workflow.
--
-- Tighten later if specific file leakage becomes a real risk.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Create buckets ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('instruction-packages',     'instruction-packages',     false),
  ('task-completion-photos',   'task-completion-photos',   false),
  ('damage-photos',            'damage-photos',            false),
  ('contractor-photos',        'contractor-photos',        false),
  ('voice-memos',              'voice-memos',              false)
on conflict (id) do nothing;

-- ─── Read policies ─────────────────────────────────────────────────────────
-- Any authenticated user can read from any of our buckets. The app filters
-- which paths each user sees through table-level RLS on productions/tasks/etc.

create policy "balance_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in (
      'instruction-packages',
      'task-completion-photos',
      'damage-photos',
      'contractor-photos',
      'voice-memos'
    )
  );

-- ─── Write policies ────────────────────────────────────────────────────────

-- Admin/supervisor only — for buckets where uploads are management actions.
create policy "balance_storage_write_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('instruction-packages', 'contractor-photos', 'voice-memos')
    and public.is_admin_or_supervisor()
  );

-- Anyone authenticated — for buckets crew members write to during their
-- normal workflow (completion photos, damage photos).
create policy "balance_storage_write_crew"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('task-completion-photos', 'damage-photos')
  );

-- ─── Update / Delete ───────────────────────────────────────────────────────
-- Owners (the user who uploaded) can update or delete their own objects.
-- Admins can update or delete anything in our buckets.

create policy "balance_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in (
      'instruction-packages',
      'task-completion-photos',
      'damage-photos',
      'contractor-photos',
      'voice-memos'
    )
    and (owner = auth.uid() or public.is_admin_or_supervisor())
  );

create policy "balance_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in (
      'instruction-packages',
      'task-completion-photos',
      'damage-photos',
      'contractor-photos',
      'voice-memos'
    )
    and (owner = auth.uid() or public.is_admin())
  );
