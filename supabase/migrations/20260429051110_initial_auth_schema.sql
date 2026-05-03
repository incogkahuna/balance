-- ─────────────────────────────────────────────────────────────────────────────
-- Initial auth schema: profiles + role assignments
--
-- Design:
--  - `profiles` is keyed off `auth.users.id` (1:1 relationship)
--  - On signup, a trigger creates a profile and looks up role from
--    `role_assignments` (pre-seeded by email). Unknown emails default to 'crew'.
--  - This lets admins pre-authorize team members without them having to sign up
--    first, while keeping the source-of-truth for roles in the database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── role_assignments ────────────────────────────────────────────────────────
-- Pre-authorization table. Insert a row here BEFORE someone signs in, and the
-- trigger will use it to set their initial role / display name / color.
create table public.role_assignments (
  email          text primary key,
  role           text not null check (role in ('admin', 'supervisor', 'crew')),
  display_name   text,
  display_color  text default '#6b7280',
  created_at     timestamptz not null default now()
);

comment on table public.role_assignments is
  'Pre-authorized team members. Used by the new-user trigger to assign role + display.';

-- ─── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null unique,
  name        text not null,
  role        text not null check (role in ('admin', 'supervisor', 'crew')),
  avatar_url  text,
  color       text not null default '#6b7280',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user profile data. One row per auth.users row, created by trigger on signup.';

create index profiles_role_idx on public.profiles (role);

-- ─── updated_at trigger helper ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── new-user signup trigger ─────────────────────────────────────────────────
-- When a row appears in auth.users, create a corresponding public.profiles row.
-- Pulls role + display from role_assignments if email matches; otherwise 'crew'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment record;
begin
  select * into assignment
  from public.role_assignments
  where email = new.email;

  insert into public.profiles (id, email, name, role, avatar_url, color)
  values (
    new.id,
    new.email,
    coalesce(
      assignment.display_name,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(assignment.role, 'crew'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(assignment.display_color, '#6b7280')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.role_assignments enable row level security;

-- Anyone authenticated can read all profiles (team members are visible app-wide)
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- A user can update their own profile (name, color, avatar) but NOT their role
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Admins can update any profile (including changing roles)
create policy "profiles_admin_update_all"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can read or modify the role_assignments allowlist
create policy "role_assignments_admin_all"
  on public.role_assignments
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Bootstrapping note:
-- Before any admin exists in `profiles`, the role_assignments table can only
-- be seeded via the SQL editor in the Supabase dashboard (the postgres role
-- bypasses RLS). See supabase/seed.sql for the initial team seed.
