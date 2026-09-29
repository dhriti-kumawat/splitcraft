import type {
  DataApi,
  Experiment,
  ExperimentGoal,
  Metric,
  NewProject,
  Project,
  ProjectStats,
  Segment,
  VariantStats,
  Workspace,
} from '../data/api';

export const WORKSPACE: Workspace = {
  id: 'ws_1',
  name: "Dhriti's Workspace",
  plan: 'free',
  role: 'owner',
};

const project = (p: Partial<Project> & Pick<Project, 'id' | 'name' | 'mainDomain'>): Project => ({
  workspaceId: WORKSPACE.id,
  allowedDomains: [],
  publicKey: `prj_${p.id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)}`,
  installedAt: '2026-09-01T10:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
  ...p,
});

// Matches the designs (10-projects.html), as test data.
export const PROJECTS: Project[] = [
  project({
    id: 'trip-demo',
    name: 'Trip Demo',
    mainDomain: 'mytrips.dev',
    allowedDomains: ['staging.mytrips.dev', 'localhost:5173'],
  }),
  project({
    id: 'checkout-lab',
    name: 'Checkout Lab',
    mainDomain: 'shoplab.dev',
    allowedDomains: ['*.vercel.app'],
  }),
  project({ id: 'portfolio', name: 'Portfolio', mainDomain: 'dhriti.dev', installedAt: null }),
];

export const STATS: ProjectStats[] = [
  {
    projectId: 'trip-demo',
    liveTests: 2,
    visitors30d: 56_400,
    dailyVisitors: Array.from({ length: 30 }, (_, i) => 1500 + i * 20),
  },
  {
    projectId: 'checkout-lab',
    liveTests: 1,
    visitors30d: 8_200,
    dailyVisitors: Array(30).fill(270),
  },
  { projectId: 'portfolio', liveTests: 0, visitors30d: 0, dailyVisitors: Array(30).fill(0) },
];

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const variants = (id: string) => [
  { id: `${id}-b`, key: 'b', name: 'B', weight: 50, js: '', css: '', version: 1 },
  { id: `${id}-c`, key: 'control', name: 'Control', weight: 50, js: '', css: '', version: 1 },
];
const experiment = (
  e: Partial<Experiment> & Pick<Experiment, 'id' | 'name' | 'status'>,
): Experiment => ({
  projectId: 'trip-demo',
  key: e.id,
  hypothesis: '',
  trafficPct: 100,
  targeting: {},
  primaryMetricId: 'm-book',
  primaryMetricName: 'Book click',
  plannedSample: null,
  plan: {},
  startedAt: null,
  endedAt: null,
  createdAt: daysAgo(30),
  variants: variants(e.id),
  ...e,
});

// The five experiments from 11-experiments-list.html, as test data.
export const EXPERIMENTS: Experiment[] = [
  experiment({
    id: 'sticky',
    name: 'Sticky Book Now bar',
    status: 'live',
    startedAt: daysAgo(14),
    plannedSample: 13_500,
    targeting: {
      where: { include: [{ op: 'matches', value: '/trips/*' }] },
      how: [{ mode: 'all', items: [{ type: 'device_type', value: ['mobile'] }] }],
    },
  }),
  experiment({
    id: 'hero',
    name: 'Hero headline: price-led',
    status: 'live',
    startedAt: daysAgo(9),
    primaryMetricName: 'Search started',
    targeting: {
      who: { mode: 'any', segmentIds: ['seg-returners'] },
      where: { include: [{ op: 'is', value: '/' }] },
    },
  }),
  experiment({ id: 'trust', name: 'Trust badges under Book button', status: 'draft' }),
  experiment({
    id: 'price',
    name: 'Price summary in checkout',
    status: 'paused',
    startedAt: daysAgo(4),
    primaryMetricName: 'Purchase',
  }),
  experiment({
    id: 'urgency',
    name: 'Urgency banner: “3 spots left”',
    status: 'ended',
    startedAt: daysAgo(30),
    endedAt: daysAgo(9),
  }),
];

