-- The page an experiment runs on, for "Preview on site" (the homepage was always used).
-- A full URL on one of the project's domains; the dashboard checks the domain.
alter table public.experiments add column preview_url text
  check (preview_url is null or (preview_url ~ '^https?://' and char_length(preview_url) <= 2048));

-- Duplicates keep the test page.
create or replace function public.duplicate_experiment(p_experiment uuid)
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
    (project_id, key, name, hypothesis, traffic_pct, targeting, primary_metric_id, planned_sample, plan, preview_url)
  values
    (v_src.project_id, v_key, v_src.name || ' (copy)', v_src.hypothesis, v_src.traffic_pct,
     v_src.targeting, v_src.primary_metric_id, v_src.planned_sample, v_src.plan, v_src.preview_url)
  returning id into v_id;

  insert into public.variants (experiment_id, key, name, weight, js, css)
  select v_id, key, name, weight, js, css from public.variants where experiment_id = p_experiment;

  insert into public.experiment_metrics (experiment_id, metric_id, role, "limit")
  select v_id, metric_id, role, "limit" from public.experiment_metrics where experiment_id = p_experiment;

  return v_id;
end;
$$;
