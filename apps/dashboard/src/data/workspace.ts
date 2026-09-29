import { createContext, useContext } from 'react';
import { useParams } from 'react-router';
import type { Project, Role, Workspace } from './api';

export interface WorkspaceData {
  user: { id: string; name: string; role: Role };
  workspace: Workspace;
  workspaces: Workspace[];
  projects: Project[];
  selectWorkspace(id: string): void;
}

export const WorkspaceContext = createContext<WorkspaceData | null>(null);

export function useWorkspace(): WorkspaceData {
  const data = useContext(WorkspaceContext);
  if (!data) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return data;
}

/** The project in the URL (`/p/:projectId/...`), if any. */
export function useCurrentProject(): Project | undefined {
  const { projectId } = useParams();
  const { projects } = useWorkspace();
  return projects.find((p) => p.id === projectId);
}

export function initials(name: string): string {
  const words = name.replace(/'s\b/g, '').split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
