-- Per-variant counts for experiment lists and results. `security invoker`, so Row Level
-- Security applies.
--
-- A visitor belongs to the variant of their first exposure. A conversion is a unique
-- visitor who fired the primary metric's event at or after that first exposure (events
-- before exposure can't be caused by the variant).

create function public.experiment_stats(p_project uuid)
returns table (
  experiment_id uuid,
  variant_key text,
  visitors integer,
  conversions integer,
  visitors_7d integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with first_exposure as (
    select
      ev.experiment_id,
      ev.visitor_id,
      (array_agg(ev.variant_key order by ev.created_at))[1] as variant_key,
      min(ev.created_at) as exposed_at
    from public.events ev
    join public.experiments e on e.id = ev.experiment_id
    where e.project_id = p_project and ev.type = 'exposure'
    group by ev.experiment_id, ev.visitor_id
  ),
  converted as (
    select fe.experiment_id, fe.visitor_id
    from first_exposure fe
    join public.experiments e on e.id = fe.experiment_id
    join public.metrics m on m.id = e.primary_metric_id
    where exists (
      select 1 from public.events g
      where g.project_id = p_project
        and g.type = 'goal'
        and g.key = m.event_key
        and g.visitor_id = fe.visitor_id
        and g.created_at >= fe.exposed_at
    )
  )
  select
    fe.experiment_id,
    fe.variant_key,
    count(*)::integer,
    count(c.visitor_id)::integer,
    (count(*) filter (where fe.exposed_at >= now() - interval '7 days'))::integer
  from first_exposure fe
  left join converted c
    on c.experiment_id = fe.experiment_id and c.visitor_id = fe.visitor_id
  group by fe.experiment_id, fe.variant_key;
$$;

revoke all on function public.experiment_stats(uuid) from public, anon;
grant execute on function public.experiment_stats(uuid) to authenticated;
