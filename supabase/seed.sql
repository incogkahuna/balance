-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data for local development.
-- Runs after migrations on `supabase db reset`.
--
-- Pre-seeds the 8 known team members in role_assignments so that when they
-- sign in with Google for the first time, the new-user trigger picks up
-- their role and display data automatically.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.role_assignments (email, role, display_name, display_color) values
  ('mark@orbitalvs.com',       'admin', 'Mark',   '#6366f1'),
  ('aj@orbitalvs.com',         'admin', 'AJ',     '#8b5cf6'),
  ('dhorgan@orbitalvs.com',    'admin', 'Danny',  '#3b82f6'),
  ('brodriguez@orbitalvs.com', 'crew',  'Brian',  '#10b981'),
  ('wilder@orbitalvs.com',     'admin', 'Wilder', '#f59e0b'),
  ('mike@orbitalvs.com',       'crew',  'Mike',   '#06b6d4'),
  ('geo@orbitalvs.com',        'crew',  'Geo',    '#ec4899'),
  ('brian@orbitalvs.com',      'crew',  'Brian Nitzkin', '#14b8a6')
on conflict (email) do update
  set role          = excluded.role,
      display_name  = excluded.display_name,
      display_color = excluded.display_color;
