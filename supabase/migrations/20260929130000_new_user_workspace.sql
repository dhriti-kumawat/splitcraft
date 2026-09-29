-- Every new account gets its own workspace, named after the user ("Dhriti's Workspace"),
-- with the user as owner. Runs inside Supabase Auth's insert into auth.users.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_first text := coalesce(split_part(v_name, ' ', 1), split_part(new.email, '@', 1), 'My');
  v_workspace uuid;
begin
  insert into public.workspaces (name, created_by)
  values (left(v_first || '''s Workspace', 100), new.id)
  returning id into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
