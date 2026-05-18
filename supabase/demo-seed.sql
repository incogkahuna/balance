-- ─────────────────────────────────────────────────────────────────────────────
-- Demo seed — populate the deployed app for the demo.
--
-- This is NOT a migration. Run it manually in the Supabase SQL editor
-- (it's idempotent — safe to re-run; it deletes prior demo rows first).
--
-- Wipe later with supabase/demo-wipe.sql.
--
-- All rows are flagged is_demo = true. Real data created through the app
-- stays at is_demo = false and is unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- Idempotency: wipe prior demo rows so re-running this script is safe.
delete from public.contractors where is_demo;
delete from public.productions where is_demo;  -- cascades to tasks

-- ─── Contractors (4 — pre-existing pool that productions can draw from) ────
insert into public.contractors
  (id, name, primary_role, phone, email, availability, experience_level,
   specialties, photo_url, company_name, company_role, rate_per_day, flag, notes, is_demo)
values
  ('11111111-1111-1111-1111-111111111111', 'Sarah Kim',     'Stage Manager', '310-555-0101', 'sarah@example.com',  'Available', 'Senior',
   '["LED Volume", "Disguise", "Crew Mgmt"]', '', 'Freelance', 'Stage Manager', '1200', 'Recommended', 'Strong on virtual production stages.', true),
  ('22222222-2222-2222-2222-222222222222', 'Carlos Mendoza','LED Operator',  '323-555-0142', 'carlos@example.com', 'Booked',    'Lead',
   '["ROE BP2", "Disguise vx 4+", "Pixel Mapping"]', '', 'Freelance', 'LED Operator', '1400', 'Recommended', 'Go-to for complex pixel maps.', true),
  ('33333333-3333-3333-3333-333333333333', 'Jen Park',      'DIT',           '424-555-0188', 'jen@example.com',    'Available', 'Mid',
   '["Codex Vault", "Color Mgmt", "On-set QC"]', '', 'Freelance', 'DIT', '950', 'Neutral', '', true),
  ('44444444-4444-4444-4444-444444444444', 'Marcus Chen',   'Gaffer',        '562-555-0173', 'marcus@example.com', 'Tentative', 'Senior',
   '["LED Volume", "Lighting Design", "Power"]', '', 'Freelance', 'Gaffer', '1300', 'Recommended', '', true);

-- ─── Productions (3 — mirrors the original mock fixtures) ──────────────────

-- Atlas Spring Drop — Brand Film (Active, LED Volume, in-house)
insert into public.productions
  (id, name, client, location_type, location_address, production_type, status,
   start_date, end_date, assigned_members, assigned_contractors,
   addons, feedback, instruction_package, bible, roadmap, is_demo)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'Atlas Spring Drop — Brand Film',
  'Atlas Outdoor',
  'In-House (Orbital Studios)',
  'Orbital Studios, Stage A, Los Angeles, CA',
  'LED Volume',
  'Active',
  '2026-06-12',
  '2026-06-14',
  '[]'::jsonb,
  '[{"contractorId":"22222222-2222-2222-2222-222222222222","role":"LED Operator"}]'::jsonb,
  '[{"id":"addon-1","name":"Replacement panel for damaged tile","cost":850,"damageFlag":true,"loggedAt":"2026-06-13T15:22:00Z"}]'::jsonb,
  '{"submittedAt":"2026-06-15T19:40:00Z","rating":4,"wins":"Color pipe held tight across all 3 days.","challenges":"One panel cracked on day 2 — covered by add-on.","notes":"Client thrilled with final plates."}'::jsonb,
  '{"files":[],"voiceMemos":[],"notes":"Talent has a tight 2-hour window each day. Plates locked by 10am."}'::jsonb,
  '{"keyPlayers":[{"name":"Director: Olivia Wells","note":"Spent week prior referencing color palette"}],"documents":[],"concerns":[{"id":"con-1","text":"Wardrobe overlaps with one of the LED greens — flag to Olivia"}],"frictionAndFlow":[]}'::jsonb,
  '{"milestones":[
     {"id":"m1","title":"Plates approved","date":"2026-06-10","status":"Complete"},
     {"id":"m2","title":"Stage build complete","date":"2026-06-11","status":"Complete"},
     {"id":"m3","title":"Day 1 shoot","date":"2026-06-12","status":"Complete"},
     {"id":"m4","title":"Day 2 shoot","date":"2026-06-13","status":"Complete"},
     {"id":"m5","title":"Day 3 + wrap","date":"2026-06-14","status":"In Progress"}
   ],"logisticalConcerns":[]}'::jsonb,
  true
);

