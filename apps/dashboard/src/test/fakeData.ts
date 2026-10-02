import type {
  SessionSample,
  Saved,
  SavedKind,
  ActivityItem,
  DailyArm,
  DataApi,
  Invite,
  Person,
  Experiment,
  ExperimentGoal,
  Metric,
  MetricArm,
  NewProject,
  Project,
  ProjectStats,
  Segment,
  VariantStats,
  Workspace,
  SiteScan,
} from '../data/api';

export const WORKSPACE: Workspace = {
  id: 'ws_1',
  name: 'Northwind Travel',
  plan: 'free',
  role: 'owner',
};

const project = (p: Partial<Project> & Pick<Project, 'id' | 'name' | 'mainDomain'>): Project => ({
  workspaceId: WORKSPACE.id,
  allowedDomains: [],
  publicKey: `prj_${p.id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)}`,
  installedAt: '2026-09-01T10:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
  settings: { antiFlicker: true, spa: true, ga4: true, previewAnywhere: false },
  demo: false,
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
  project({ id: 'portfolio', name: 'Portfolio', mainDomain: 'alexmorgan.dev', installedAt: null }),
];

// Recent activity from 10-projects.html, as the SQL function would return it.
export const ACTIVITY: ActivityItem[] = [
  {
    kind: 'experiment_launched',
    projectId: 'trip-demo',
    projectName: 'Trip Demo',
    subjectId: 'sticky',
    subject: 'Sticky Book Now bar',
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    kind: 'segment_updated',
    projectId: 'trip-demo',
    projectName: 'Trip Demo',
    subjectId: 'seg-returners',
    subject: 'High-intent returners',
    at: new Date(Date.now() - 60 * 60_000).toISOString(),
  },
  {
    kind: 'metric_created',
    projectId: 'checkout-lab',
    projectName: 'Checkout Lab',
    subjectId: 'm-purchase',
    subject: 'Purchase',
    at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
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
  {
    id: `${id}-c`,
    key: 'control',
    name: 'Control',
    weight: 50,
    js: '',
    css: '',
    url: null,
    version: 1,
  },
  { id: `${id}-b`, key: 'b', name: 'B', weight: 50, js: '', css: '', url: null, version: 1 },
];
const experiment = (
  e: Partial<Experiment> & Pick<Experiment, 'id' | 'name' | 'status'>,
): Experiment => ({
  projectId: 'trip-demo',
  key: e.id,
  hypothesis: '',
  type: 'ab',
  factors: [],
  trafficPct: 100,
  targeting: {},
  primaryMetricId: 'm-book',
  primaryMetricName: 'Book click',
  plannedSample: null,
  plan: {},
  startedAt: null,
  endedAt: null,
  archivedAt: null,
  previewUrl: null,
  exclusionGroup: null,
  previewToken: `tok-${e.id}`,
  autoPaused: null,
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
    { role: 'guardrail', limit: { maxPct: 2 }, metric: METRICS[1]! },
  ],
};

/**
 * 20 sampled sessions over 30 days (6,000 sessions, 200 a day): 12 mobile, 3 tablet,
 * 5 desktop; a mix of sources; landing on /trips/*, / and /deals/*.
 */
export const SESSION_SAMPLE: SessionSample = {
  sessions: 6000,
  days: 30,
  sample: Array.from({ length: 20 }, (_, i) => ({
    url: `https://mytrips.dev${i % 2 ? '/trips/norway' : i % 5 === 0 ? '/deals/summer' : '/'}`,
    props: {
      d: i < 12 ? ('mobile' as const) : i < 15 ? ('tablet' as const) : ('desktop' as const),
      w: i < 12 ? 390 : i < 15 ? 820 : 1440,
      s: (['direct', 'organic', 'paid', 'email'] as const)[i % 4]!,
      n: i % 3 === 0 ? 1 : 3,
    },
  })),
};

export const TRIGGERS: Saved<'triggers'>[] = [
  {
    id: 'trg-engaged',
    projectId: 'trip-demo',
    name: 'Engaged mobile visit',
    updatedAt: daysAgo(2),
    rules: {
      mode: 'all',
      items: [
        { type: 'screen_width', op: 'gte', value: 360 },
        { type: 'pages_viewed_session', op: 'gte', value: 2 },
      ],
    },
  },
];

export const PAGE_SETS: Saved<'page_sets'>[] = [
  {
    id: 'ps-trips',
    projectId: 'trip-demo',
    name: 'Trip and deal pages',
    updatedAt: daysAgo(4),
    rules: {
      include: [
        { op: 'matches', value: '/trips/*' },
        { op: 'regex', value: '^/deals/(summer|monsoon)' },
      ],
      exclude: [{ op: 'contains', value: '/archive' }],
    },
  },
];

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

// Results for Sticky: the worked example on Book click, plus Purchase (guardrail) and the
// confirmation page (secondary).
const r = (
  metricId: string,
  variantKey: string,
  visitors: number,
  converters: number,
  valueSum = 0,
): MetricArm => ({
  metricId,
  variantKey,
  visitors,
  converters,
  events: converters,
  eventsSumsq: converters,
  valueSum,
  valueSumsq: valueSum * 50,
  viewers: 0,
});
export const RESULTS: Record<string, MetricArm[]> = {
  sticky: [
    r('m-book', 'control', 12_480, 622),
    r('m-book', 'b', 12_380, 677),
    r('m-purchase', 'control', 12_480, 151, 18_000),
    r('m-purchase', 'b', 12_380, 154, 18_500),
    r('m-confirm', 'control', 12_480, 140),
    r('m-confirm', 'b', 12_380, 146),
  ],
};

export const DAILY: Record<string, DailyArm[]> = {
  sticky: Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10);
    return [
      { day, variantKey: 'control', visitors: 891, converters: 44 },
      { day, variantKey: 'b', visitors: 884, converters: 48 },
    ];
  }).flat(),
};

