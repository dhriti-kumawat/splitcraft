-- Preview any experiment, even a draft, on any page: "Preview on site" adds a secret
-- `splitcraft_preview=<token>` to the URL; the SDK (or the preview bookmark) passes it to
-- the config endpoint, which then includes that experiment whatever its status. The
-- config marks it `preview`, and the endpoint drops its targeting, so the forced variant
-- shows on the page that's open. Tokens are random, so drafts stay private.

alter table public.experiments add column preview_token uuid not null default gen_random_uuid();
create unique index experiments_preview_token_idx on public.experiments (preview_token);

drop function public.sdk_config_source(text);

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

revoke all on function public.sdk_config_source(text, uuid) from public, anon, authenticated;
grant execute on function public.sdk_config_source(text, uuid) to service_role;
