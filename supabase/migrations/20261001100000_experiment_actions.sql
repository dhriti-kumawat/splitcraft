-- Experiment actions: duplicate, archive and delete.

-- ---------------------------------------------------------------- archive

-- Archived experiments leave the list's usual filters but keep their results. Only
-- stopped experiments can be archived, and an archived experiment can't go live.
alter table public.experiments add column archived_at timestamptz;
alter table public.experiments add constraint experiments_archived_not_live
  check (archived_at is null or status <> 'live');

-- ---------------------------------------------------------------- delete

-- Members read, create and edit experiments; only owners and admins delete them, and
-- never while live (deleting also removes the experiment's events).
drop policy "members manage experiments" on public.experiments;

create policy "members read experiments" on public.experiments
  for select to authenticated using (public.can_access_project(project_id));
create policy "members create experiments" on public.experiments
  for insert to authenticated with check (public.can_access_project(project_id));
create policy "members update experiments" on public.experiments
  for update to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
create policy "owners and admins delete stopped experiments" on public.experiments
  for delete to authenticated
  using (
    status <> 'live'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and public.is_workspace_member(p.workspace_id, array['owner', 'admin'])
    )
  );

-- ---------------------------------------------------------------- duplicate

-- A new draft with the same hypothesis, split, targeting, goals and variant code. Name
-- "<name> (copy)", key "<key>-copy" (then -copy-2, -copy-3…). Version history, dates and
-- events are not copied. `security invoker`, so Row Level Security applies.
create function public.duplicate_experiment(p_experiment uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_src public.experiments;
  v_id uuid;
  v_base text;
  v_key text;
begin
  select * into v_src from public.experiments where id = p_experiment;
  if not found then
    raise exception 'Experiment not found.';
  end if;

  v_base := left(v_src.key, 56) || '-copy';
  for attempt in 1..50 loop
    v_key := case when attempt = 1 then v_base else v_base || '-' || attempt end;
    exit when not exists (
      select 1 from public.experiments where project_id = v_src.project_id and key = v_key
    );
    v_key := null;
  end loop;
  if v_key is null then
    raise exception 'Could not find a free experiment key. Rename some copies first.';
  end if;

  insert into public.experiments
    (project_id, key, name, hypothesis, traffic_pct, targeting, primary_metric_id, planned_sample, plan)
  values
    (v_src.project_id, v_key, v_src.name || ' (copy)', v_src.hypothesis, v_src.traffic_pct,
     v_src.targeting, v_src.primary_metric_id, v_src.planned_sample, v_src.plan)
  returning id into v_id;

  insert into public.variants (experiment_id, key, name, weight, js, css)
  select v_id, key, name, weight, js, css from public.variants where experiment_id = p_experiment;

  insert into public.experiment_metrics (experiment_id, metric_id, role, "limit")
  select v_id, metric_id, role, "limit" from public.experiment_metrics where experiment_id = p_experiment;

  return v_id;
end;
$$;

revoke all on function public.duplicate_experiment(uuid) from public, anon;
grant execute on function public.duplicate_experiment(uuid) to authenticated;
