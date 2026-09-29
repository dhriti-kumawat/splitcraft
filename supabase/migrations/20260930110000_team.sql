-- Team: invite links, member list with names and emails, and rules that keep every
-- workspace with at least one owner.

-- ---------------------------------------------------------------- invites

-- An invite is a link (`/invite/<token>`) the inviter shares. It works for the invited
-- email address only, for 7 days, once.
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null default 'member' check (role in ('admin', 'member')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);

create index workspace_invites_workspace_idx on public.workspace_invites (workspace_id);

alter table public.workspace_invites enable row level security;

create policy "owners and admins see invites" on public.workspace_invites
  for select to authenticated using (public.is_workspace_member(workspace_id, array['owner', 'admin']));
create policy "owners and admins invite" on public.workspace_invites
  for insert to authenticated
  with check (invited_by = auth.uid() and public.is_workspace_member(workspace_id, array['owner', 'admin']));
create policy "owners and admins revoke invites" on public.workspace_invites
  for delete to authenticated using (public.is_workspace_member(workspace_id, array['owner', 'admin']));

-- What the invite page shows before accepting. Anyone signed in may look up a token they hold.
create function public.invite_details(p_token uuid)
returns table (workspace_name text, email text, role text, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, i.email, i.role, i.expires_at < now(), i.accepted_at is not null
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

-- Join the workspace. The signed-in account's email must match the invite.
create function public.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.workspace_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Log in to accept this invite.';
  end if;
  select * into v_invite from public.workspace_invites where token = p_token for update;
  if not found then
    raise exception 'This invite link is not valid.';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask for a new one.';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(coalesce(v_email, '')) <> lower(v_invite.email) then
    raise exception 'This invite is for %. Log in with that email to accept it.', v_invite.email;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set accepted_at = now() where id = v_invite.id;
  return v_invite.workspace_id;
end;
$$;

-- ---------------------------------------------------------------- people

-- Members with their email and name (auth.users is not readable by clients).
create function public.workspace_people(p_workspace uuid)
returns table (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email, nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), m.role, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace
    and public.is_workspace_member(p_workspace)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

-- ---------------------------------------------------------------- owner rules

-- Every workspace keeps at least one owner, and only owners grant, change or remove the
-- owner role. (Deleting the whole workspace removes its members without this check.)
create function public.protect_owners()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other_owners integer;
  v_caller_is_owner boolean := auth.uid() is null
    or public.is_workspace_member(old.workspace_id, array['owner']);
begin
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return new;
  end if;

  if (old.role = 'owner' or (tg_op = 'UPDATE' and new.role = 'owner')) and not v_caller_is_owner
     and not (tg_op = 'DELETE' and old.user_id = auth.uid()) then
    raise exception 'Only an owner can change or remove an owner.';
  end if;

  if old.role = 'owner' then
    select count(*) into v_other_owners
    from public.workspace_members
    where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id;
    if v_other_owners = 0 then
      raise exception 'A workspace needs at least one owner. Make someone else an owner first.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger workspace_members_protect_owners
before update or delete on public.workspace_members
for each row execute function public.protect_owners();

revoke all on function public.invite_details(uuid) from public, anon;
revoke all on function public.accept_invite(uuid) from public, anon;
revoke all on function public.workspace_people(uuid) from public, anon;
revoke all on function public.protect_owners() from public, anon, authenticated;
grant execute on function public.invite_details(uuid) to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.workspace_people(uuid) to authenticated;
