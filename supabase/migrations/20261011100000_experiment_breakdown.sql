-- Results by device or traffic source (PRODUCT_SPEC §6 follow-up). Each exposed visitor is
-- grouped by their first session ping (the SDK sends one per session: `d` = device,
-- `s` = source type); visitors without a ping count as "unknown". Conversions use the
-- primary metric's event and counting window, like experiment_results.
-- `security invoker`, so Row Level Security applies.

create function public.experiment_breakdown(p_experiment uuid, p_dimension text)
returns table (segment text, variant_key text, visitors integer, converters integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with exp as (
    select e.id, e.project_id, m.event_key,
           nullif(m.measure_config ->> 'windowDays', '')::integer as window_days
    from public.experiments e
    join public.metrics m on m.id = e.primary_metric_id
    where e.id = p_experiment
  ),
  first_exposure as (
    select ev.visitor_id,
           (array_agg(ev.variant_key order by ev.created_at))[1] as variant_key,
           min(ev.created_at) as exposed_at
    from public.events ev
    where ev.experiment_id = p_experiment and ev.type = 'exposure'
    group by ev.visitor_id
  ),
  trait as (
    select distinct on (ev.visitor_id)
      ev.visitor_id,
      ev.props ->> (case p_dimension when 'source' then 's' else 'd' end) as value
    from public.events ev
    join exp on ev.project_id = exp.project_id
    join first_exposure fe on fe.visitor_id = ev.visitor_id
    where ev.type = 'ping'
    order by ev.visitor_id, ev.created_at
  ),
  converted as (
    select distinct fe.visitor_id
    from first_exposure fe
    join exp on true
    join public.events g
      on g.project_id = exp.project_id
     and g.type = 'goal'
     and g.key = exp.event_key
     and g.visitor_id = fe.visitor_id
     and g.created_at >= fe.exposed_at
     and (exp.window_days is null or g.created_at < fe.exposed_at + make_interval(days => exp.window_days))
  )
  select
    coalesce(t.value, 'unknown'),
    fe.variant_key,
    count(*)::integer,
    count(c.visitor_id)::integer
  from first_exposure fe
  left join trait t on t.visitor_id = fe.visitor_id
  left join converted c on c.visitor_id = fe.visitor_id
  where p_dimension in ('device', 'source') and exists (select 1 from exp)
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public.experiment_breakdown(uuid, text) from public, anon;
grant execute on function public.experiment_breakdown(uuid, text) to authenticated;
