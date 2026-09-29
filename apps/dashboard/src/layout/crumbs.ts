import type { ReactNode } from 'react';
import type { Params } from 'react-router';
import type { Project, Workspace } from '../data/api';

export interface CrumbContext {
  workspace: Workspace;
  project?: Project;
  params: Params;
}

export interface Crumb {
  /** Text, or a component that looks up a name (see CrumbNames). */
  label: ReactNode;
  to?: string;
}

/** Put on a route's `handle` to add breadcrumb items for it. */
export interface RouteHandle {
  crumbs?: (ctx: CrumbContext) => Crumb[];
}
