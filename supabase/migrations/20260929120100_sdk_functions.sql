-- Database functions behind the public SDK endpoints (Edge Functions `config` and `events`).
-- Only the service role may call them; the Edge Functions hold that key on the server.

-- True when `p_host` is the project's main domain (with or without www.) or one of its
-- allowed domains. `*.example.com` allows any subdomain.
create function public.host_allowed(p_host text, p_main text, p_allowed text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_host, '') <> '' and exists (
    select 1
    from unnest(array[p_main, 'www.' || p_main] || coalesce(p_allowed, '{}')) as d
    where lower(p_host) = lower(d)
       or (d like '*.%' and lower(p_host) like '%' || lower(substr(d, 2)))
  );
$$;

-- Raw material for the SDK config of one project: live experiments with variants and
-- metric ids, plus the project's segments and metrics. The Edge Function turns this into
-- the SDK's ProjectConfig and drops anything a live experiment does not use.
create function public.sdk_config_source(p_public_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'experiments', coalesce((
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
        -- Ordered by key so bucket ranges never move between config builds.
        'variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'key', v.key, 'name', v.name, 'weight', v.weight, 'js', v.js, 'css', v.css
          ) order by v.key), '[]'::jsonb)
          from public.variants v where v.experiment_id = e.id
        )
      ) order by e.created_at)
      from public.experiments e
      where e.project_id = p.id and e.status = 'live'
    ), '[]'::jsonb),
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

-- Store a validated batch of SDK events. Returns the number of rows stored,
-- -1 for an unknown project, -2 when the page's host is not one of the project's domains.
-- Exposures for unknown experiment keys are dropped. The first batch marks the
-- project as installed ("Waiting for first ping" ends).
create function public.ingest_events(p_public_key text, p_host text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_count integer;
begin
  select * into v_project from public.projects where public_key = p_public_key;
  if not found then
    return -1;
  end if;
  if not public.host_allowed(p_host, v_project.main_domain, v_project.allowed_domains) then
    return -2;
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

revoke all on function public.host_allowed(text, text, text[]) from public, anon, authenticated;
revoke all on function public.sdk_config_source(text) from public, anon, authenticated;
revoke all on function public.ingest_events(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.host_allowed(text, text, text[]) to service_role;
grant execute on function public.sdk_config_source(text) to service_role;
grant execute on function public.ingest_events(text, text, jsonb) to service_role;
