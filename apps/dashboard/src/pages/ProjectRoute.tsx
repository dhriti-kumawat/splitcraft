import { Outlet } from 'react-router';
import { useCurrentProject } from '../data/workspace';
import { NotFoundPage } from './NotFoundPage';

/** Renders project pages only for a project in this workspace. */
export function ProjectRoute() {
  return useCurrentProject() ? <Outlet /> : <NotFoundPage what="project" />;
}
