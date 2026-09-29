-- "Try with demo data": a sample project with experiments and about two weeks of
-- simulated traffic, so a new account can see results, reach and the rest at once.
-- Demo projects are flagged, and their events don't count toward the monthly allowance.
-- Their domain (demo.splitcraft.dev) isn't a real site, so no visitor ever loads them.

alter table public.projects add column demo boolean not null default false;

create or replace function public.workspace_month_events(p_workspace uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.events ev
  join public.projects p on p.id = ev.project_id
  where p.workspace_id = p_workspace
    and not p.demo
    and ev.created_at >= date_trunc('month', now());
$$;

create or replace function public.workspace_events_this_month(p_workspace uuid)
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
    and not p.demo
    and ev.created_at >= date_trunc('month', now());
$$;

-- Create the demo project in a workspace the caller belongs to. Returns its id and the
-- live experiment's id (to open its results). Deterministic, so every demo looks alike.
create function public.create_demo_project(p_workspace uuid)
returns table (demo_project_id uuid, demo_experiment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_book uuid;
  v_purchase uuid;
  v_lcp uuid;
  v_segment uuid;
  v_live uuid;
  v_ended uuid;
  v_draft uuid;
  v_visitors integer := 4000;
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'Not a member of this workspace.';
  end if;
  perform setseed(0.42);

  insert into public.projects (workspace_id, name, main_domain, installed_at, demo)
  values (p_workspace, 'Demo: Trip Shop', 'demo.splitcraft.dev', now() - interval '15 days', true)
  returning id into v_project;

  insert into public.metrics (project_id, name, event_key, source, source_config, measure, measure_config)
  values (v_project, 'Book click', 'book_click', 'click', '{"selector": ".book-now-btn"}', 'unique',
          '{"direction": "increase", "windowDays": 7}')
  returning id into v_book;
  insert into public.metrics (project_id, name, event_key, source, source_config, measure, measure_config)
  values (v_project, 'Revenue', 'purchase', 'transaction', '{}', 'sum',
          '{"direction": "increase", "windowDays": 7}')
  returning id into v_purchase;
  insert into public.metrics (project_id, name, event_key, source, source_config, measure, measure_config)
  values (v_project, 'LCP', 'vitals.lcp', 'web_vitals', '{"vital": "lcp"}', 'value_per_conversion',
          '{"direction": "decrease", "windowDays": 7}')
  returning id into v_lcp;

  insert into public.segments (project_id, name, rules)
  values (v_project, 'Mobile visitors',
          '{"mode": "all", "items": [{"mode": "all", "items": [{"type": "device_type", "value": ["mobile"]}]}]}')
  returning id into v_segment;

  insert into public.experiments
    (project_id, key, name, hypothesis, status, targeting, primary_metric_id, planned_sample,
     plan, started_at, preview_url)
  values
    (v_project, 'sticky-book-bar', 'Sticky Book Now bar',
     'On mobile the Book button scrolls out of view. Keeping it in a sticky bar will increase book clicks.',
     'live', '{"where": {"include": [{"op": "matches", "value": "/trips/*"}]}}', v_book, 2400,
     '{"baseline": 0.05, "mde": 0.2}', now() - interval '14 days', 'https://demo.splitcraft.dev/trips/norway')
  returning id into v_live;
  insert into public.experiments
    (project_id, key, name, hypothesis, status, targeting, primary_metric_id, started_at, ended_at)
  values
    (v_project, 'urgency-banner', 'Urgency banner: "3 spots left"',
     'Scarcity will push undecided visitors to book.', 'ended', '{}', v_book,
     now() - interval '30 days', now() - interval '16 days')
  returning id into v_ended;
  insert into public.experiments
    (project_id, key, name, hypothesis, status, targeting, primary_metric_id)
  values
    (v_project, 'trust-badges', 'Trust badges under Book button',
     'Showing free cancellation and secure payment under Book will reduce hesitation.', 'draft',
     jsonb_build_object('who', jsonb_build_object('mode', 'any', 'segmentIds', jsonb_build_array(v_segment))),
     v_book)
  returning id into v_draft;

  insert into public.variants (experiment_id, key, name, weight, js, css) values
    (v_live, 'control', 'Control', 50, '', ''),
    (v_live, 'b', 'Sticky bar', 50,
     E'splitcraft.waitForElement(''.book-now-btn'', (btn) => {\n  const bar = document.createElement(''div'');\n  bar.className = ''sc-sticky-bar'';\n  bar.appendChild(btn.cloneNode(true));\n  document.body.appendChild(bar);\n});',
     '.sc-sticky-bar { position: fixed; inset: auto 0 0 0; padding: 12px 16px; background: #fff; }'),
    (v_ended, 'control', 'Control', 50, '', ''),
    (v_ended, 'b', 'Urgency banner', 50,
     E'splitcraft.waitForElement(''.price'', (el) => el.insertAdjacentHTML(''afterend'', ''<p class="sc-urgency">Only 3 spots left</p>''));',
     '.sc-urgency { color: #b3261e; font-weight: 600; }'),
    (v_draft, 'control', 'Control', 50, '', ''),
    (v_draft, 'b', 'Trust badges', 50,
     E'splitcraft.waitForElement(''.book-now-btn'', (btn) => {\n  btn.insertAdjacentHTML(''afterend'', ''<p class="sc-trust">Free cancellation · Secure payment</p>'');\n});',
     '.sc-trust { font-size: 13px; color: #0f6b57; }');

  insert into public.experiment_metrics (experiment_id, metric_id, role, "limit") values
    (v_live, v_purchase, 'secondary', null),
    (v_live, v_lcp, 'guardrail', '{"maxPct": 10}');

  -- Visitors of the live test: first page view (ping), exposure, and goals.
  create temporary table demo_visitors on commit drop as
  select
    i,
    'demo_' || lpad(i::text, 6, '0') as visitor,
    case when i % 2 = 0 then 'control' else 'b' end as variant,
    now() - (random() * interval '14 days') as at,
    (array['mobile', 'mobile', 'mobile', 'desktop', 'tablet'])[1 + floor(random() * 5)::int] as device,
    (array['organic', 'paid', 'direct', 'email', 'social'])[1 + floor(random() * 5)::int] as source,
    random() as r1,
    random() as r2
  from generate_series(1, v_visitors) as i;

  insert into public.events (project_id, visitor_id, type, props, url, created_at)
  select v_project, visitor, 'ping',
         jsonb_build_object('d', device, 'w', case device when 'mobile' then 390 when 'tablet' then 820 else 1440 end,
                            's', source, 'n', 1 + (i % 3)),
         'https://demo.splitcraft.dev/trips/norway', at - interval '1 second'
  from demo_visitors;

  insert into public.events (project_id, visitor_id, experiment_id, type, variant_key, url, created_at)
  select v_project, visitor, v_live, 'exposure', variant, 'https://demo.splitcraft.dev/trips/norway', at
  from demo_visitors;

  -- Book click: 5.0% control, 6.1% sticky bar (a bigger lift on mobile).
  insert into public.events (project_id, visitor_id, type, key, url, created_at)
  select v_project, visitor, 'goal', 'book_click', 'https://demo.splitcraft.dev/trips/norway',
         at + interval '2 minutes'
  from demo_visitors
  where r1 < case
    when variant = 'control' then 0.05
    when device = 'mobile' then 0.068
    else 0.05
  end;

  -- Revenue from about a third of bookers.
  insert into public.events (project_id, visitor_id, type, key, value, url, created_at)
  select v_project, visitor, 'goal', 'purchase', round((8000 + r2 * 14000)::numeric, 0),
         'https://demo.splitcraft.dev/checkout/done', at + interval '6 minutes'
  from demo_visitors
  where r1 < case when variant = 'control' then 0.016 else 0.019 end;

  -- LCP per visitor (ms): the sticky bar costs a little.
  insert into public.events (project_id, visitor_id, type, key, value, url, created_at)
  select v_project, visitor, 'goal', 'vitals.lcp',
         round((1700 + r2 * 900 + case when variant = 'b' then 60 else 0 end)::numeric, 0),
         'https://demo.splitcraft.dev/trips/norway', at + interval '5 seconds'
  from demo_visitors;

  -- The ended test: a clear loser.
  insert into public.events (project_id, visitor_id, experiment_id, type, variant_key, url, created_at)
  select v_project, 'demo_u' || i, v_ended, 'exposure', case when i % 2 = 0 then 'control' else 'b' end,
         'https://demo.splitcraft.dev/trips/iceland', now() - interval '30 days' + (i * interval '1 minute')
  from generate_series(1, 3000) as i;
  insert into public.events (project_id, visitor_id, type, key, url, created_at)
  select v_project, 'demo_u' || i, 'goal', 'book_click', 'https://demo.splitcraft.dev/trips/iceland',
         now() - interval '30 days' + (i * interval '1 minute') + interval '3 minutes'
  from generate_series(1, 3000) as i
  where random() < case when i % 2 = 0 then 0.055 else 0.041 end;

  return query select v_project, v_live;
end;
$$;

revoke all on function public.create_demo_project(uuid) from public, anon;
grant execute on function public.create_demo_project(uuid) to authenticated;
