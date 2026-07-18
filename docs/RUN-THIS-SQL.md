# Danny: run this SQL (one paste, Supabase dashboard → SQL Editor)

> **STATUS 2026-07-17: ✅ ALL SQL BELOW HAS BEEN RUN AND VERIFIED.** Danny
> pasted the migration block and the 5-way diagnostic returned all `true`.
> The profile-duplicates section is **superseded** — the DB was clean (3
> real people, no dupes); the duplication Danny saw was the hardcoded
> legacy roster rendering beside real profiles, fixed in code (`feeea44`,
> `buildRoster()`). **Do not delete any profiles.** The only remaining
> action is the two edge-function deploys (see "Voice transcription is
> down" below). This file is kept as the reference for what was applied.

## 0) ~~FIRST — profile duplicates (Danny/Wilder) + admin roles~~ — RESOLVED, SKIP

Profiles are 1:1 with Google sign-ins, so a "duplicate Danny" is a second
sign-in under a different email (e.g. personal gmail vs @orbitalvs.com). The
earlier promote-everyone SQL made those dupes admin too. Fix in two steps:

**Step 1 — see what exists** (run this, look at the output):

```sql
select p.id, p.email, p.name, p.role, p.created_at,
       (select count(*) from public.tasks t where t.created_by = p.id) as tasks_created
from public.profiles p
order by p.name, p.created_at;
```

**Step 2 — delete each duplicate at the AUTH level** (deleting only the
profile row would just let it recreate on next login). Easiest: dashboard →
Authentication → Users → find the duplicate email → Delete user (the profile
cascades). Or by SQL, one per dupe id from step 1:

```sql
delete from auth.users where id = 'PASTE-DUPE-ID-HERE';
```

**Step 3 — make the verified accounts admin and keep it sticky:**

```sql
update public.profiles set role = 'admin'
where email in ('dhorgan@orbitalvs.com');  -- add the other verified emails

insert into public.role_assignments (email, role, display_name)
values ('dhorgan@orbitalvs.com', 'admin', 'Danny')  -- repeat per person
on conflict (email) do update set role = 'admin';
```

The `role_assignments` upsert means if anyone ever signs in fresh with that
email, they come back as admin automatically. If the dupe emails are ones
people might accidentally sign in with again, DON'T pre-authorize those.

*Written 2026-07-16. Four modules shipped tonight need their tables/columns.
The app is already live and **degrades gracefully** until you run this —
activity silently doesn't count, to-dos/feedback stay in each browser,
kinds don't persist. Run it once and everything lights up.*

Paste the whole block below into the SQL editor and hit Run. It's **fully
idempotent** — safe to run any number of times. It creates only what's
missing and re-applies policies/triggers cleanly, so the
`relation "activity_events" already exists` error can't happen (that was
the old version; `create table` without `if not exists` aborts the whole
transaction). Re-run this exact block; whatever partially applied before
gets reconciled.

