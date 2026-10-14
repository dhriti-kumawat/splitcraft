-- Move a project to another workspace (decision #34), like Vercel's and GitHub's transfers.
-- Everything a project owns hangs off project_id, so changing projects.workspace_id moves its
-- experiments, audiences, goals, flags, events and results with it, and its public key (the
-- snippet) stays the same.

-- Before this, "members update projects" let any member point workspace_id at any other
-- workspace they belong to. Now only move_project() can change it: requests run as
-- anon / authenticated, while move_project() runs as its owner (security definer).
create function public.keep_project_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    and current_user in ('anon', 'authenticated') then
    raise exception 'Use "Move to another workspace" to move a project.';
  end if;
  return new;
end;
$$;

create trigger projects_keep_workspace
before update of workspace_id on public.projects
for each row execute function public.keep_project_workspace();

-- The caller must be an owner or admin of both workspaces: nobody can take a project out
-- of a workspace, or push one into a workspace, without that standing in each.
create function public.move_project(p_project uuid, p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
begin
  if auth.uid() is null then
    raise exception 'Log in to move a project.';
  end if;
  select workspace_id into v_from from public.projects where id = p_project for update;
  if not found or not public.is_workspace_member(v_from, array['owner', 'admin']) then
    raise exception 'Only owners and admins of this workspace can move its projects.';
  end if;
  if v_from = p_workspace then
    raise exception 'The project is already in that workspace.';
  end if;
  if not public.is_workspace_member(p_workspace, array['owner', 'admin']) then
    raise exception 'You need to be an owner or admin of the workspace you move it to.';
  end if;
  update public.projects set workspace_id = p_workspace where id = p_project;
end;
$$;

revoke all on function public.move_project(uuid, uuid) from public, anon;
grant execute on function public.move_project(uuid, uuid) to authenticated;
