-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6h — Notifications RLS hardening (INSERT spoofing fix)
--
-- Background (from a security audit):
--   The original phase6e policies left notification INSERT open to any
--   authenticated user via `with check (true)`. That let any signed-in user
--   write a notification addressed to anyone else — a (low-severity, internal)
--   spoofing vector.
--
--   The legitimate insert path is the `notify_task_assignment` trigger, which
--   is SECURITY DEFINER and therefore bypasses RLS entirely. The frontend never
--   inserts notifications directly (see src/lib/data/notifications.ts — reads,
--   mark-read, and realtime only). So we can remove the permissive direct-insert
--   policy with no functional impact.
--
-- What this migration does NOT touch (deliberately):
--   The SELECT policy stays `using (true)` for now. Tightening it to
--   `recipient_id = auth.uid()::text` would BREAK reads for the five core team
--   members, whose `recipient_id` is a legacy string id ('mark', 'danny', …)
--   rather than their auth UUID (see currentUser mapping in AppContext.jsx).
--   The DB has no legacy-id→UUID mapping yet. Scoping SELECT correctly is
--   blocked on the Phase 2 migration of recipient_id to UUIDs (or adding a
--   legacy_id column to profiles). Tracked as future work, not done here.
-- ─────────────────────────────────────────────────────────────────────────────

-- Replace the permissive direct-insert policy. Normal inserts continue to flow
-- through the SECURITY DEFINER trigger (which bypasses RLS); this policy now
-- only governs the rare case of an admin/supervisor creating one by hand.
drop policy if exists "notifications_insert_authenticated" on public.notifications;

create policy "notifications_insert_admin_or_supervisor"
  on public.notifications for insert
  to authenticated
  with check (public.is_admin_or_supervisor());
