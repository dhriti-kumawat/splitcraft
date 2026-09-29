import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoredTargeting } from '../lib/targeting';
import type {
  DataApi,
  Experiment,
  ExperimentPatch,
  ExperimentStatus,
  Metric,
  Project,
  Variant,
  Workspace,
} from './api';

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  main_domain: string;
  allowed_domains: string[];
  public_key: string;
  installed_at: string | null;
  created_at: string;
}

const PROJECT_COLUMNS =
  'id, workspace_id, name, main_domain, allowed_domains, public_key, installed_at, created_at';

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    mainDomain: row.main_domain,
    allowedDomains: row.allowed_domains ?? [],
    publicKey: row.public_key,
    installedAt: row.installed_at,
    createdAt: row.created_at,
  };
}

interface ExperimentRow {
  id: string;
  project_id: string;
  key: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  traffic_pct: number | string;
  targeting: StoredTargeting | null;
  primary_metric_id: string | null;
  planned_sample: number | null;
  plan: Experiment['plan'] | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  variants: Array<Omit<Variant, 'weight'> & { weight: number | string }> | null;
  primary_metric: { name: string } | null;
}

const EXPERIMENT_COLUMNS =
  '*, variants (id, key, name, weight, js, css, version), primary_metric:metrics!primary_metric_id (name)';

