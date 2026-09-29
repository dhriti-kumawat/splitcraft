-- Automatic pausing when a guardrail is crossed (PRODUCT_SPEC §5), every 15 minutes.
--
-- A guardrail is crossed when the 95% range of the relative change sits entirely beyond
-- its limit in the bad direction: the same rule the results page uses (lib/results.ts,
-- guardrailStatus), with the same normal-approximation ranges (lib/stats.ts).
-- An experiment someone resumes after an automatic pause isn't paused again: a person
-- decided to keep it running.

alter table public.experiments add column auto_paused jsonb;

-- Per guardrail and non-control variant: the relative change, its 95% range and whether
-- it's crossed. `security invoker`, so Row Level Security applies.
create function public.guardrail_status(p_experiment uuid)
returns table (
  metric_id uuid,
  variant_key text,
  uplift double precision,
  uplift_low double precision,
  uplift_high double precision,
  max_pct double precision,
  crossed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with guards as (
    select
      em.metric_id,
      coalesce((em."limit" ->> 'maxPct')::double precision, 2) / 100 as lim,
      m.measure,
      coalesce(m.measure_config ->> 'direction', 'increase') = 'decrease' as lower_better
    from public.experiment_metrics em
    join public.metrics m on m.id = em.metric_id
    where em.experiment_id = p_experiment and em.role = 'guardrail'
  ),
  control as (
    select coalesce(
      (select key from public.variants where experiment_id = p_experiment and key = 'control'),
      (select min(key) from public.variants where experiment_id = p_experiment)
    ) as key
  ),
  arms as (
    select
      r.metric_id,
      r.variant_key,
      g.lim,
      g.lower_better,
      a.n,
      case when a.n > 0 then a.total / a.n else 0 end as mean,
      case when a.n > 0 then a.sumsq / a.n else 0 end as meansq,
      g.measure in ('unique', 'ctr') as proportion
    from public.experiment_results(p_experiment) r
    join guards g on g.metric_id = r.metric_id
    cross join lateral (
      select
        case g.measure
          when 'unique' then r.visitors
          when 'ctr' then r.viewers
          when 'total' then r.visitors
          when 'sum' then r.visitors
          else r.converters
        end::double precision as n,
        case g.measure
          when 'unique' then r.converters
          when 'ctr' then least(r.converters, r.viewers)
          when 'total' then r.events
          else r.value_sum
        end::double precision as total,
        case g.measure
          when 'total' then r.events_sumsq
          else r.value_sumsq
        end::double precision as sumsq
    ) a
  ),
  stats as (
    select
      arms.*,
      case when proportion then mean * (1 - mean) else greatest(0, meansq - mean * mean) end as var
    from arms
  )
  select
    v.metric_id,
    v.variant_key,
    (v.mean - c.mean) / c.mean,
    (v.mean - c.mean - 1.959964 * sqrt(c.var / c.n + v.var / v.n)) / c.mean,
    (v.mean - c.mean + 1.959964 * sqrt(c.var / c.n + v.var / v.n)) / c.mean,
    v.lim * 100,
    case
      when v.lower_better then (v.mean - c.mean - 1.959964 * sqrt(c.var / c.n + v.var / v.n)) / c.mean > v.lim
      else (v.mean - c.mean + 1.959964 * sqrt(c.var / c.n + v.var / v.n)) / c.mean < -v.lim
    end
  from stats v
  join stats c on c.metric_id = v.metric_id and c.variant_key = (select key from control)
  where v.variant_key <> (select key from control)
    and c.n > 0 and v.n > 0 and c.mean <> 0;
$$;

-- Pause live experiments with a crossed guardrail, recording which one and why.
-- Runs as the database owner from pg_cron; not callable by users.
create function public.auto_pause_guardrails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exp record;
  v_hit record;
  v_paused integer := 0;
begin
  for v_exp in
    select e.id from public.experiments e
    where e.status = 'live' and e.auto_paused is null
      and exists (
        select 1 from public.experiment_metrics em
        where em.experiment_id = e.id and em.role = 'guardrail'
      )
  loop
    select * into v_hit
    from public.guardrail_status(v_exp.id) gs
    where gs.crossed
    order by abs(gs.uplift) desc
    limit 1;
    if found then
      update public.experiments
      set status = 'paused',
          auto_paused = jsonb_build_object(
            'at', now(),
            'metricId', v_hit.metric_id,
            'variantKey', v_hit.variant_key,
            'uplift', v_hit.uplift,
            'upliftLow', v_hit.uplift_low,
            'upliftHigh', v_hit.uplift_high,
            'maxPct', v_hit.max_pct
          )
      where id = v_exp.id;
      v_paused := v_paused + 1;
    end if;
  end loop;
  return v_paused;
end;
$$;

revoke all on function public.guardrail_status(uuid) from public, anon;
grant execute on function public.guardrail_status(uuid) to authenticated;
revoke all on function public.auto_pause_guardrails() from public, anon, authenticated;

-- Every 15 minutes, where pg_cron exists (Supabase has it; the PGlite tests don't).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('guardrail-autopause', '*/15 * * * *', 'select public.auto_pause_guardrails()');
  end if;
end;
$$;
