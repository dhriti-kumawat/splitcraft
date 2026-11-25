-- Splitcraft is invite-only: an account (email sign-up, magic link or GitHub/Google) is only
-- created for an email on this allowlist. Existing accounts are unaffected. The list itself is
-- filled in the production database, not here, so real addresses stay out of the repository:
--   insert into public.allowed_emails (email) values ('someone@example.com');

create table public.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email like '%@%'),
  added_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
-- No policies: nobody reads or writes the list through the API.

create function public.only_allowed_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.allowed_emails where email = lower(btrim(coalesce(new.email, '')))
  ) then
    raise exception 'Splitcraft is invite-only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger auth_users_invite_only
before insert on auth.users
for each row execute function public.only_allowed_emails();
