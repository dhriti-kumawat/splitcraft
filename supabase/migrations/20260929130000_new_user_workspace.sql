-- Every account gets its own workspace, named after the user ("Dhriti's Workspace"),
-- with the user as owner: new accounts through a trigger on Supabase Auth's insert into
-- auth.users, existing accounts through the backfill at the end.

-- Shared by the sign-up trigger and the backfill.
create function public.create_workspace_for(p_user uuid, p_email text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(p_meta ->> 'full_name'), '');
  v_first text := coalesce(
    split_part(v_name, ' ', 1),
    nullif(split_part(p_email, '@', 1), ''),
    'My'
  );
  v_workspace uuid;
begin
  insert into public.workspaces (name, created_by)
  values (left(v_first || '''s Workspace', 100), p_user)
  returning id into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace, p_user, 'owner');
  return v_workspace;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_workspace_for(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.create_workspace_for(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Accounts created before this migration get their workspace now.
do $$
declare
  u record;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from public.workspace_members m where m.user_id = au.id)
  loop
    perform public.create_workspace_for(u.id, u.email, u.raw_user_meta_data);
  end loop;
end;
$$;
