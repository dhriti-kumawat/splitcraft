import type { ConditionGroup, StoredTargeting, WhereRules } from '../lib/targeting';

export type Role = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  /** The signed-in user's role in this workspace. */
  role: Role;
}

export interface Person {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  joinedAt: string;
}

export interface Invite {
  id: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface InviteDetails {
  workspaceName: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  expired: boolean;
  accepted: boolean;
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

export type ActivityKind =
  | 'project_created'
  | 'project_installed'
  | 'experiment_created'
  | 'experiment_launched'
  | 'experiment_ended'
  | 'experiment_archived'
  | 'segment_created'
  | 'segment_updated'
  | 'metric_created';

/** One line in Recent activity: the latest change to a project, experiment, segment or metric. */
export interface ActivityItem {
  kind: ActivityKind;
  projectId: string;
  projectName: string;
  subjectId: string;
  subject: string;
  at: string;
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
  /** Archived experiments are stopped and hidden from the list's usual filters. */
  archivedAt: string | null;
  createdAt: string;
  /** Control first, then by key. */
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
    | 'archivedAt'
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

/** What each kind of saved targeting stores: triggers are visit conditions, page sets WHERE rules. */
export interface SavedRules {
  triggers: ConditionGroup;
  page_sets: WhereRules;
}
export type SavedKind = keyof SavedRules;

/** A saved trigger or page set: reusable in any experiment's targeting (inserted as a copy). */
export interface Saved<K extends SavedKind> {
  id: string;
  projectId: string;
  name: string;
  rules: SavedRules[K];
  updatedAt: string;
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
  measure: 'unique' | 'total' | 'sum' | 'value_per_conversion' | 'ctr' | 'time_to_click';
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

/** Raw counts for one metric and variant (experiment_results). */
export interface MetricArm {
  metricId: string;
  variantKey: string;
  visitors: number;
  converters: number;
  events: number;
  eventsSumsq: number;
  valueSum: number;
  valueSumsq: number;
  /** Click-through rate only: exposed visitors who saw the tracked element. */
  viewers: number;
}

export interface DailyArm {
  day: string;
  variantKey: string;
  visitors: number;
  converters: number;
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
  createWorkspace(name: string): Promise<string>;
  renameWorkspace(workspaceId: string, name: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  listPeople(workspaceId: string): Promise<Person[]>;
  setRole(workspaceId: string, userId: string, role: Role): Promise<void>;
  /** Remove a member, or leave when it's the signed-in user. */
  removeMember(workspaceId: string, userId: string): Promise<void>;
  listInvites(workspaceId: string): Promise<Invite[]>;
  createInvite(workspaceId: string, email: string, role: Invite['role']): Promise<Invite>;
  revokeInvite(inviteId: string): Promise<void>;
  inviteDetails(token: string): Promise<InviteDetails | null>;
  /** Returns the joined workspace's id. */
  acceptInvite(token: string): Promise<string>;
  getProject(projectId: string): Promise<Project | null>;
  projectOverview(workspaceId: string): Promise<ProjectStats[]>;
  workspaceActivity(workspaceId: string, limit: number): Promise<ActivityItem[]>;
  eventsThisMonth(workspaceId: string): Promise<number>;
  createProject(project: NewProject): Promise<Project>;
  updateProject(
    projectId: string,
    patch: Partial<Pick<Project, 'name' | 'mainDomain' | 'allowedDomains'>>,
  ): Promise<Project>;
  /** Deletes the project with its experiments, audiences, metrics and events. */
  deleteProject(projectId: string): Promise<void>;
  listExperiments(projectId: string): Promise<Experiment[]>;
  experimentStats(projectId: string): Promise<VariantStats[]>;
  /** Time of the project's most recent event, or null if it never sent one. */
  lastEventAt(projectId: string): Promise<string | null>;
  /** Creates a draft with Control and B at 50/50. */
  createExperiment(projectId: string, name: string): Promise<Experiment>;
  getExperiment(experimentId: string): Promise<Experiment | null>;
  updateExperiment(experimentId: string, patch: ExperimentPatch): Promise<Experiment>;
  /** A new draft with the same setup, variant code and goals. */
  duplicateExperiment(experimentId: string): Promise<Experiment>;
  /** Owners and admins only, and not while live. Removes its events too. */
  deleteExperiment(experimentId: string): Promise<void>;
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
  listSaved<K extends SavedKind>(kind: K, projectId: string): Promise<Saved<K>[]>;
  createSaved<K extends SavedKind>(
    kind: K,
    projectId: string,
    name: string,
    rules: SavedRules[K],
  ): Promise<Saved<K>>;
  updateSaved<K extends SavedKind>(
    kind: K,
    id: string,
    patch: { name?: string; rules?: SavedRules[K] },
  ): Promise<Saved<K>>;
  deleteSaved(kind: SavedKind, id: string): Promise<void>;
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
  experimentResults(experimentId: string): Promise<MetricArm[]>;
  experimentDaily(experimentId: string): Promise<DailyArm[]>;
}
