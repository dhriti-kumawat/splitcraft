import type { ConditionGroup, StoredTargeting } from '../lib/targeting';

export type Role = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  /** The signed-in user's role in this workspace. */
  role: Role;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  mainDomain: string;
  allowedDomains: string[];
  /** `prj_…`: goes in the snippet. Public by design. */
  publicKey: string;
  /** When the SDK sent its first event; null means "Waiting for first ping". */
  installedAt: string | null;
  createdAt: string;
}

export interface ProjectStats {
  projectId: string;
  liveTests: number;
  visitors30d: number;
  /** Unique visitors per day, oldest first, 30 entries. */
  dailyVisitors: number[];
}

export interface NewProject {
  workspaceId: string;
  name: string;
  mainDomain: string;
  allowedDomains: string[];
}

export type ExperimentStatus = 'draft' | 'live' | 'paused' | 'ended';

export interface Variant {
  id: string;
  key: string;
  name: string;
  weight: number;
  js: string;
  css: string;
  version: number;
}

export interface Experiment {
  id: string;
  projectId: string;
  key: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  trafficPct: number;
  targeting: StoredTargeting;
  primaryMetricId: string | null;
  primaryMetricName: string | null;
  plannedSample: number | null;
  /** Sample-size planner inputs, as fractions. */
  plan: { baseline?: number; mde?: number };
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  /** Ordered by key, like the SDK config. */
  variants: Variant[];
}

export interface VariantStats {
  experimentId: string;
  variantKey: string;
  visitors: number;
  conversions: number;
  /** Visitors first exposed in the last 7 days. */
  visitors7d: number;
}

export type ExperimentPatch = Partial<
  Pick<
    Experiment,
    | 'name'
    | 'hypothesis'
    | 'status'
    | 'trafficPct'
    | 'targeting'
    | 'primaryMetricId'
    | 'plannedSample'
    | 'plan'
    | 'startedAt'
    | 'endedAt'
  >
>;

export type VariantPatch = Partial<Pick<Variant, 'name' | 'weight' | 'js' | 'css'>>;

export interface VariantVersion {
  id: string;
  js: string;
  css: string;
  note: string;
  createdAt: string;
}

export interface Segment {
  id: string;
  projectId: string;
  name: string;
  /** One ALL group whose items are the builder's groups. */
  rules: ConditionGroup;
  updatedAt: string;
}

export interface Metric {
  id: string;
  projectId: string;
  name: string;
  eventKey: string;
  source: 'click' | 'pageview' | 'custom_js' | 'datalayer' | 'transaction';
  sourceConfig: Record<string, unknown>;
  measure: 'unique' | 'total' | 'sum' | 'value_per_conversion';
  measureConfig: Record<string, unknown>;
}

/** A guardrail: the metric must not move the wrong way by more than `maxPct` percent. */
export interface GuardrailLimit {
  maxPct: number;
}

export interface ExperimentGoal {
  metric: Metric;
  role: 'secondary' | 'guardrail';
  limit: GuardrailLimit | null;
}

/** Monthly event allowance per plan. Only the free plan exists in v1. */
export const EVENT_LIMIT: Record<Workspace['plan'], number | null> = {
  free: 100_000,
  pro: null,
};

/** Everything the dashboard reads and writes. Supabase implements it; tests use a fake. */
export interface DataApi {
  listWorkspaces(userId: string): Promise<Workspace[]>;
  listProjects(workspaceId: string): Promise<Project[]>;
  getProject(projectId: string): Promise<Project | null>;
  projectOverview(workspaceId: string): Promise<ProjectStats[]>;
  eventsThisMonth(workspaceId: string): Promise<number>;
  createProject(project: NewProject): Promise<Project>;
  listExperiments(projectId: string): Promise<Experiment[]>;
  experimentStats(projectId: string): Promise<VariantStats[]>;
  /** Time of the project's most recent event, or null if it never sent one. */
  lastEventAt(projectId: string): Promise<string | null>;
  /** Creates a draft with Control and B at 50/50. */
  createExperiment(projectId: string, name: string): Promise<Experiment>;
  getExperiment(experimentId: string): Promise<Experiment | null>;
  updateExperiment(experimentId: string, patch: ExperimentPatch): Promise<Experiment>;
  updateVariant(variantId: string, patch: VariantPatch): Promise<void>;
  /** Earlier code of a variant, newest first. The current code is on the variant. */
  listVariantVersions(variantId: string): Promise<VariantVersion[]>;
  addVariant(
    experimentId: string,
    variant: { key: string; name: string; weight: number },
  ): Promise<void>;
  deleteVariant(variantId: string): Promise<void>;
  listMetrics(projectId: string): Promise<Metric[]>;
  createMetric(metric: Omit<Metric, 'id'>): Promise<Metric>;
  updateMetric(metricId: string, patch: Partial<Omit<Metric, 'id' | 'projectId'>>): Promise<Metric>;
  deleteMetric(metricId: string): Promise<void>;
  listSegments(projectId: string): Promise<Segment[]>;
  createSegment(projectId: string, name: string, rules: ConditionGroup): Promise<Segment>;
  updateSegment(
    segmentId: string,
    patch: { name?: string; rules?: ConditionGroup },
  ): Promise<Segment>;
  deleteSegment(segmentId: string): Promise<void>;
  /** Secondary goals and guardrails (the primary goal is on the experiment). */
  experimentGoals(experimentId: string): Promise<ExperimentGoal[]>;
  /** Add or update a secondary goal or guardrail. */
  setExperimentGoal(
    experimentId: string,
    metricId: string,
    role: ExperimentGoal['role'],
    limit: GuardrailLimit | null,
  ): Promise<void>;
  removeExperimentGoal(experimentId: string, metricId: string): Promise<void>;
}
