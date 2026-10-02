-- Feature flags with gradual rollout. A flag is on for a share of visitors (rollout_pct),
-- optionally only in some segments (any of them). The SDK answers splitcraft.isEnabled(key)
-- with the same bucketing as experiments, so raising the share only adds visitors.

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null check (key ~ '^[A-Za-z0-9_.-]{1,80}$'),
  name text not null check (length(name) between 1 and 120),
  description text not null default '' check (length(description) <= 500),
  enabled boolean not null default false,
  rollout_pct numeric(5, 2) not null default 100 check (rollout_pct between 0 and 100),
  segment_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);
alter table public.feature_flags enable row level security;
create policy "members manage flags" on public.feature_flags
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

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
    'settings', p.settings,
    'flags', case when public.workspace_over_limit(p.workspace_id) then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', f.key, 'name', f.name, 'rolloutPct', f.rollout_pct, 'segmentIds', to_jsonb(f.segment_ids)
      ) order by f.key)
      from public.feature_flags f where f.project_id = p.id and f.enabled
    ), '[]'::jsonb) end
  )
  from public.projects p
  where p.public_key = p_public_key;
$$;