```sql
-- ═══════════════ M1 — activity_events (#12 real analytics) ═══════════════
create table if not exists public.activity_events (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_name     text not null default '',
  verb           text not null
                   check (verb in ('created', 'updated', 'deleted', 'completed',
                                   'assigned', 'status_changed', 'commented')),
  entity_type    text not null
                   check (entity_type in ('task', 'production', 'contractor',
                                          'milestone', 'concern', 'feedback')),
  entity_id      text not null default '',
  entity_label   text not null default '',
  production_id  uuid references public.productions(id) on delete set null,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists activity_events_created_at_idx    on public.activity_events (created_at desc);
create index if not exists activity_events_actor_id_idx      on public.activity_events (actor_id);
create index if not exists activity_events_production_id_idx on public.activity_events (production_id);
create index if not exists activity_events_entity_type_idx   on public.activity_events (entity_type);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select" on public.activity_events;
create policy "activity_events_select"
  on public.activity_events for select to authenticated
  using (true);

drop policy if exists "activity_events_insert" on public.activity_events;
create policy "activity_events_insert"
  on public.activity_events for insert to authenticated
  with check (actor_id = auth.uid());

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_events') then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end $$;

-- ═══════════════ M2 — tasks + to-dos merge (#14) ═══════════════
alter table public.tasks alter column production_id drop not null;

alter table public.tasks add column if not exists visibility text not null default 'team'
  check (visibility in ('team', 'personal'));

alter table public.tasks add column if not exists completed_at timestamptz;

create or replace function public.stamp_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('Complete', 'Verified') then
    if tg_op = 'INSERT' then
      new.completed_at := now();
    elsif old.status not in ('Complete', 'Verified') then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_stamp_completed_at on public.tasks;
create trigger tasks_stamp_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completed_at();

create or replace function public.sync_production_task_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.production_id, old.production_id);
  if pid is null then
    return null;
  end if;
  update public.productions
  set task_ids = coalesce(
    (select array_agg(id order by created_at)
     from public.tasks
     where production_id = pid),
    '{}'::uuid[]
  )
  where id = pid;
  return null;
end;
$$;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select"
  on public.tasks for select to authenticated
  using (
    case when production_id is null then
      visibility = 'team'
      or created_by = auth.uid()
      or assignee_id = auth.uid()::text
    else
      public.is_admin_or_supervisor()
      or assignee_id = auth.uid()::text
      or public.is_assigned_to_production(production_id)
    end
  );

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert to authenticated
  with check (
    public.is_admin_or_supervisor()
    or (production_id is null and created_by = auth.uid())
  );

drop policy if exists "tasks_update_creator_todo" on public.tasks;
create policy "tasks_update_creator_todo"
  on public.tasks for update to authenticated
  using (production_id is null and created_by = auth.uid())
  with check (production_id is null and created_by = auth.uid());

drop policy if exists "tasks_delete_creator_todo" on public.tasks;
create policy "tasks_delete_creator_todo"
  on public.tasks for delete to authenticated
  using (production_id is null and created_by = auth.uid());

-- ═══════════════ M4 — project kinds + debrief notes (#5, #6) ═══════════════
alter table public.productions add column if not exists kind text not null default 'production'
  check (kind in ('production', 'tour', 'internal'));

alter table public.productions add column if not exists debrief_notes jsonb not null default '[]'::jsonb;

create index if not exists productions_kind_idx on public.productions (kind);

-- ═══════════════ M5 — feedback_items (#3 frictionless feedback) ═══════════════
create table if not exists public.feedback_items (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null default 'note'
                       check (kind in ('bug', 'idea', 'note')),
  title              text not null,
  description        text not null default '',
  status             text not null default 'New'
                       check (status in ('New', 'Acknowledged', 'In Progress', 'Shipped', 'Won''t Fix')),
  submitted_by       uuid references public.profiles(id) on delete set null,
  submitted_by_name  text not null default '',
  resolution_note    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists feedback_items_created_at_idx on public.feedback_items (created_at desc);
create index if not exists feedback_items_status_idx     on public.feedback_items (status);

drop trigger if exists feedback_items_set_updated_at on public.feedback_items;
create trigger feedback_items_set_updated_at
  before update on public.feedback_items
  for each row execute function public.set_updated_at();

alter table public.feedback_items enable row level security;

drop policy if exists "feedback_items_select" on public.feedback_items;
create policy "feedback_items_select"
  on public.feedback_items for select to authenticated
  using (true);

drop policy if exists "feedback_items_insert" on public.feedback_items;
create policy "feedback_items_insert"
  on public.feedback_items for insert to authenticated
  with check (submitted_by = auth.uid());

drop policy if exists "feedback_items_update" on public.feedback_items;
create policy "feedback_items_update"
  on public.feedback_items for update to authenticated
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

drop policy if exists "feedback_items_delete" on public.feedback_items;
create policy "feedback_items_delete"
  on public.feedback_items for delete to authenticated
  using (public.is_admin());

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback_items') then
    alter publication supabase_realtime add table public.feedback_items;
  end if;
end $$;
```

### After it runs — confirm everything landed (optional)

Paste this to see all four modules in one result (expect `t` in every column):

```sql
select
  to_regclass('public.activity_events') is not null                                    as m1_activity_table,
  exists(select 1 from information_schema.columns
         where table_name='tasks' and column_name='visibility')                        as m2_tasks_visibility,
  exists(select 1 from information_schema.columns
         where table_name='tasks' and column_name='completed_at')                      as m2_tasks_completed_at,
  exists(select 1 from information_schema.columns
         where table_name='productions' and column_name='kind')                        as m4_productions_kind,
  to_regclass('public.feedback_items') is not null                                     as m5_feedback_table;
```

## Voice transcription is down — one terminal command

Danny's "transcription service is unreachable" error is real: the
**`transcribe` edge function returns 404 (no longer deployed)** while
parse-intake is fine (401 = deployed, auth-gated). The source is in the repo;
redeploy from the repo root:

```
supabase functions deploy transcribe --project-ref ectyohuqgpnwivpjpuga
supabase functions deploy parse-intake --project-ref ectyohuqgpnwivpjpuga
```

(parse-intake needs a redeploy too: it now extracts dated EVENTS — tech
scouts, prelights, shoot days — which fill the form dates when a screenshot
has no explicit shoot dates, and seed the editable milestone list in review.
Until redeployed, the parser works as before, just without events.)

(The CLI on this machine is already logged in. The OpenAI key secret should
still be set project-side — if the mic errors after redeploy, re-run
`supabase secrets set OPENAI_API_KEY=... --project-ref ectyohuqgpnwivpjpuga`.)

## Also still on you (from before)

1. **Fake-data wipe (#10):** run `supabase/demo-wipe.sql`, then
   `delete from public.contractors;` (you said clear ALL contractors), and
   eyeball `select id, name, client, is_demo from public.productions order by created_at;`
2. **Confirm `phase6h` migration** was ever run (notifications RLS hardening).
3. Free→paid Supabase upgrade (stability — free tier pauses after ~7 idle days).

## What happens after you run the block

- Every task/production/contractor/milestone/comment action starts logging
  to `activity_events` → Analytics fills in (Team Activity, feed, Task Flow).
- Each person's browser auto-imports their old localStorage to-dos and
  feedback reports into the shared tables on next load (originals kept in
  `*_backup` localStorage keys).
- To-dos become real shared tasks (team/personal visibility enforced by RLS).
- New Tour / Internal projects persist their kind; debrief quick notes save.
- The floating feedback widget's reports reach everyone, not just your browser.