-- Halberd EV Reveal — On-Location Build (Incoming, Mobile Build)
insert into public.productions
  (id, name, client, location_type, location_address, production_type, status,
   start_date, end_date, assigned_members, assigned_contractors,
   addons, feedback, instruction_package, bible, roadmap, is_demo)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Halberd EV Reveal — On-Location Build',
  'Halberd Motors',
  'Mobile',
  'Long Beach Convention Center',
  'Mobile Build',
  'Incoming',
  '2026-07-22',
  '2026-07-24',
  '[]'::jsonb,
  '[{"contractorId":"44444444-4444-4444-4444-444444444444","role":"Gaffer"}]'::jsonb,
  '[]'::jsonb,
  null,
  '{"files":[],"voiceMemos":[],"notes":"Vehicle reveal in a curved 90-degree LED corner — engineering review needed for truss load."}'::jsonb,
  '{"keyPlayers":[],"documents":[],"concerns":[{"id":"con-h1","text":"Power availability at venue — coordinate with house electrician"}],"frictionAndFlow":[]}'::jsonb,
  '{"milestones":[
     {"id":"hm1","title":"Site survey","date":"2026-07-08","status":"Not Started"},
     {"id":"hm2","title":"Truss rigging plan","date":"2026-07-15","status":"Not Started"},
     {"id":"hm3","title":"Load-in","date":"2026-07-21","status":"Not Started"},
     {"id":"hm4","title":"Reveal day","date":"2026-07-23","status":"Not Started"}
   ],"logisticalConcerns":[{"id":"lc-h1","text":"Venue insurance certificate due 30 days out"}]}'::jsonb,
  true
);

-- Pinegrove Indie Doc — Pickup Day (Wrap, Other)
insert into public.productions
  (id, name, client, location_type, location_address, production_type, status,
   start_date, end_date, assigned_members, assigned_contractors,
   addons, feedback, instruction_package, bible, roadmap, is_demo)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'Pinegrove Indie Doc — Pickup Day',
  'Pinegrove Films',
  'In-House (Orbital Studios)',
  'Orbital Studios, Stage B, Los Angeles, CA',
  'Other',
  'Wrap',
  '2026-03-09',
  '2026-03-09',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  null,
  '{"files":[],"voiceMemos":[],"notes":"Single-day pickup. Director will arrive with shot list. Stage B is the simpler setup."}'::jsonb,
  '{"keyPlayers":[],"documents":[],"concerns":[],"frictionAndFlow":[]}'::jsonb,
  '{"milestones":[
     {"id":"pm1","title":"Stage prep","date":"2026-03-08","status":"Complete"},
     {"id":"pm2","title":"Pickup shoot","date":"2026-03-09","status":"Complete"}
   ],"logisticalConcerns":[]}'::jsonb,
  true
);

-- ─── Tasks (a few per production, varied status/priority for visual fill) ──
--
-- Each task is assigned to one of the 5 Orbital salary workers (legacy
-- string ids — assignee_id is TEXT in the schema, so this works for demo
-- data even though real signed-in users have UUIDs).
--
-- For completed and verified tasks we override created_at + updated_at so
-- the Team page can show realistic turnaround times. Pattern:
--   • created_at = N days ago
--   • updated_at = M days ago (M < N)
--   • turnaround = N - M days
-- For in-progress / not-started / blocked tasks we leave both as now()
-- (current default) — they're not "completed" so they don't contribute
-- to the turnaround average.

insert into public.tasks
  (production_id, title, description, priority, status, blocked_reason, due_date,
   assignee_id, created_at, updated_at, is_demo)
values
  -- Atlas
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Confirm wardrobe palette with Olivia',
   'Walk through the Atlas color references with the director; flag the green overlap.',
   'Medium',   'Complete',     '', '2026-06-09',
   'danny',  now() - interval '9 days',  now() - interval '3 days',  true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Test LED color pipe end-to-end',
   'Calibrate camera → LED wall pipeline against the approved plates.',
   'High',     'In Progress',  '', '2026-06-11',
   'wilder', now(),                        now(),                       true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Source props for day-3 hero shot',
   'Period-correct radio + signage.',
   'Low',      'Not Started',  '', '2026-06-13',
   'brian',  now(),                        now(),                       true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'File debrief notes',
   'Wins, challenges, and add-on cost summary.',
   'Medium',   'Verified',     '', '2026-06-16',
   'mark',   now() - interval '6 days',  now() - interval '2 days',  true),

  -- Halberd
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Truss rigging plan',
   'Engineering review for curved-corner LED build with vehicle on the platform.',
   'High',     'Not Started',  '', '2026-07-15',
   'wilder', now(),                        now(),                       true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Power requirements scope',
   'Coordinate with venue electrician for service capacity.',
   'Critical', 'Blocked',      'Awaiting venue spec sheet from Long Beach Conv. Ctr.', '2026-07-10',
   'aj',     now(),                        now(),                       true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Site survey scheduling',
   'Coordinate with Halberd marketing + venue ops.',
   'Medium',   'Not Started',  '', '2026-07-08',
   'danny',  now(),                        now(),                       true),

  -- Pinegrove
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Pickup shot list confirmed',
   'Verified against editor notes.',
   'Medium',   'Verified',     '', '2026-03-08',
   'aj',     now() - interval '14 days', now() - interval '11 days', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Stage B audio room handoff',
   'Confirmed clean handoff to Pinegrove sound team.',
   'Low',      'Complete',     '', '2026-03-09',
   'brian',  now() - interval '12 days', now() - interval '10 days', true);

-- ─── Result summary ────────────────────────────────────────────────────────
select 'productions seeded' as kind, count(*) from public.productions where is_demo
union all
select 'tasks seeded',        count(*) from public.tasks       where is_demo
union all
select 'contractors seeded',  count(*) from public.contractors where is_demo;