export const PEOPLE: Person[] = [
  {
    userId: 'u_1',
    email: 'alex@mytrips.dev',
    name: 'Alex Morgan',
    role: 'owner',
    joinedAt: '2026-09-01T09:00:00Z',
  },
  {
    userId: 'u_2',
    email: 'ada@mytrips.dev',
    name: 'Ada Admin',
    role: 'admin',
    joinedAt: '2026-09-05T09:00:00Z',
  },
  {
    userId: 'u_3',
    email: 'max@mytrips.dev',
    name: null,
    role: 'member',
    joinedAt: '2026-09-10T09:00:00Z',
  },
];

/** In-memory DataApi seeded with the design's projects. */
export const SITE_SCAN: SiteScan = {
  source: 'rules',
  pages: [
    {
      url: 'https://mytrips.dev/',
      title: 'MyTrips',
      h1: 'Small-group trips',
      ctas: ['Book now'],
      endpoints: ['/api/search'],
    },
    { url: 'https://mytrips.dev/pricing', title: 'Pricing', h1: 'Plans', ctas: [], endpoints: [] },
  ],
  suggestions: [
    {
      name: 'Headline on home page',
      hypothesis: 'A headline that names the main benefit will keep more visitors on the page.',
      page: 'https://mytrips.dev/',
      template: 'headline',
    },
    {
      name: 'Reviews near prices on /pricing',
      hypothesis: 'Showing reviews next to prices will reduce doubt and raise conversions.',
      page: 'https://mytrips.dev/pricing',
      template: 'trust',
    },
  ],
};

