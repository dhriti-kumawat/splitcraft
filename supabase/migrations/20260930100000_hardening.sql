-- Hardening: only owners and admins delete projects, the free plan's monthly event limit
-- is enforced, the events endpoint is rate limited, and list stats use counting windows.

-- ---------------------------------------------------------------- project delete

drop policy "members manage projects" on public.projects;

create policy "members read projects" on public.projects
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members create projects" on public.projects
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "members update projects" on public.projects
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "owners and admins delete projects" on public.projects
  for delete to authenticated using (public.is_workspace_member(workspace_id, array['owner', 'admin']));

-- ---------------------------------------------------------------- monthly event limit

-- Events a plan may collect per calendar month (UTC). NULL means no limit.
create function public.plan_event_limit(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'free' then 100000 else null end;
$$;

-- Events the workspace has collected this month, counted without RLS (server use only).
create function public.workspace_month_events(p_workspace uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.events ev
  join public.projects p on p.id = ev.project_id
  where p.workspace_id = p_workspace
    and ev.created_at >= date_trunc('month', now());
$$;

create function public.workspace_over_limit(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.workspace_month_events(p_workspace) >= public.plan_event_limit(w.plan),
    false
  )
  from public.workspaces w
  where w.id = p_workspace;
$$;

-- ---------------------------------------------------------------- rate limiting

-- Fixed-window counters. No policies: only security definer functions touch it.
create table public.rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security;

-- Adds `p_hits` to a bucket's current window and returns true while it stays within `p_limit`.
create function public.rate_limit_take(p_bucket text, p_hits integer, p_limit integer, p_window interval)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), p_hits)
  on conflict (bucket) do update set
    hits = case when r.window_start <= now() - p_window then excluded.hits else r.hits + excluded.hits end,
    window_start = case when r.window_start <= now() - p_window then now() else r.window_start end
  returning hits <= p_limit;
$$;

-- ---------------------------------------------------------------- ingest_events

-- Adds two refusals to the original function:
--   -3  the workspace reached its plan's monthly event limit
--   -4  too many events: over 3,000 a minute for the project, or 300 a minute for one visitor
create or replace function public.ingest_events(p_public_key text, p_host text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_plan text;
  v_limit integer;
  v_batch integer := jsonb_array_length(p_events);
  v_visitor text;
  v_count integer;
begin
  select * into v_project from public.projects where public_key = p_public_key;
  if not found then
    return -1;
  end if;
  if not public.host_allowed(p_host, v_project.main_domain, v_project.allowed_domains) then
    return -2;
  end if;

  select w.plan into v_plan from public.workspaces w where w.id = v_project.workspace_id;
  v_limit := public.plan_event_limit(v_plan);
  if v_limit is not null
     and public.workspace_month_events(v_project.workspace_id) + v_batch > v_limit then
    return -3;
  end if;

  if not public.rate_limit_take('project:' || v_project.id, v_batch, 3000, interval '1 minute') then
    return -4;
  end if;
  for v_visitor in select distinct e ->> 'visitorId' from jsonb_array_elements(p_events) as e loop
    if not public.rate_limit_take(
      'visitor:' || v_project.id || ':' || coalesce(v_visitor, ''),
      (select count(*)::integer from jsonb_array_elements(p_events) as e where e ->> 'visitorId' = v_visitor),
      300,
      interval '1 minute'
    ) then
      return -4;
    end if;
  end loop;
  -- Now and then, drop counters that are long expired.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '10 minutes';
  end if;

  insert into public.events
    (project_id, visitor_id, experiment_id, variant_key, type, key, value, props, url)
  select
    v_project.id,
    e ->> 'visitorId',
    ex.id,
    e ->> 'variantKey',
    e ->> 'type',
    e ->> 'key',
    (e ->> 'value')::numeric,
    e -> 'props',
    e ->> 'url'
  from jsonb_array_elements(p_events) as e
  left join public.experiments ex
    on ex.project_id = v_project.id and ex.key = e ->> 'experimentKey'
  where e ->> 'type' = 'goal' or ex.id is not null;
  get diagnostics v_count = row_count;

  if v_project.installed_at is null then
    update public.projects set installed_at = now() where id = v_project.id;
  end if;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- sdk_config_source

-- Over the limit, the config serves no experiments: visitors see the original site
-- rather than variants nobody can measure.
create or replace function public.sdk_config_source(p_public_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'experiments', case when public.workspace_over_limit(p.workspace_id) then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', e.key,
        'name', e.name,
        'trafficPct', e.traffic_pct,
        'targeting', e.targeting,
        'metricIds', (
          select coalesce(jsonb_agg(em.metric_id), '[]'::jsonb)
          from public.experiment_metrics em where em.experiment_id = e.id
        ) || case when e.primary_metric_id is null then '[]'::jsonb
                  else jsonb_build_array(e.primary_metric_id) end,
        'variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'key', v.key, 'name', v.name, 'weight', v.weight, 'js', v.js, 'css', v.css
          ) order by v.key), '[]'::jsonb)
          from public.variants v where v.experiment_id = e.id
        )
      ) order by e.created_at)
      from public.experiments e
      where e.project_id = p.id and e.status = 'live'
    ), '[]'::jsonb) end,
    'segments', coalesce((
      select jsonb_object_agg(s.id, s.rules) from public.segments s where s.project_id = p.id
    ), '{}'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'eventKey', m.event_key, 'source', m.source, 'sourceConfig', m.source_config
      ))
      from public.metrics m where m.project_id = p.id
    ), '[]'::jsonb)
  )
  from public.projects p
  where p.public_key = p_public_key;
