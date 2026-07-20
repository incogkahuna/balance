-- ─────────────────────────────────────────────────────────────────────────────
-- Restrict signup to Orbital Studios accounts (@orbitalvs.com).
--
-- Before this, handle_new_user() provisioned a 'crew' profile for ANY Google
-- account, so anyone with a Gmail could sign in and reach Balance. This hardens
-- the trigger to REJECT non-orbital domains: raising inside the AFTER INSERT
-- trigger rolls back the auth.users insert, so GoTrue never creates the account
-- and no session is ever issued. Existing @orbitalvs.com users are unaffected
-- (the trigger only fires on new signups).
--
-- Client-side belt-and-braces: AuthContext also signs out any non-orbital
-- session (covers accounts created before this migration until they're removed).
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
  -- Domain allowlist. Reject anything that isn't an Orbital Studios address.
  if lower(coalesce(new.email, '')) not like '%@orbitalvs.com' then
    raise exception 'Access to Balance is restricted to @orbitalvs.com accounts (got %)', new.email
      using errcode = 'insufficient_privilege';
  end if;

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
