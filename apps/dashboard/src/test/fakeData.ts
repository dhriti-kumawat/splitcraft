import type { DataApi, NewProject, Project, ProjectStats, Workspace } from '../data/api';

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

/** In-memory DataApi seeded with the design's projects. */
export function fakeData(opts: { projects?: Project[]; workspaces?: Workspace[] } = {}) {
  const projects = [...(opts.projects ?? PROJECTS)];
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
  };
  return {
    api,
    created,
    /** Make the next status poll report the first ping. */
    receiveFirstPing() {
      installNext = true;
    },
  };
}