// Sticky uses the PRODUCT_SPEC §6 worked example.
export const EXPERIMENT_STATS: VariantStats[] = [
  {
    experimentId: 'sticky',
    variantKey: 'control',
    visitors: 12_480,
    conversions: 622,
    visitors7d: 6_300,
  },
  {
    experimentId: 'sticky',
    variantKey: 'b',
    visitors: 12_380,
    conversions: 677,
    visitors7d: 6_250,
  },
  {
    experimentId: 'hero',
    variantKey: 'control',
    visitors: 4_460,
    conversions: 446,
    visitors7d: 3_400,
  },
  { experimentId: 'hero', variantKey: 'b', visitors: 4_441, conversions: 448, visitors7d: 3_400 },
  { experimentId: 'price', variantKey: 'control', visitors: 1_570, conversions: 80, visitors7d: 0 },
  { experimentId: 'price', variantKey: 'b', visitors: 1_552, conversions: 78, visitors7d: 0 },
  // −2.3% with about a 7% chance to win, as in the design.
  {
    experimentId: 'urgency',
    variantKey: 'control',
    visitors: 20_640,
    conversions: 5_910,
    visitors7d: 0,
  },
  { experimentId: 'urgency', variantKey: 'b', visitors: 20_648, conversions: 5_776, visitors7d: 0 },
];

const metric = (
  m: Partial<Metric> & Pick<Metric, 'id' | 'name' | 'eventKey' | 'source'>,
): Metric => ({
  projectId: 'trip-demo',
  sourceConfig: {},
  measure: 'unique',
  measureConfig: {},
  ...m,
});

export const METRICS: Metric[] = [
  metric({
    id: 'm-book',
    name: 'Book click',
    eventKey: 'book_click',
    source: 'click',
    sourceConfig: { selector: '.book-now-btn' },
  }),
  metric({
    id: 'm-purchase',
    name: 'Purchase',
    eventKey: 'purchase',
    source: 'transaction',
    measure: 'sum',
  }),
  metric({
    id: 'm-search',
    name: 'Search started',
    eventKey: 'search_started',
    source: 'custom_js',
  }),
  metric({
    id: 'm-confirm',
    name: 'Confirmation page',
    eventKey: 'confirmation',
    source: 'pageview',
    sourceConfig: { url: { op: 'is', value: '/checkout/done' } },
  }),
];

export const GOALS: Record<string, ExperimentGoal[]> = {
  sticky: [
    { role: 'secondary', limit: null, metric: METRICS[3]! },
    { role: 'guardrail', limit: { direction: 'decrease', maxPct: 2 }, metric: METRICS[1]! },
  ],
};

