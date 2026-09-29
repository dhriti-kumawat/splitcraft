-- Numbers for the Projects page and the sidebar usage meter. `security invoker`, so
-- Row Level Security applies: callers only get rows for workspaces they belong to.

create function public.project_overview(p_workspace uuid)
returns table (project_id uuid, live_tests integer, visitors_30d integer, daily_visitors integer[])
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    (select count(*)::integer from public.experiments e
      where e.project_id = p.id and e.status = 'live'),
    (select count(distinct ev.visitor_id)::integer from public.events ev
      where ev.project_id = p.id and ev.created_at >= now() - interval '30 days'),
    -- Unique visitors per day for the last 30 days (oldest first), for the sparkline.
    (select array_agg(coalesce(c.n, 0) order by d.day)
      from generate_series(current_date - 29, current_date, interval '1 day') as d(day)
      left join (
        select ev.created_at::date as day, count(distinct ev.visitor_id)::integer as n
        from public.events ev
        where ev.project_id = p.id and ev.created_at >= current_date - 29
        group by 1
      ) c on c.day = d.day::date)
  from public.projects p
  where p.workspace_id = p_workspace
  order by p.created_at;
$$;

create function public.workspace_events_this_month(p_workspace uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.events ev
  join public.projects p on p.id = ev.project_id
  where p.workspace_id = p_workspace
    and ev.created_at >= date_trunc('month', now());
$$;

-- Allowed domains may carry a port ("localhost:5173"); pages are matched by hostname,
-- so compare without it.
create or replace function public.host_allowed(p_host text, p_main text, p_allowed text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_host, '') <> '' and exists (
    select 1
    from unnest(array[p_main, 'www.' || p_main] || coalesce(p_allowed, '{}')) as raw(entry),
      lateral (select split_part(lower(raw.entry), ':', 1) as d) as domain
    where lower(p_host) = domain.d
       or (domain.d like '*.%' and lower(p_host) like '%' || substr(domain.d, 2))
  );
$$;

revoke all on function public.project_overview(uuid) from public, anon;
revoke all on function public.workspace_events_this_month(uuid) from public, anon;
grant execute on function public.project_overview(uuid) to authenticated;
grant execute on function public.workspace_events_this_month(uuid) to authenticated;
