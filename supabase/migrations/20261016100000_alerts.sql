-- Alerts to Slack or any webhook when an experiment needs attention: a guardrail paused it,
-- it reached its planned sample, or its primary goal has a clear winner. Checked every
-- 15 minutes; each experiment sends each alert once. Posting uses pg_net where it exists
-- (Supabase has it; the PGlite tests don't, so they check what would be sent).

create table public.project_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('slack', 'webhook')),
  url text not null check (url ~ '^https://[^\s/]+\.[^\s]+$' and length(url) <= 500),
  events text[] not null default array['guardrail_paused', 'sample_reached', 'winner_found']
    check (events <@ array['guardrail_paused', 'sample_reached', 'winner_found'] and cardinality(events) > 0),
  created_at timestamptz not null default now()
);
create index project_alerts_project_idx on public.project_alerts (project_id);
alter table public.project_alerts enable row level security;
create policy "members manage alerts" on public.project_alerts
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

-- What has been sent, so nothing is sent twice. Only the alert job writes it.
create table public.alert_deliveries (
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  event text not null,
  sent_at timestamptz not null default now(),
  primary key (experiment_id, event)
);
alter table public.alert_deliveries enable row level security;
create policy "members read deliveries" on public.alert_deliveries
  for select to authenticated using (public.can_access_experiment(experiment_id));

-- Experiments with something to report that hasn't been sent yet, and the message.
-- A winner needs the planned sample in every variant and a primary goal counted as unique
-- conversions or click-through, whose 95% range for the best variant is above zero.
create function public.pending_alerts()
returns table (experiment_id uuid, project_id uuid, event text, message text)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select e.id, e.project_id, e.name, e.status, e.auto_paused, e.planned_sample,
           e.primary_metric_id, m.measure
    from public.experiments e
    left join public.metrics m on m.id = e.primary_metric_id
    where (e.status = 'live' or e.auto_paused is not null)
      and exists (select 1 from public.project_alerts a where a.project_id = e.project_id)
  ),
  primary_arms as (
    select c.id, r.variant_key,
      case when c.measure = 'ctr' then r.viewers else r.visitors end::double precision as n,
      case when c.measure = 'ctr' then least(r.converters, r.viewers) else r.converters end::double precision as x,
      r.visitors
    from candidates c
    cross join lateral public.experiment_results(c.id) r
    where c.status = 'live' and c.planned_sample is not null and r.metric_id = c.primary_metric_id
  ),
  control as (
    select id, coalesce(max(variant_key) filter (where variant_key = 'control'), min(variant_key)) as key
    from primary_arms group by id
  ),
  sample as (
    select a.id, min(a.visitors) as min_visitors, count(*) as arms
    from primary_arms a group by a.id
  ),
  winners as (
    select v.id, max(v.variant_key) as variant_key
    from primary_arms v
    join control k on k.id = v.id
    join primary_arms c on c.id = v.id and c.variant_key = k.key
    join candidates e on e.id = v.id
    where v.variant_key <> k.key and e.measure in ('unique', 'ctr')
      and c.n > 0 and v.n > 0 and c.x > 0
      and (v.x / v.n - c.x / c.n)
          - 1.959964 * sqrt((c.x / c.n) * (1 - c.x / c.n) / c.n + (v.x / v.n) * (1 - v.x / v.n) / v.n) > 0
    group by v.id
  ),
  found as (
    select c.id, c.project_id, 'guardrail_paused' as event,
      format('Paused "%s": a guardrail was crossed.', c.name) as message
    from candidates c where c.auto_paused is not null
    union all
    select c.id, c.project_id, 'sample_reached',
      format('"%s" reached its planned sample of %s visitors per variant. Time to read the results.', c.name, c.planned_sample)
    from candidates c join sample s on s.id = c.id
    where s.arms > 1 and s.min_visitors >= c.planned_sample
    union all
    select c.id, c.project_id, 'winner_found',
      format('"%s" has a winner: %s beats the original on the primary goal.', c.name, w.variant_key)
    from candidates c join sample s on s.id = c.id join winners w on w.id = c.id
    where s.min_visitors >= c.planned_sample
  )
  select f.id, f.project_id, f.event, f.message
  from found f
  where not exists (
    select 1 from public.alert_deliveries d where d.experiment_id = f.id and d.event = f.event
  )
  and exists (
    select 1 from public.project_alerts a where a.project_id = f.project_id and f.event = any (a.events)
  );
$$;

-- Body for one alert: Slack takes { text }; other webhooks get the details too.
create function public.alert_body(p_kind text, p_event text, p_experiment uuid, p_message text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'slack' then jsonb_build_object('text', 'Splitcraft: ' || p_message)
    else jsonb_build_object(
      'event', p_event,
      'text', p_message,
      'experiment', (select jsonb_build_object('id', e.id, 'key', e.key, 'name', e.name, 'status', e.status)
                     from public.experiments e where e.id = p_experiment),
      'sentAt', now()
    )
  end;
$$;

create function public.post_alert(p_url text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regproc('net.http_post') is not null then
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using p_url, p_body, '{"content-type": "application/json"}'::jsonb;
  end if;
end;
$$;

-- Send everything pending and record it. Runs from pg_cron as the database owner.
create function public.send_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_alert record;
  v_sent integer := 0;
begin
  for v_row in select * from public.pending_alerts() loop
    for v_alert in
      select * from public.project_alerts a
      where a.project_id = v_row.project_id and v_row.event = any (a.events)
    loop
      perform public.post_alert(
        v_alert.url,
        public.alert_body(v_alert.kind, v_row.event, v_row.experiment_id, v_row.message)
      );
    end loop;
    insert into public.alert_deliveries (experiment_id, event) values (v_row.experiment_id, v_row.event)
    on conflict do nothing;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

-- "Send test" in project settings, for members of the alert's project.
create function public.send_test_alert(p_alert uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert public.project_alerts;
begin
  select * into v_alert from public.project_alerts where id = p_alert;
  if v_alert.id is null or not public.can_access_project(v_alert.project_id) then
    raise exception 'Alert not found' using errcode = 'P0002';
  end if;
  perform public.post_alert(
    v_alert.url,
    case v_alert.kind
      when 'slack' then jsonb_build_object('text', 'Splitcraft: test alert. Alerts for this project will arrive here.')
      else jsonb_build_object('event', 'test', 'text', 'Splitcraft test alert', 'sentAt', now())
    end
  );
end;
$$;

revoke all on function public.pending_alerts() from public, anon, authenticated;
revoke all on function public.alert_body(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.post_alert(text, jsonb) from public, anon, authenticated;
revoke all on function public.send_alerts() from public, anon, authenticated;
revoke all on function public.send_test_alert(uuid) from public, anon;
grant execute on function public.send_test_alert(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('send-alerts', '*/15 * * * *', 'select public.send_alerts()');
  end if;
end;
$$;
