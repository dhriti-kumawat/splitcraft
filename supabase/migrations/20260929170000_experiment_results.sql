-- Results for one experiment (step 5). `security invoker`, so Row Level Security applies.
--
-- Visitors belong to the variant of their first exposure. A metric's events count from
-- that exposure until `measure_config.windowDays` later (all later events when unset).
-- Per-visitor values are capped at the 99th percentile so one huge order can't decide
-- a test (PRODUCT_SPEC §6).

create function public.experiment_results(p_experiment uuid)
returns table (
  metric_id uuid,
  variant_key text,
  visitors integer,
  converters integer,
  events integer,
  events_sumsq double precision,
  value_sum double precision,
  value_sumsq double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with exp as (
    select e.id, e.project_id, e.primary_metric_id from public.experiments e where e.id = p_experiment
  ),
  first_exposure as (
    select
      ev.visitor_id,
      (array_agg(ev.variant_key order by ev.created_at))[1] as variant_key,
      min(ev.created_at) as exposed_at
    from public.events ev
    where ev.experiment_id = p_experiment and ev.type = 'exposure'
    group by ev.visitor_id
  ),
  metric_set as (
    select m.id, m.event_key, nullif(m.measure_config ->> 'windowDays', '')::integer as window_days
    from public.metrics m
    join exp on m.id = exp.primary_metric_id
       or m.id in (select em.metric_id from public.experiment_metrics em where em.experiment_id = p_experiment)
  ),
  per_visitor as (
    select
      ms.id as metric_id,
      fe.variant_key,
      fe.visitor_id,
      count(*) as events,
      sum(coalesce(g.value, 0)) as value
    from first_exposure fe
    cross join metric_set ms
    join exp on true
    join public.events g
      on g.project_id = exp.project_id
     and g.type = 'goal'
     and g.key = ms.event_key
     and g.visitor_id = fe.visitor_id
     and g.created_at >= fe.exposed_at
     and (ms.window_days is null or g.created_at < fe.exposed_at + make_interval(days => ms.window_days))
    group by ms.id, fe.variant_key, fe.visitor_id
  ),
  caps as (
    select metric_id, percentile_cont(0.99) within group (order by value) as cap
    from per_visitor
    group by metric_id
  ),
  capped as (
    select pv.metric_id, pv.variant_key, pv.events, least(pv.value, caps.cap) as value
    from per_visitor pv
    join caps using (metric_id)
  ),
  totals as (
    select variant_key, count(*)::integer as n from first_exposure group by variant_key
  ),
  agg as (
    select
      metric_id,
      variant_key,
      count(*)::integer as converters,
      sum(events)::integer as events,
      sum(events * events)::double precision as events_sumsq,
      sum(value)::double precision as value_sum,
      sum(value * value)::double precision as value_sumsq
    from capped
    group by metric_id, variant_key
  )
  select
    ms.id,
    t.variant_key,
    t.n,
    coalesce(a.converters, 0),
    coalesce(a.events, 0),
    coalesce(a.events_sumsq, 0),
    coalesce(a.value_sum, 0),
    coalesce(a.value_sumsq, 0)
  from metric_set ms
  cross join totals t
  left join agg a on a.metric_id = ms.id and a.variant_key = t.variant_key;
$$;

-- Primary goal by day of first exposure, for the cumulative chart.
create function public.experiment_daily(p_experiment uuid)
returns table (day date, variant_key text, visitors integer, converters integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with exp as (
    select e.project_id, m.event_key, nullif(m.measure_config ->> 'windowDays', '')::integer as window_days
    from public.experiments e
    left join public.metrics m on m.id = e.primary_metric_id
    where e.id = p_experiment
  ),
  first_exposure as (
    select
      ev.visitor_id,
      (array_agg(ev.variant_key order by ev.created_at))[1] as variant_key,
      min(ev.created_at) as exposed_at
    from public.events ev
    where ev.experiment_id = p_experiment and ev.type = 'exposure'
    group by ev.visitor_id
  )
  select
    fe.exposed_at::date,
    fe.variant_key,
    count(*)::integer,
    (count(*) filter (
      where exists (
        select 1 from public.events g, exp
        where g.project_id = exp.project_id
          and g.type = 'goal'
          and g.key = exp.event_key
          and g.visitor_id = fe.visitor_id
          and g.created_at >= fe.exposed_at
          and (exp.window_days is null or g.created_at < fe.exposed_at + make_interval(days => exp.window_days))
      )
    ))::integer
  from first_exposure fe
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public.experiment_results(uuid) from public, anon;
revoke all on function public.experiment_daily(uuid) from public, anon;
grant execute on function public.experiment_results(uuid) to authenticated;
grant execute on function public.experiment_daily(uuid) to authenticated;
