-- Splitly data model (PRODUCT_SPEC §10) with Row Level Security.
--
-- Access model:
--   * Dashboard users (role `authenticated`) see and edit only rows of workspaces they belong to.
--   * The SDK never talks to the database directly. The `config` and `events` Edge Functions
--     use the service role on the server; the service role key never reaches a browser.
--   * `anon` gets no access to any table.

-- ---------------------------------------------------------------- workspaces

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  -- Lets the creator read the row back in `insert ... returning`, which is checked
  -- before the trigger below has added them as owner.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------- projects

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  main_domain text not null,
  allowed_domains text[] not null default '{}',
  -- Public, safe to embed in the snippet: identifies the project, grants nothing on its own.
  public_key text not null unique
    default 'prj_' || replace(gen_random_uuid()::text, '-', ''),
  installed_at timestamptz,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index projects_workspace_idx on public.projects (workspace_id);

-- ---------------------------------------------------------------- audiences

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  rules jsonb not null default '{"mode": "all", "items": []}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.triggers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  rules jsonb not null default '{"mode": "all", "items": []}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.page_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  rules jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index segments_project_idx on public.segments (project_id);
create index triggers_project_idx on public.triggers (project_id);
create index page_sets_project_idx on public.page_sets (project_id);

-- ---------------------------------------------------------------- metrics

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  event_key text not null check (event_key ~ '^[A-Za-z0-9_.:-]{1,100}$'),
  source text not null
    check (source in ('click', 'pageview', 'custom_js', 'datalayer', 'transaction')),
  source_config jsonb not null default '{}',
  measure text not null default 'unique'
    check (measure in ('unique', 'total', 'sum', 'value_per_conversion')),
  measure_config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, event_key)
);

-- ---------------------------------------------------------------- experiments

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null,
  hypothesis text not null default '',
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'ended')),
  traffic_pct numeric(5, 2) not null default 100 check (traffic_pct between 0 and 100),
  -- {who: {mode, segmentIds}, where: {include, exclude, elements}, how: [groups], when: {...}}
  targeting jsonb not null default '{}',
  primary_metric_id uuid references public.metrics (id) on delete set null,
  planned_sample integer check (planned_sample > 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

create index experiments_project_status_idx on public.experiments (project_id, status);

create table public.experiment_metrics (
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  metric_id uuid not null references public.metrics (id) on delete cascade,
  role text not null check (role in ('secondary', 'guardrail')),
  "limit" jsonb,
  primary key (experiment_id, metric_id)
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  key text not null check (key ~ '^[A-Za-z0-9_-]{1,32}$'),
  name text not null,
  weight numeric not null default 50 check (weight >= 0),
  js text not null default '',
  css text not null default '',
  version integer not null default 1,
  unique (experiment_id, key)
);

create table public.variant_versions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants (id) on delete cascade,
  js text not null,
  css text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index variant_versions_variant_idx on public.variant_versions (variant_id, created_at desc);

-- ---------------------------------------------------------------- events

create table public.events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id text not null,
  experiment_id uuid references public.experiments (id) on delete cascade,
  variant_key text,
  type text not null check (type in ('exposure', 'goal', 'ping')),
  key text,
  value numeric,
  props jsonb,
  url text,
  created_at timestamptz not null default now()
);

create index events_project_time_idx on public.events (project_id, created_at);
create index events_experiment_visitor_idx on public.events (experiment_id, visitor_id)
  where experiment_id is not null;
create index events_project_visitor_idx on public.events (project_id, visitor_id);

-- ---------------------------------------------------------------- helpers

-- security definer so policies can check membership without recursing into
-- workspace_members' own policy.
create function public.is_workspace_member(ws uuid, roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and (roles is null or m.role = any (roles))
  );
$$;

create function public.can_access_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects pr
    join public.workspace_members m on m.workspace_id = pr.workspace_id
    where pr.id = p and m.user_id = auth.uid()
  );
$$;

create function public.can_access_experiment(e uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.experiments ex
    join public.projects pr on pr.id = ex.project_id
    join public.workspace_members m on m.workspace_id = pr.workspace_id
    where ex.id = e and m.user_id = auth.uid()
  );
$$;

-- The user who creates a workspace becomes its owner.
create function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new.id, auth.uid(), 'owner');
  end if;
  return new;
end;
$$;

create trigger workspaces_add_owner
after insert on public.workspaces
for each row execute function public.add_workspace_owner();

-- Saving variant code keeps the previous code as a version. security definer because
-- users can't insert into variant_versions directly (history is append-only, server-written).
create function public.snapshot_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.js is distinct from old.js or new.css is distinct from old.css then
    insert into public.variant_versions (variant_id, js, css)
    values (old.id, old.js, old.css);
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger variants_snapshot
before update on public.variants
for each row execute function public.snapshot_variant();

-- ---------------------------------------------------------------- row level security

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.segments enable row level security;
alter table public.triggers enable row level security;
alter table public.page_sets enable row level security;
alter table public.metrics enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_metrics enable row level security;
alter table public.variants enable row level security;
alter table public.variant_versions enable row level security;
alter table public.events enable row level security;

-- workspaces
create policy "members read their workspaces" on public.workspaces
  for select to authenticated
  using (created_by = auth.uid() or public.is_workspace_member(id));
create policy "signed-in users create workspaces" on public.workspaces
  for insert to authenticated with check (created_by = auth.uid());
create policy "owners update workspaces" on public.workspaces
  for update to authenticated
  using (public.is_workspace_member(id, array['owner']))
  with check (public.is_workspace_member(id, array['owner']));
create policy "owners delete workspaces" on public.workspaces
  for delete to authenticated using (public.is_workspace_member(id, array['owner']));

-- workspace_members
create policy "members see their teammates" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "owners and admins add members" on public.workspace_members
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id, array['owner', 'admin']));
create policy "owners and admins change members" on public.workspace_members
  for update to authenticated
  using (public.is_workspace_member(workspace_id, array['owner', 'admin']))
  with check (public.is_workspace_member(workspace_id, array['owner', 'admin']));
create policy "owners and admins remove members, anyone can leave" on public.workspace_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id, array['owner', 'admin'])
  );

-- projects
create policy "members manage projects" on public.projects
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- project-scoped tables
create policy "members manage segments" on public.segments
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "members manage triggers" on public.triggers
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "members manage page sets" on public.page_sets
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "members manage metrics" on public.metrics
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "members manage experiments" on public.experiments
  for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

-- experiment-scoped tables
create policy "members manage experiment metrics" on public.experiment_metrics
  for all to authenticated
  using (public.can_access_experiment(experiment_id))
  with check (public.can_access_experiment(experiment_id));
create policy "members manage variants" on public.variants
  for all to authenticated
  using (public.can_access_experiment(experiment_id))
  with check (public.can_access_experiment(experiment_id));
create policy "members read variant versions" on public.variant_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.variants v
      where v.id = variant_id and public.can_access_experiment(v.experiment_id)
    )
  );

-- events: members read; only the events Edge Function (service role) writes.
create policy "members read events" on public.events
  for select to authenticated using (public.can_access_project(project_id));

-- Supabase grants table privileges to anon and authenticated by default.
-- anon never needs direct table access in Splitly, so take it away entirely.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
