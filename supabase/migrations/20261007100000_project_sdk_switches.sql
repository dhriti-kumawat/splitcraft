-- Per-project SDK switches (anti-flicker, single-page-app support, GA4 / dataLayer),
-- kept in projects.settings as { antiFlicker, spa, ga4 } booleans (missing = on).
-- The config endpoint passes spa / ga4 on to the SDK; anti-flicker goes on the snippet.

-- Same as before, plus the project's settings.
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
    ), '[]'::jsonb),
    'settings', p.settings
  )
  from public.projects p
  where p.public_key = p_public_key;
$$;
