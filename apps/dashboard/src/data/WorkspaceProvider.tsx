import { useState, type ReactNode } from 'react';
import { useAuth } from '../auth/context';
import { NoWorkspace } from './NoWorkspace';
import { useProjectsQuery, useWorkspacesQuery } from './queries';
import { WorkspaceContext } from './workspace';
import styles from './WorkspaceProvider.module.css';

const STORAGE_KEY = 'splitcraft_workspace';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Loads the signed-in user's workspaces and the current workspace's projects. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const user = state.user!;
  const [selected, setSelected] = useState(readStored);
  const workspaces = useWorkspacesQuery(user.id);
  const workspace =
    workspaces.data?.find((w) => w.id === selected) ?? workspaces.data?.[0] ?? undefined;
  const projects = useProjectsQuery(workspace?.id);

  if (workspaces.isError || projects.isError) {
    return (
      <Message title="Couldn't load your workspace">
        {(workspaces.error ?? projects.error)?.message} Check your connection and reload the page.
      </Message>
    );
  }
  if (workspaces.isPending || (workspace && projects.isPending)) {
    return <div className={styles.loading} aria-busy="true" aria-label="Loading workspace" />;
  }
  if (!workspace) {
    return <NoWorkspace onCreated={(id) => setSelected(id)} />;
  }

  const selectWorkspace = (id: string) => {
    setSelected(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not remembered across reloads; still switches now.
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user: { id: user.id, name: user.name, role: workspace.role },
        workspace,
        workspaces: workspaces.data,
        projects: projects.data ?? [],
        selectWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.message}>
      <h1>{title}</h1>
      <p>{children}</p>
    </main>
  );
}