$$;

-- ---------------------------------------------------------------- experiment_stats

-- Same counting window as experiment_results, so the list and the results page agree.
create or replace function public.experiment_stats(p_project uuid)
returns table (
  experiment_id uuid,
  variant_key text,
  visitors integer,
  conversions integer,
  visitors_7d integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with first_exposure as (
    select
      ev.experiment_id,
      ev.visitor_id,
      (array_agg(ev.variant_key order by ev.created_at))[1] as variant_key,
      min(ev.created_at) as exposed_at
    from public.events ev
    join public.experiments e on e.id = ev.experiment_id
    where e.project_id = p_project and ev.type = 'exposure'
    group by ev.experiment_id, ev.visitor_id
  ),
  converted as (
    select fe.experiment_id, fe.visitor_id
    from first_exposure fe
    join public.experiments e on e.id = fe.experiment_id
    join public.metrics m on m.id = e.primary_metric_id
    where exists (
      select 1 from public.events g
      where g.project_id = p_project
        and g.type = 'goal'
        and g.key = m.event_key
        and g.visitor_id = fe.visitor_id
        and g.created_at >= fe.exposed_at
        and (
          nullif(m.measure_config ->> 'windowDays', '') is null
          or g.created_at < fe.exposed_at
             + make_interval(days => (m.measure_config ->> 'windowDays')::integer)
        )
    )
  )
  select
    fe.experiment_id,
    fe.variant_key,
    count(*)::integer,
    count(c.visitor_id)::integer,
    (count(*) filter (where fe.exposed_at >= now() - interval '7 days'))::integer
  from first_exposure fe
  left join converted c
    on c.experiment_id = fe.experiment_id and c.visitor_id = fe.visitor_id
  group by fe.experiment_id, fe.variant_key;
$$;

revoke all on function public.plan_event_limit(text) from public, anon;
revoke all on function public.workspace_month_events(uuid) from public, anon, authenticated;
revoke all on function public.workspace_over_limit(uuid) from public, anon, authenticated;
revoke all on function public.rate_limit_take(text, integer, integer, interval) from public, anon, authenticated;
grant execute on function public.plan_event_limit(text) to authenticated;