export function toExperiment(row: ExperimentRow): Experiment {
  return {
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    name: row.name,
    hypothesis: row.hypothesis,
    status: row.status,
    trafficPct: Number(row.traffic_pct),
    targeting: row.targeting ?? {},
    primaryMetricId: row.primary_metric_id,
    primaryMetricName: row.primary_metric?.name ?? null,
    plannedSample: row.planned_sample,
    plan: row.plan ?? {},
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    variants: (row.variants ?? [])
      .map((v) => ({ ...v, weight: Number(v.weight) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** "Trust badges under Book button" → "trust-badges-under-book-button". */
export function experimentKey(name: string): string {
  const key = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  return /^[a-z0-9]/.test(key) ? key : `exp-${key || Date.now().toString(36)}`;
}

const PATCH_COLUMNS: Record<keyof ExperimentPatch, string> = {
  name: 'name',
  hypothesis: 'hypothesis',
  status: 'status',
  trafficPct: 'traffic_pct',
  targeting: 'targeting',
  primaryMetricId: 'primary_metric_id',
  plannedSample: 'planned_sample',
  plan: 'plan',
  startedAt: 'started_at',
  endedAt: 'ended_at',
};

interface MetricRow {
  id: string;
  project_id: string;
  name: string;
  event_key: string;
  source: Metric['source'];
  source_config: Record<string, unknown>;
  measure: Metric['measure'];
  measure_config: Record<string, unknown>;
}

const METRIC_COLUMNS =
  'id, project_id, name, event_key, source, source_config, measure, measure_config';

export function toMetric(row: MetricRow): Metric {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    eventKey: row.event_key,
    source: row.source,
    sourceConfig: row.source_config ?? {},
    measure: row.measure,
    measureConfig: row.measure_config ?? {},
  };
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function createSupabaseData(supabase: SupabaseClient): DataApi {
  return {
    async listWorkspaces(userId) {
      const rows = check(
        await supabase
          .from('workspace_members')
          .select('role, workspaces (id, name, plan, created_at)')
          .eq('user_id', userId),
      ) as unknown as Array<{
        role: Workspace['role'];
        workspaces: { id: string; name: string; plan: Workspace['plan']; created_at: string };
      }>;
      return rows
        .filter((r) => r.workspaces)
        .sort((a, b) => a.workspaces.created_at.localeCompare(b.workspaces.created_at))
        .map((r) => ({ ...r.workspaces, role: r.role }));
    },

    async listProjects(workspaceId) {
      const rows = check(
        await supabase
          .from('projects')
          .select(PROJECT_COLUMNS)
          .eq('workspace_id', workspaceId)
          .order('created_at'),
      ) as ProjectRow[];
      return rows.map(toProject);
    },

    async getProject(projectId) {
      const row = check(
        await supabase.from('projects').select(PROJECT_COLUMNS).eq('id', projectId).maybeSingle(),
      ) as ProjectRow | null;
      return row && toProject(row);
    },

    async projectOverview(workspaceId) {
      const rows = check(
        await supabase.rpc('project_overview', { p_workspace: workspaceId }),
      ) as Array<{
        project_id: string;
        live_tests: number;
        visitors_30d: number;
        daily_visitors: number[];
      }>;
      return rows.map((r) => ({
        projectId: r.project_id,
        liveTests: r.live_tests,
        visitors30d: r.visitors_30d,
        dailyVisitors: r.daily_visitors ?? [],
      }));
    },

    async eventsThisMonth(workspaceId) {
      return check(
        await supabase.rpc('workspace_events_this_month', { p_workspace: workspaceId }),
      ) as number;
    },

    async createProject(p) {
      const row = check(
        await supabase
          .from('projects')
          .insert({
            workspace_id: p.workspaceId,
            name: p.name,
            main_domain: p.mainDomain,
            allowed_domains: p.allowedDomains,
          })
          .select(PROJECT_COLUMNS)
          .single(),
      ) as ProjectRow;
      return toProject(row);
    },

    async listExperiments(projectId) {
      const rows = check(
        await supabase
          .from('experiments')
          .select(EXPERIMENT_COLUMNS)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ) as unknown as ExperimentRow[];
      return rows.map(toExperiment);
    },

    async experimentStats(projectId) {
      const rows = check(
        await supabase.rpc('experiment_stats', { p_project: projectId }),
      ) as Array<{
        experiment_id: string;
        variant_key: string;
        visitors: number;
        conversions: number;
        visitors_7d: number;
      }>;
      return rows.map((r) => ({
        experimentId: r.experiment_id,
        variantKey: r.variant_key,
        visitors: r.visitors,
        conversions: r.conversions,
        visitors7d: r.visitors_7d,
      }));
    },

    async lastEventAt(projectId) {
      const rows = check(
        await supabase
          .from('events')
          .select('created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1),
      ) as Array<{ created_at: string }>;
      return rows[0]?.created_at ?? null;
    },

    async createExperiment(projectId, name) {
      const base = experimentKey(name);
      // Keys are unique per project; add -2, -3… on a clash.
      for (let attempt = 1; attempt <= 20; attempt++) {
        const key = attempt === 1 ? base : `${base}-${attempt}`;
        const { data, error } = await supabase
          .from('experiments')
          .insert({ project_id: projectId, key, name })
          .select('id')
          .single();
        if (error?.code === '23505') continue;
        if (error) throw new Error(error.message);
        const id = (data as { id: string }).id;
        check(
          await supabase.from('variants').insert([
            { experiment_id: id, key: 'control', name: 'Control', weight: 50 },
            { experiment_id: id, key: 'b', name: 'B', weight: 50 },
          ]),
        );
        const row = check(
          await supabase.from('experiments').select(EXPERIMENT_COLUMNS).eq('id', id).single(),
        ) as unknown as ExperimentRow;
        return toExperiment(row);
      }
      throw new Error('Could not find a free experiment key. Try a different name.');
    },

    async getExperiment(experimentId) {
      const row = check(
        await supabase
          .from('experiments')
          .select(EXPERIMENT_COLUMNS)
          .eq('id', experimentId)
          .maybeSingle(),
      ) as unknown as ExperimentRow | null;
      return row && toExperiment(row);
    },

    async updateExperiment(experimentId, patch) {
      const update: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        update[PATCH_COLUMNS[key as keyof ExperimentPatch]] = value;
      }
      const row = check(
        await supabase
          .from('experiments')
          .update(update)
          .eq('id', experimentId)
          .select(EXPERIMENT_COLUMNS)
          .single(),
      ) as unknown as ExperimentRow;
      return toExperiment(row);
    },

    async updateVariant(variantId, patch) {
      check(await supabase.from('variants').update(patch).eq('id', variantId));
    },

    async listMetrics(projectId) {
      const rows = check(
        await supabase
          .from('metrics')
          .select(METRIC_COLUMNS)
          .eq('project_id', projectId)
          .order('name'),
      ) as MetricRow[];
      return rows.map(toMetric);
    },

    async experimentGoals(experimentId) {
      const rows = check(
        await supabase
          .from('experiment_metrics')
          .select(`role, limit, metrics (${METRIC_COLUMNS})`)
          .eq('experiment_id', experimentId),
      ) as unknown as Array<{
        role: 'secondary' | 'guardrail';
        limit: Record<string, unknown> | null;
        metrics: MetricRow;
      }>;
      return rows.map((r) => ({ role: r.role, limit: r.limit, metric: toMetric(r.metrics) }));
    },
  };
}
