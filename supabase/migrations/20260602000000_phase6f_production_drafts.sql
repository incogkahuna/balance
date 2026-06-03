-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6f: Production drafts + simplified visibility
--
-- WHAT CHANGED
-- ──────────────
-- 1. Visibility model: previously crew could only see productions where their
--    userId was in assigned_members. That broke for Wilder (and anyone else
--    on salary roster) because the frontend writes legacy string ids
--    ('wilder', 'brian'…) not auth.uid() UUIDs, so the membership check
--    never matched. Per Danny: salary roster sees EVERY published production
--    by default — no per-membership gate. Drafts stay private to admin/sup.
--
-- 2. New column: productions.published boolean (default true). Existing rows
--    are all backfilled to true so nothing disappears overnight. NEW
--    productions created from the UI will default to FALSE (handled in the
--    JS factory) so admin/sup can iron out details before crew sees them —
--    Danny's "like a social media post" model.
--
-- 3. Brian Nitzkin (brian@orbitalvs.com) promoted from crew → supervisor so
--    he can create drafts alongside Mark/AJ/Danny. Updates both
--    role_assignments (used by the new-user trigger) and the live
--    profiles row (so the change applies immediately, not just to future
--    signins).
--
-- ROLLBACK
-- ──────────
-- 1. Drop the published column and revert RLS to the membership-based form.
-- 2. Demote Brian Nitzkin back to crew.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Add the `published` column ───────────────────────────────────────────
-- Default true so the migration is a no-op for visibility on existing rows.
-- The frontend's createProduction() factory will write `false` for new rows
-- it inserts going forward (the "Save as draft" default), so the column
-- default and the application default are intentionally different.
alter table public.productions
  add column if not exists published boolean not null default true;

comment on column public.productions.published is
  'False = draft, only visible to admin/supervisor. True = visible to all salary-roster profiles. Defaults true at the DB level for backfill; the frontend factory defaults new rows to false.';

create index if not exists productions_published_idx
  on public.productions (published);

-- ─── 2. Replace the SELECT policy ────────────────────────────────────────────
-- Old: admin/sup OR (your auth.uid is in assigned_members). The membership
-- check never worked because of the legacy-id-vs-UUID mismatch.
-- New: admin/sup OR published. Crew sees every published production
-- regardless of assignment. Per-membership concerns move to the application
-- layer (e.g. "Productions you're on" filter), not the data layer.
drop policy if exists "productions_select" on public.productions;

create policy "productions_select"
  on public.productions for select
  to authenticated
  using (
    public.is_admin_or_supervisor()
    or published = true
  );

-- INSERT/UPDATE/DELETE policies stay as-is (admin/sup only for write).
-- That's the right shape — drafts only get created by people who can
-- create productions in the first place, so no need for a "creator can
-- always see their own draft" carve-out.

-- ─── 3. Promote Brian Nitzkin to supervisor ──────────────────────────────────
-- Two writes: role_assignments (the lookup table the new-user trigger reads
-- at signup time) and profiles (the live session row). The first means
-- future fresh signins also get supervisor; the second means the change is
-- effective immediately for the existing profile row.
insert into public.role_assignments (email, role, display_name, display_color)
values ('brian@orbitalvs.com', 'supervisor', 'Brian Nitzkin', '#14b8a6')
on conflict (email) do update
  set role          = excluded.role,
      display_name  = excluded.display_name,
      display_color = excluded.display_color;

update public.profiles
   set role = 'supervisor'
 where email = 'brian@orbitalvs.com';
