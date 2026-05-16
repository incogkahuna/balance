-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data for local development.
-- Runs after migrations on `supabase db reset`.
--
-- Pre-seeds the 5 known team members in role_assignments so that when they
-- sign in with Google for the first time, the new-user trigger picks up
-- their role and display data automatically.
--
-- Only Mark and Danny have real emails confirmed so far — AJ, Brian, and
-- Wilder are still placeholders. Replace them with real @orbitalvs.com
-- emails before those team members sign in.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.role_assignments (email, role, display_name, display_color) values
  ('mark@orbitalvs.com',     'admin',      'Mark',   '#6366f1'),
  ('aj@CHANGEME.com',        'admin',      'AJ',     '#8b5cf6'),
  ('dhorgan@orbitalvs.com',  'admin',      'Danny',  '#3b82f6'),
  ('brian@CHANGEME.com',     'crew',       'Brian',  '#10b981'),
  ('wilder@CHANGEME.com',    'crew',       'Wilder', '#f59e0b')
on conflict (email) do update
  set role          = excluded.role,
      display_name  = excluded.display_name,
      display_color = excluded.display_color;
