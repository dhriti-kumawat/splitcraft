import type {
  ConditionGroup,
  DeviceType,
  SourceType,
  StoredTargeting,
  UtmParam,
  WhereRules,
} from '../lib/targeting';

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
  settings: ProjectSettings;
  /** Sample project from "Try with demo data"; its events don't count toward the allowance. */
  demo: boolean;
}

/** SDK switches per project (10-projects.html). All on by default. */
export interface ProjectSettings {
  /** Hide the page until variants apply (max 400 ms). Set on the snippet. */
  antiFlicker: boolean;
  /** Re-check targeting on every route change of a single-page app. */
  spa: boolean;
  /** Push exposures and events to window.dataLayer for GTM / GA4. */
  ga4: boolean;
  /** Offer a preview bookmark that loads the SDK on pages without the snippet. Default off. */
  previewAnywhere: boolean;
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

/** One session's SDK ping: the traits reach estimates can check (see lib/reach.ts). */
export interface SessionPing {
  /** The page the session started on. */
  url: string;
  props: {
    d: DeviceType;
    w: number;
    s: SourceType;
    n: number;
    uf?: Partial<Record<UtmParam, string>>;
    ul?: Partial<Record<UtmParam, string>>;
    c?: string;
  };
}

/** A random sample of the last 30 days' sessions, and how many there were over how many days. */
export interface SessionSample {
  sessions: number;
  days: number;
  sample: SessionPing[];
}

export interface NewProject {
  workspaceId: string;
  name: string;
  mainDomain: string;
  allowedDomains: string[];
}

export type ExperimentStatus = 'draft' | 'live' | 'paused' | 'ended';

/** A/B: code changes on one page. Split URL: each variant is its own page. MVT: every combination of section versions. */
export type ExperimentType = 'ab' | 'split_url' | 'mvt';

/** One version of an MVT section. The first version of each section is the original (no code). */
export interface MvtLevel {
  key: string;
  name: string;
  js: string;
  css: string;
}

/** An MVT section (factor), e.g. "Headline", with its versions. */
export interface MvtFactor {
  key: string;
  name: string;
  levels: MvtLevel[];
}

export interface Variant {
  id: string;
  key: string;
  name: string;
  weight: number;
  js: string;
  css: string;
  /** Split URL tests: the page this variant sends visitors to. Null for Control. */
  url: string | null;
  version: number;
}

export interface Experiment {
  id: string;
  projectId: string;
  key: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  type: ExperimentType;
  /** MVT sections; empty for other types. Variants are generated from them. */
  factors: MvtFactor[];
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
  /** The page it runs on, opened by "Preview on site". Null: the home page. */
  previewUrl: string | null;
  /** Secret that lets a preview link load this experiment even before launch. */
  previewToken: string;
  /** Set when a crossed guardrail paused it automatically (it isn't paused again after). */
  autoPaused: AutoPause | null;
  createdAt: string;
  /** Control first, then by key. */
  variants: Variant[];
}

export interface AutoPause {
  at: string;
  metricId: string;
  variantKey: string;
  uplift: number;
  upliftLow: number;
  upliftHigh: number;
  maxPct: number;
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
    | 'previewUrl'
    | 'factors'
  >
>;

export type VariantPatch = Partial<Pick<Variant, 'name' | 'weight' | 'js' | 'css' | 'url'>>;

export type NewVariant = Pick<Variant, 'key' | 'name' | 'weight' | 'js' | 'css'>;

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
  source:
    'click' | 'pageview' | 'custom_js' | 'datalayer' | 'transaction' | 'browsing' | 'web_vitals';
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

/** Primary-goal conversions per segment (device or traffic source) and variant. */
export interface BreakdownRow {
  segment: string;
  variantKey: string;
  visitors: number;
  converters: number;
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

/** An experiment idea from a scan of the project's site (see the `suggest` Edge Function). */
export interface ExperimentSuggestion {
  name: string;
  hypothesis: string;
  /** Page it runs on; becomes the preview URL. */
  page: string;
  /** Variant template id from lib/templates.ts. */
  template: string;
}

export interface SiteScan {
  /** 'ai' when Claude picked the suggestions, 'rules' when built-in rules did. */
  source: 'ai' | 'rules';
  pages: Array<{ url: string; title: string; h1: string; ctas: string[]; endpoints: string[] }>;
  suggestions: ExperimentSuggestion[];
}

export type AlertEvent = 'guardrail_paused' | 'sample_reached' | 'winner_found';

/** Where a project sends alerts: a Slack incoming webhook or any HTTPS endpoint. */
export interface ProjectAlert {
  id: string;
  kind: 'slack' | 'webhook';
  url: string;
  events: AlertEvent[];
}

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
  sessionSample(projectId: string): Promise<SessionSample>;
  experimentBreakdown(
    experimentId: string,
    dimension: 'device' | 'source',
  ): Promise<BreakdownRow[]>;
  eventsThisMonth(workspaceId: string): Promise<number>;
  createProject(project: NewProject): Promise<Project>;
  /** "Try with demo data": a sample project with simulated results. */
  createDemoProject(workspaceId: string): Promise<{ projectId: string; experimentId: string }>;
  updateProject(
    projectId: string,
    patch: Partial<Pick<Project, 'name' | 'mainDomain' | 'allowedDomains' | 'settings'>>,
  ): Promise<Project>;
  /** Deletes the project with its experiments, audiences, metrics and events. */
  deleteProject(projectId: string): Promise<void>;
  listExperiments(projectId: string): Promise<Experiment[]>;
  experimentStats(projectId: string): Promise<VariantStats[]>;
  /** Time of the project's most recent event, or null if it never sent one. */
  lastEventAt(projectId: string): Promise<string | null>;
  /** Creates a draft with Control and B at 50/50 (A/B, split URL) or just Control (MVT). */
  createExperiment(projectId: string, name: string, type?: ExperimentType): Promise<Experiment>;
  /** Scans the project's main domain and suggests experiments. Slow: up to ~20 s. */
  suggestExperiments(projectId: string): Promise<SiteScan>;
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
  /**
   * MVT: save the sections and replace the variants with the given combinations.
   * Variants kept by key keep their id (and code history).
   */
  setMvt(experimentId: string, factors: MvtFactor[], variants: NewVariant[]): Promise<void>;
  listMetrics(projectId: string): Promise<Metric[]>;
  createMetric(metric: Omit<Metric, 'id'>): Promise<Metric>;
  updateMetric(metricId: string, patch: Partial<Omit<Metric, 'id' | 'projectId'>>): Promise<Metric>;
  deleteMetric(metricId: string): Promise<void>;
  listSegments(projectId: string): Promise<Segment[]>;
  listAlerts(projectId: string): Promise<ProjectAlert[]>;
  createAlert(projectId: string, alert: Omit<ProjectAlert, 'id'>): Promise<ProjectAlert>;
  deleteAlert(alertId: string): Promise<void>;
  /** Posts a test message to the alert's URL. */
  testAlert(alertId: string): Promise<void>;
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