export function fakeData(
  opts: {
    projects?: Project[];
    workspaces?: Workspace[];
    experiments?: Experiment[];
    stats?: VariantStats[];
    lastEventAt?: string | null;
    segments?: Segment[];
    results?: Record<string, MetricArm[]>;
    people?: Person[];
    activity?: ActivityItem[];
    sessionSample?: SessionSample;
    triggers?: Saved<'triggers'>[];
    pageSets?: Saved<'page_sets'>[];
    siteScan?: SiteScan | Error;
  } = {},
) {
  const projects = (opts.projects ?? PROJECTS).map((p) => ({
    ...p,
    allowedDomains: [...p.allowedDomains],
  }));
  const experiments = (opts.experiments ?? EXPERIMENTS).map((e) => ({
    ...e,
    variants: e.variants.map((v) => ({ ...v })),
  }));
  const patches: Array<{ id: string; patch: unknown }> = [];
  const variantPatches: Array<{ id: string; patch: unknown }> = [];
  let metrics = METRICS.map((m) => ({ ...m }));
  let workspaces = (opts.workspaces ?? [WORKSPACE]).map((w) => ({ ...w }));
  let people = (opts.people ?? PEOPLE).map((p) => ({ ...p }));
  let invites: Invite[] = [];
  const invitesByToken: Record<string, { invite: Invite; workspaceName: string }> = {};
  const goals: Record<string, ExperimentGoal[]> = Object.fromEntries(
    Object.entries(GOALS).map(([k, v]) => [k, v.map((g) => ({ ...g }))]),
  );
  let segments = (opts.segments ?? SEGMENTS).map((x) => ({ ...x }));
  const saved: { triggers: Saved<'triggers'>[]; page_sets: Saved<'page_sets'>[] } = {
    triggers: (opts.triggers ?? TRIGGERS).map((x) => ({ ...x })),
    page_sets: (opts.pageSets ?? PAGE_SETS).map((x) => ({ ...x })),
  };
  const versions: Record<
    string,
    Array<{ id: string; js: string; css: string; note: string; createdAt: string }>
  > = {};
  const createdExperiments: string[] = [];
  const created: NewProject[] = [];
  let installNext = false;

  const api: DataApi = {
    listWorkspaces: async () => workspaces.map((w) => ({ ...w })),
    async createWorkspace(name) {
      const id = `ws_${workspaces.length + 1}`;
      workspaces.push({ id, name, plan: 'free', role: 'owner' });
      return id;
    },
    async renameWorkspace(id, name) {
      workspaces.find((w) => w.id === id)!.name = name;
    },
    async deleteWorkspace(id) {
      workspaces = workspaces.filter((w) => w.id !== id);
    },
    listPeople: async () => people.map((p) => ({ ...p })),
    async setRole(_ws, userId, role) {
      if (
        role !== 'owner' &&
        people.filter((p) => p.role === 'owner' && p.userId !== userId).length === 0 &&
        people.find((p) => p.userId === userId)!.role === 'owner'
      ) {
        throw new Error('A workspace needs at least one owner. Make someone else an owner first.');
      }
      people.find((p) => p.userId === userId)!.role = role;
    },
    async removeMember(_ws, userId) {
      people = people.filter((p) => p.userId !== userId);
    },
    listInvites: async () => invites.map((i) => ({ ...i })),
    async createInvite(workspaceId, email, role) {
      const invite: Invite = {
        id: `inv_${invites.length + 1}`,
        email,
        role,
        token: `00000000-0000-0000-0000-00000000000${invites.length + 1}`,
        createdAt: daysAgo(0),
        expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
        acceptedAt: null,
      };
      invites.unshift(invite);
      invitesByToken[invite.token] = {
        invite,
        workspaceName: workspaces.find((w) => w.id === workspaceId)?.name ?? '',
      };
      return { ...invite };
    },
    async revokeInvite(id) {
      invites = invites.filter((i) => i.id !== id);
    },
    async inviteDetails(token) {
      const found = invitesByToken[token];
      if (!found) return null;
      return {
        workspaceName: found.workspaceName,
        email: found.invite.email,
        role: found.invite.role,
        expired: Date.parse(found.invite.expiresAt) < Date.now(),
        accepted: found.invite.acceptedAt !== null,
      };
    },
    async acceptInvite(token) {
      const found = invitesByToken[token];
      if (!found) throw new Error('This invite link is not valid.');
      found.invite.acceptedAt = daysAgo(0);
      const id = `ws_joined`;
      workspaces.push({ id, name: found.workspaceName, plan: 'free', role: found.invite.role });
      return id;
    },
    listProjects: async (ws) => projects.filter((p) => p.workspaceId === ws).map((p) => ({ ...p })),
    getProject: async (id) => {
      const p = projects.find((x) => x.id === id) ?? null;
      if (p && installNext) p.installedAt = '2026-09-29T12:00:00Z';
      // Copies, like a real API: callers must never share our objects.
      return p && { ...p };
    },
    projectOverview: async () => STATS,
    sessionSample: async () => opts.sessionSample ?? SESSION_SAMPLE,
    // Sticky's totals (control 12,480 / 622, B 12,380 / 677) split by device and source.
    experimentBreakdown: async (id, dimension) =>
      id.replace(/^demo-/, '') !== 'sticky'
        ? []
        : dimension === 'device'
          ? [
              { segment: 'desktop', variantKey: 'b', visitors: 3960, converters: 198 },
              { segment: 'desktop', variantKey: 'control', visitors: 4000, converters: 204 },
              { segment: 'mobile', variantKey: 'b', visitors: 7920, converters: 460 },
              { segment: 'mobile', variantKey: 'control', visitors: 7990, converters: 395 },
              { segment: 'tablet', variantKey: 'b', visitors: 500, converters: 19 },
              { segment: 'tablet', variantKey: 'control', visitors: 490, converters: 23 },
              { segment: 'unknown', variantKey: 'b', visitors: 0, converters: 0 },
            ]
          : [
              { segment: 'organic', variantKey: 'b', visitors: 6190, converters: 340 },
              { segment: 'organic', variantKey: 'control', visitors: 6240, converters: 312 },
              { segment: 'paid', variantKey: 'b', visitors: 6190, converters: 337 },
              { segment: 'paid', variantKey: 'control', visitors: 6240, converters: 310 },
            ],
    workspaceActivity: async (_ws, limit) => (opts.activity ?? ACTIVITY).slice(0, limit),
    eventsThisMonth: async () => 48_210,
    async createDemoProject(workspaceId) {
      const demo = project({
        id: 'demo',
        name: 'Demo: Trip Shop',
        mainDomain: 'demo.splitcraft.dev',
        workspaceId,
        demo: true,
      });
      projects.push(demo);
      const sticky = experiments.find((e) => e.id === 'sticky') ?? EXPERIMENTS[0]!;
      experiments.push({ ...sticky, id: 'demo-sticky', projectId: 'demo' });
      goals['demo-sticky'] = (goals.sticky ?? []).map((g) => ({ ...g }));
      return { projectId: 'demo', experimentId: 'demo-sticky' };
    },
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
    async updateProject(id, patch) {
      const p = projects.find((x) => x.id === id)!;
      Object.assign(p, patch);
      return { ...p };
    },
    async deleteProject(id) {
      const i = projects.findIndex((x) => x.id === id);
      if (i >= 0) projects.splice(i, 1);
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
    // The demo project's experiment reuses the Sticky example's numbers.
    experimentResults: async (id) => opts.results?.[id] ?? RESULTS[id.replace(/^demo-/, '')] ?? [],
    experimentDaily: async (id) => DAILY[id.replace(/^demo-/, '')] ?? [],
    async addVariant(experimentId, variant) {
      const e = experiments.find((x) => x.id === experimentId)!;
      e.variants.push({
        // Not `${id}-c`: that is Control's id in these fixtures.
        id: `${experimentId}-added-${variant.key}`,
        js: '',
        css: '',
        url: null,
        version: 1,
        ...variant,
      });
      e.variants.sort((a, b) =>
        a.key === 'control' ? -1 : b.key === 'control' ? 1 : a.key.localeCompare(b.key),
      );
    },
    async deleteVariant(id) {
      for (const e of experiments) e.variants = e.variants.filter((v) => v.id !== id);
    },
    async setMvt(experimentId, factors, next) {
      const e = experiments.find((x) => x.id === experimentId)!;
      e.factors = factors;
      e.variants = next.map((v) => {
        const old = e.variants.find((o) => o.key === v.key);
        return {
          id: old?.id ?? `${experimentId}-${v.key}`,
          url: null,
          version: old?.version ?? 1,
          ...v,
        };
      });
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
    listSaved: async (kind, projectId) =>
      saved[kind].filter((x) => x.projectId === projectId).map((x) => ({ ...x })) as never,
    async createSaved(kind, projectId, name, rules) {
      const item = {
        id: `${kind}-${saved[kind].length + 1}`,
        projectId,
        name,
        rules,
        updatedAt: daysAgo(0),
      };
      (saved[kind] as unknown[]).push(item);
      return { ...item } as never;
    },
    async updateSaved(kind, id, patch) {
      const item = (saved[kind] as Array<{ id: string; name: string; rules: unknown }>).find(
        (x) => x.id === id,
      )!;
      if (patch.name !== undefined) item.name = patch.name;
      if (patch.rules !== undefined) item.rules = patch.rules;
      return { ...item } as never;
    },
    async deleteSaved(kind, id) {
      (saved as Record<SavedKind, Array<{ id: string }>>)[kind] = saved[kind].filter(
        (x) => x.id !== id,
      ) as never;
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
    experimentGoals: async (id) =>
      (goals[id] ?? []).map((g) => ({
        ...g,
        metric: metrics.find((m) => m.id === g.metric.id) ?? g.metric,
      })),
    async setExperimentGoal(experimentId, metricId, role, limit) {
      const list = (goals[experimentId] ??= []);
      const metric = metrics.find((m) => m.id === metricId)!;
      const existing = list.find((g) => g.metric.id === metricId);
      if (existing) Object.assign(existing, { role, limit });
      else list.push({ metric, role, limit });
    },
    async removeExperimentGoal(experimentId, metricId) {
      goals[experimentId] = (goals[experimentId] ?? []).filter((g) => g.metric.id !== metricId);
    },
    async duplicateExperiment(id) {
      const src = experiments.find((x) => x.id === id)!;
      const copy: Experiment = {
        ...src,
        id: `${src.id}-copy`,
        key: `${src.key}-copy`,
        name: `${src.name} (copy)`,
        status: 'draft',
        startedAt: null,
        endedAt: null,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        variants: src.variants.map((v) => ({ ...v, id: `${v.id}-copy`, version: 1 })),
      };
      experiments.unshift(copy);
      goals[copy.id] = (goals[id] ?? []).map((g) => ({ ...g }));
      return { ...copy };
    },
    async deleteExperiment(id) {
      const e = experiments.find((x) => x.id === id);
      if (e?.status === 'live')
        throw new Error(
          'Only owners and admins can delete an experiment, and not while it is live.',
        );
      experiments.splice(experiments.indexOf(e!), 1);
    },
    async suggestExperiments() {
      const scan = opts.siteScan ?? SITE_SCAN;
      if (scan instanceof Error) throw scan;
      return structuredClone(scan);
    },
    async createExperiment(projectId, name, type = 'ab') {
      createdExperiments.push(name);
      const id = `exp-${createdExperiments.length}`;
      const e = experiment({
        id,
        name,
        type,
        // New tests call the unchanged page Original.
        variants:
          type === 'mvt'
            ? [{ ...variants(id)[0]!, name: 'Original', weight: 100 }]
            : variants(id).map((v) => ({
                ...v,
                name: v.key === 'control' ? 'Original' : 'Variation 1',
              })),
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
    savedNow: () => saved,
    metricsNow: () => metrics,
    projectsNow: () => projects,
    experimentsNow: () => experiments,
    workspacesNow: () => workspaces,
    peopleNow: () => people,
    /** Seed an invite as if another workspace had created it. */
    seedInvite(
      token: string,
      invite: Partial<Invite> & { email: string },
      workspaceName = 'Agency Clients',
    ) {
      const full: Invite = {
        id: `inv_seed_${token}`,
        role: 'member',
        token,
        createdAt: daysAgo(1),
        expiresAt: new Date(Date.now() + 6 * DAY).toISOString(),
        acceptedAt: null,
        ...invite,
      };
      invitesByToken[token] = { invite: full, workspaceName };
    },
    goalsNow: () => goals,
    /** Make the next status poll report the first ping. */
    receiveFirstPing() {
      installNext = true;
    },
  };
}
