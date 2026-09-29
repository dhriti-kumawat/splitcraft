-- Recent activity for the Projects page, built from timestamps the tables already keep
-- (no separate log to write to). `security invoker`, so Row Level Security applies.
-- Only the latest change per item is known: a segment edited twice shows once.

create function public.workspace_activity(p_workspace uuid, p_limit integer default 8)
returns table (
  kind text,
  project_id uuid,
  project_name text,
  subject_id uuid,
  subject text,
  at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with projects as (
    select id, name, created_at, installed_at from public.projects where workspace_id = p_workspace
  ),
  items as (
    select 'project_created' as kind, p.id as project_id, p.id as subject_id, p.name as subject, p.created_at as at
    from projects p
    union all
    select 'project_installed', p.id, p.id, p.name, p.installed_at
    from projects p where p.installed_at is not null
    union all
    select 'experiment_created', e.project_id, e.id, e.name, e.created_at
    from public.experiments e join projects p on p.id = e.project_id
    union all
    select 'experiment_launched', e.project_id, e.id, e.name, e.started_at
    from public.experiments e join projects p on p.id = e.project_id where e.started_at is not null
    union all
    select 'experiment_ended', e.project_id, e.id, e.name, e.ended_at
    from public.experiments e join projects p on p.id = e.project_id where e.ended_at is not null
    union all
    select 'experiment_archived', e.project_id, e.id, e.name, e.archived_at
    from public.experiments e join projects p on p.id = e.project_id where e.archived_at is not null
    union all
    -- A segment's first save is its creation; later saves are edits.
    select case when s.updated_at > s.created_at + interval '1 second'
             then 'segment_updated' else 'segment_created' end,
           s.project_id, s.id, s.name, s.updated_at
    from public.segments s join projects p on p.id = s.project_id
    union all
    select 'metric_created', m.project_id, m.id, m.name, m.created_at
    from public.metrics m join projects p on p.id = m.project_id
  )
  select i.kind, i.project_id, p.name, i.subject_id, i.subject, i.at
  from items i join projects p on p.id = i.project_id
  order by i.at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 50);
$$;

revoke all on function public.workspace_activity(uuid, integer) from public, anon;
grant execute on function public.workspace_activity(uuid, integer) to authenticated;
