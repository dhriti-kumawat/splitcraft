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
}
