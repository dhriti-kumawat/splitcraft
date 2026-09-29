-- Click-tracker measures from PRODUCT_SPEC §5: click-through rate and time to first click.
--
-- ctr: visitors who clicked ÷ visitors who saw the element. The SDK sends a
--   `<event_key>:view` goal once per page when a matching element is half in view.
-- time_to_click: seconds from page load to the first click on a page, sent by the SDK as
--   the click's value. Each visitor counts once, with their quickest first click.

alter table public.metrics drop constraint metrics_measure_check;
alter table public.metrics add constraint metrics_measure_check
  check (measure in ('unique', 'total', 'sum', 'value_per_conversion', 'ctr', 'time_to_click'));

-- Same as before plus `viewers` (for ctr) and min() for time_to_click; the return type
-- changes, so drop and recreate.
drop function public.experiment_results(uuid);

create function public.experiment_results(p_experiment uuid)
returns table (
  metric_id uuid,
  variant_key text,
  visitors integer,
  converters integer,
  events integer,
  events_sumsq double precision,
  value_sum double precision,
  value_sumsq double precision,
  viewers integer
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
    select m.id, m.event_key, m.measure, nullif(m.measure_config ->> 'windowDays', '')::integer as window_days
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
      -- Time to first click: the visitor's quickest first click. Otherwise: total value.
      case when ms.measure = 'time_to_click' then coalesce(min(g.value), 0)
           else sum(coalesce(g.value, 0)) end as value
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
    group by ms.id, ms.measure, fe.variant_key, fe.visitor_id
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
  -- Click-through rate: exposed visitors who saw the tracked element (a `<key>:view` event).
  viewed as (
    select ms.id as metric_id, fe.variant_key, count(distinct fe.visitor_id)::integer as n
    from first_exposure fe
    cross join metric_set ms
    join exp on true
    join public.events g
      on g.project_id = exp.project_id
     and g.type = 'goal'
     and g.key = ms.event_key || ':view'
     and g.visitor_id = fe.visitor_id
     and g.created_at >= fe.exposed_at
     and (ms.window_days is null or g.created_at < fe.exposed_at + make_interval(days => ms.window_days))
    where ms.measure = 'ctr'
    group by ms.id, fe.variant_key
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
    coalesce(a.value_sumsq, 0),
    coalesce(v.n, 0)
  from metric_set ms
  cross join totals t
  left join agg a on a.metric_id = ms.id and a.variant_key = t.variant_key
  left join viewed v on v.metric_id = ms.id and v.variant_key = t.variant_key;
$$;

revoke all on function public.experiment_results(uuid) from public, anon;
grant execute on function public.experiment_results(uuid) to authenticated;
