import type { ReactNode } from 'react';
import { useAuth } from '../auth/context';
import { demoProjects, demoUser, demoWorkspace } from './demo';
import { WorkspaceContext, type WorkspaceData } from './workspace';

/**
 * Workspace data for the signed-in user. The user's name is real (Supabase Auth);
 * workspace and projects are still demo data until feat/projects loads them.
 */
export function WorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: WorkspaceData;
}) {
  const { state } = useAuth();
  const data: WorkspaceData = value ?? {
    user: state.user ? { ...demoUser, id: state.user.id, name: state.user.name } : demoUser,
    workspace: demoWorkspace,
    projects: demoProjects,
  };
  return <WorkspaceContext.Provider value={data}>{children}</WorkspaceContext.Provider>;
}
