import type { ReactNode } from 'react';
import { demoProjects, demoUser, demoWorkspace } from './demo';
import { WorkspaceContext, type WorkspaceData } from './workspace';

export function WorkspaceProvider({
  children,
  value = { user: demoUser, workspace: demoWorkspace, projects: demoProjects },
}: {
  children: ReactNode;
  value?: WorkspaceData;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
