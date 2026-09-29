import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewProject } from './api';
import { useData } from './context';

export const keys = {
  workspaces: (userId: string) => ['workspaces', userId] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  project: (projectId: string) => ['project', projectId] as const,
  overview: (workspaceId: string) => ['overview', workspaceId] as const,
  events: (workspaceId: string) => ['eventsThisMonth', workspaceId] as const,
  experiments: (projectId: string) => ['experiments', projectId] as const,
  experimentStats: (projectId: string) => ['experimentStats', projectId] as const,
  lastEvent: (projectId: string) => ['lastEvent', projectId] as const,
};

export function useWorkspacesQuery(userId: string) {
  const api = useData();
  return useQuery({ queryKey: keys.workspaces(userId), queryFn: () => api.listWorkspaces(userId) });
}

export function useProjectsQuery(workspaceId: string | undefined) {
  const api = useData();
  return useQuery({
    queryKey: keys.projects(workspaceId ?? ''),
    queryFn: () => api.listProjects(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useOverviewQuery(workspaceId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.overview(workspaceId),
    queryFn: () => api.projectOverview(workspaceId),
  });
}

export function useEventsThisMonthQuery(workspaceId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.events(workspaceId),
    queryFn: () => api.eventsThisMonth(workspaceId),
  });
}

/**
 * Poll one project while waiting for the SDK's first event, then stop.
 * `intervalMs` is short so "Snippet live" appears soon after the first page view.
 */
export function useInstallStatus(projectId: string | undefined, intervalMs = 4000) {
  const api = useData();
  return useQuery({
    queryKey: keys.project(projectId ?? ''),
    queryFn: () => api.getProject(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) => (query.state.data?.installedAt ? false : intervalMs),
  });
}

export function useCreateProject() {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (p: NewProject) => api.createProject(p),
    onSuccess: (project) => {
      void client.invalidateQueries({ queryKey: keys.projects(project.workspaceId) });
      void client.invalidateQueries({ queryKey: keys.overview(project.workspaceId) });
    },
  });
}

export function useExperimentsQuery(projectId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.experiments(projectId),
    queryFn: () => api.listExperiments(projectId),
  });
}

export function useExperimentStatsQuery(projectId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.experimentStats(projectId),
    queryFn: () => api.experimentStats(projectId),
  });
}

export function useLastEventQuery(projectId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.lastEvent(projectId),
    queryFn: () => api.lastEventAt(projectId),
  });
}

export function useCreateExperiment(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createExperiment(projectId, name),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.experiments(projectId) }),
  });
}
