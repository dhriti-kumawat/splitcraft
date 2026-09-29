-- Reach estimates (PRODUCT_SPEC §4): the SDK sends one `ping` per session with the
-- visitor traits the dashboard can check (device, screen, source, session number, UTMs).
-- The dashboard samples recent sessions and runs the targeting rules over them.

-- Same as before, but also stores `ping` events.
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
  where e ->> 'type' in ('goal', 'ping') or ex.id is not null;
  get diagnostics v_count = row_count;

  if v_project.installed_at is null then
    update public.projects set installed_at = now() where id = v_project.id;
  end if;
  return v_count;
end;
$$;

-- A random sample of the last 30 days' sessions (one ping each), plus how many there were
-- and over how many days, so reach can be turned into visitors a day.
-- `security invoker`, so Row Level Security applies.
create function public.project_session_sample(p_project uuid, p_limit integer default 2000)
returns table (url text, props jsonb, sessions integer, days integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with pings as (
    select ev.url, ev.props, ev.created_at
    from public.events ev
    where ev.project_id = p_project
      and ev.type = 'ping'
      and ev.created_at >= now() - interval '30 days'
  ),
  totals as (
    select
      count(*)::integer as sessions,
      greatest(1, round(extract(epoch from now() - min(created_at)) / 86400))::integer as days
    from pings
  )
  select p.url, p.props, t.sessions, t.days
  from (select url, props from pings order by random() limit least(greatest(coalesce(p_limit, 2000), 1), 5000)) p
  cross join totals t;
$$;

revoke all on function public.project_session_sample(uuid, integer) from public, anon;
grant execute on function public.project_session_sample(uuid, integer) to authenticated;