export const SEGMENTS: Segment[] = [
  {
    id: 'seg-returners',
    projectId: 'trip-demo',
    name: 'High-intent returners',
    updatedAt: daysAgo(1),
    rules: {
      mode: 'all',
      items: [
        { mode: 'all', items: [{ type: 'visitor_type', value: 'returning' }] },
        {
          mode: 'any',
          items: [
            {
              type: 'page_views_matching',
              url: { op: 'matches', value: '/trips/*' },
              count: 3,
              days: 7,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'seg-mobile',
    projectId: 'trip-demo',
    name: 'Mobile first-timers',
    updatedAt: daysAgo(3),
    rules: {
      mode: 'all',
      items: [
        { type: 'device_type', value: ['mobile'] },
        { type: 'visitor_type', value: 'new' },
      ],
    },
  },
];

/** In-memory DataApi seeded with the design's projects. */
export function fakeData(
  opts: {
    projects?: Project[];
    workspaces?: Workspace[];
    experiments?: Experiment[];
    stats?: VariantStats[];
    lastEventAt?: string | null;
    segments?: Segment[];
  } = {},
) {
  const projects = [...(opts.projects ?? PROJECTS)];
  const experiments = (opts.experiments ?? EXPERIMENTS).map((e) => ({
    ...e,
    variants: e.variants.map((v) => ({ ...v })),
  }));
  const patches: Array<{ id: string; patch: unknown }> = [];
  const variantPatches: Array<{ id: string; patch: unknown }> = [];
  let metrics = METRICS.map((m) => ({ ...m }));
  let segments = (opts.segments ?? SEGMENTS).map((x) => ({ ...x }));
  const versions: Record<
    string,
    Array<{ id: string; js: string; css: string; note: string; createdAt: string }>
  > = {};
  const createdExperiments: string[] = [];
  const created: NewProject[] = [];
  let installNext = false;

  const api: DataApi = {
    listWorkspaces: async () => opts.workspaces ?? [WORKSPACE],
    listProjects: async (ws) => projects.filter((p) => p.workspaceId === ws).map((p) => ({ ...p })),
    getProject: async (id) => {
      const p = projects.find((x) => x.id === id) ?? null;
      if (p && installNext) p.installedAt = '2026-09-29T12:00:00Z';
      // Copies, like a real API: callers must never share our objects.
      return p && { ...p };
    },
    projectOverview: async () => STATS,
    eventsThisMonth: async () => 48_210,
    async createProject(input) {
      created.push(input);
      const p = project({
        id: `new-${created.length}`,
        name: input.name,
        mainDomain: input.mainDomain,
        allowedDomains: input.allowedDomains,
        installedAt: null,
      });
      projects.push(p);
      return p;
    },
    listExperiments: async (projectId) =>
      experiments.filter((e) => e.projectId === projectId).map((e) => ({ ...e })),
    experimentStats: async () => opts.stats ?? EXPERIMENT_STATS,
    lastEventAt: async () =>
      opts.lastEventAt === undefined
        ? new Date(Date.now() - 2 * 60_000).toISOString()
        : opts.lastEventAt,
    getExperiment: async (id) => {
      const e = experiments.find((x) => x.id === id);
      return e ? { ...e, variants: e.variants.map((v) => ({ ...v })) } : null;
    },
    async updateExperiment(id, patch) {
      patches.push({ id, patch });
      const e = experiments.find((x) => x.id === id)!;
      Object.assign(e, patch);
      return { ...e, variants: e.variants.map((v) => ({ ...v })) };
    },
    async updateVariant(id, patch) {
      variantPatches.push({ id, patch });
      for (const e of experiments) {
        const v = e.variants.find((x) => x.id === id);
        if (!v) continue;
        // Like the database trigger: keep the old code as a version.
        if (
          (patch.js !== undefined && patch.js !== v.js) ||
          (patch.css !== undefined && patch.css !== v.css)
        ) {
          (versions[id] ??= []).unshift({
            id: `${id}-v${v.version}`,
            js: v.js,
            css: v.css,
            note: '',
            createdAt: daysAgo(0),
          });
          v.version += 1;
        }
        Object.assign(v, patch);
      }
    },
    listVariantVersions: async (id) => versions[id] ?? [],
    async addVariant(experimentId, variant) {
      const e = experiments.find((x) => x.id === experimentId)!;
      e.variants.push({
        id: `${experimentId}-${variant.key}`,
        js: '',
        css: '',
        version: 1,
        ...variant,
      });
      e.variants.sort((a, b) => a.key.localeCompare(b.key));
    },
    async deleteVariant(id) {
      for (const e of experiments) e.variants = e.variants.filter((v) => v.id !== id);
    },
    listSegments: async (projectId) =>
      segments.filter((x) => x.projectId === projectId).map((x) => ({ ...x })),
    async createSegment(projectId, name, rules) {
      const seg = {
        id: `seg-${segments.length + 1}`,
        projectId,
        name,
        rules,
        updatedAt: daysAgo(0),
      };
      segments.push(seg);
      return { ...seg };
    },
    async updateSegment(id, patch) {
      const seg = segments.find((x) => x.id === id)!;
      if (patch.name !== undefined) seg.name = patch.name;
      if (patch.rules !== undefined) seg.rules = patch.rules;
      return { ...seg };
    },
    async deleteSegment(id) {
      segments = segments.filter((x) => x.id !== id);
    },
    listMetrics: async (projectId) =>
      metrics.filter((m) => m.projectId === projectId).map((m) => ({ ...m })),
    async createMetric(m) {
      if (metrics.some((x) => x.projectId === m.projectId && x.eventKey === m.eventKey)) {
        throw new Error(`The event key "${m.eventKey}" is already used by another metric.`);
      }
      const created = { ...m, id: `m-new-${metrics.length}` };
      metrics.push(created);
      return { ...created };
    },
    async updateMetric(id, patch) {
      const m = metrics.find((x) => x.id === id)!;
      Object.assign(m, patch);
      return { ...m };
    },
    async deleteMetric(id) {
      metrics = metrics.filter((x) => x.id !== id);
    },
    experimentGoals: async (id) => GOALS[id] ?? [],
    async createExperiment(projectId, name) {
      createdExperiments.push(name);
      const e = experiment({
        id: `exp-${createdExperiments.length}`,
        name,
        status: 'draft',
        projectId,
        primaryMetricId: null,
        primaryMetricName: null,
      });
      experiments.unshift(e);
      return e;
    },
  };
  return {
    api,
    created,
    createdExperiments,
    patches,
    variantPatches,
    segmentsNow: () => segments,
    metricsNow: () => metrics,
    /** Make the next status poll report the first ping. */
    receiveFirstPing() {
      installNext = true;
    },
  };
}
