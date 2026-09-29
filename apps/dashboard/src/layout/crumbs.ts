import type { Project, Workspace } from '../data/api';

export interface CrumbContext {
  workspace: Workspace;
  project?: Project;
}

export interface Crumb {
  label: string;
  to?: string;
}

/** Put on a route's `handle` to add breadcrumb items for it. */
export interface RouteHandle {
  crumbs?: (ctx: CrumbContext) => Crumb[];
}
