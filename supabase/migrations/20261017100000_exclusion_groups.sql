-- Mutual exclusion groups: live experiments that share a group never show to the same
-- visitor. The SDK hashes the visitor into one of the group's live tests (evenly), and the
-- visitor can only enter that one. The config sends each test's place in its group.

alter table public.experiments add column exclusion_group text
  check (exclusion_group is null or (length(exclusion_group) between 1 and 60));

create or replace function public.sdk_config_source(p_public_key text, p_preview uuid default null)
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
        'preview', e.status <> 'live',
        'name', e.name,
        'trafficPct', e.traffic_pct,
        'targeting', e.targeting,
        -- [group, this test's place among the group's live tests, how many there are]
        'group', case when e.exclusion_group is null or e.status <> 'live' then null else jsonb_build_array(
          e.exclusion_group,
          (select count(*) from public.experiments x
           where x.project_id = e.project_id and x.status = 'live'
             and x.exclusion_group = e.exclusion_group and x.key < e.key),
          (select count(*) from public.experiments x
           where x.project_id = e.project_id and x.status = 'live'
             and x.exclusion_group = e.exclusion_group)
        ) end,
        'metricIds', (
          select coalesce(jsonb_agg(em.metric_id), '[]'::jsonb)
          from public.experiment_metrics em where em.experiment_id = e.id
        ) || case when e.primary_metric_id is null then '[]'::jsonb
                  else jsonb_build_array(e.primary_metric_id) end,
        'variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'key', v.key, 'name', v.name, 'weight', v.weight, 'js', v.js, 'css', v.css, 'url', v.url
          ) order by v.key), '[]'::jsonb)
          from public.variants v where v.experiment_id = e.id
        )
      ) order by e.created_at)
      from public.experiments e
      where e.project_id = p.id
        and (e.status = 'live' or (p_preview is not null and e.preview_token = p_preview))
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
