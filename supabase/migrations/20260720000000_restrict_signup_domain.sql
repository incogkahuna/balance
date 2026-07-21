-- ─────────────────────────────────────────────────────────────────────────────
-- Restrict signup to Orbital Studios accounts — with per-email grants.
--
-- Before this, handle_new_user() provisioned a 'crew' profile for ANY Google
-- account, so anyone with a Gmail could sign in and reach Balance. Now a new
-- signup is allowed only if EITHER:
--   a) the email is @orbitalvs.com, OR
--   b) the email has been explicitly pre-authorized in role_assignments —
--      which makes granting a specific outside account a one-row insert:
--        insert into public.role_assignments (email, role, display_name)
--        values ('someone@gmail.com', 'crew', 'Their Name')
--        on conflict (email) do update set role = excluded.role;
--
-- Anything else RAISES: raising inside the AFTER INSERT trigger rolls back
-- the auth.users insert, so GoTrue never creates the account and no session
-- is ever issued. Existing users are unaffected (fires only on new signups).
--
-- Client-side belt-and-braces: AuthContext mirrors the same rule — orbital
-- domain passes; an outside email passes only if its profile row exists
-- (i.e. the server approved it); everything else is signed out on sight.
--
-- Idempotent: create-or-replace only.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment record;
begin
  -- Per-email grant lookup FIRST — an explicit row in role_assignments admits
  -- any address, orbital or not.
  select * into assignment
  from public.role_assignments
  where lower(email) = lower(new.email);

  -- Domain allowlist: orbital addresses pass; outside addresses need a grant.
  if not found
     and lower(coalesce(new.email, '')) not like '%@orbitalvs.com' then
    raise exception 'Access to Balance is restricted to Orbital Studios accounts (got %)', new.email
      using errcode = 'insufficient_privilege';
  end if;

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
