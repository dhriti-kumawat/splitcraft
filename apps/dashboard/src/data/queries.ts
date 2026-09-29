import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConditionGroup } from '../lib/targeting';
import type {
  Experiment,
  ExperimentGoal,
  ExperimentPatch,
  GuardrailLimit,
  Metric,
  NewProject,
  VariantPatch,
} from './api';
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
  experiment: (experimentId: string) => ['experiment', experimentId] as const,
  metrics: (projectId: string) => ['metrics', projectId] as const,
  goals: (experimentId: string) => ['goals', experimentId] as const,
  versions: (variantId: string) => ['versions', variantId] as const,
  segments: (projectId: string) => ['segments', projectId] as const,
  results: (experimentId: string) => ['results', experimentId] as const,
  daily: (experimentId: string) => ['daily', experimentId] as const,
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

export function useExperimentQuery(experimentId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.experiment(experimentId),
    queryFn: () => api.getExperiment(experimentId),
  });
}

export function useMetricsQuery(projectId: string) {
  const api = useData();
  return useQuery({ queryKey: keys.metrics(projectId), queryFn: () => api.listMetrics(projectId) });
}

export function useGoalsQuery(experimentId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.goals(experimentId),
    queryFn: () => api.experimentGoals(experimentId),
  });
}

/** Save experiment fields; the experiment and its project's list refresh afterwards. */
export function useUpdateExperiment(experiment: Pick<Experiment, 'id' | 'projectId'>) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: ExperimentPatch) => api.updateExperiment(experiment.id, patch),
    onSuccess: (updated) => {
      client.setQueryData(keys.experiment(experiment.id), updated);
      void client.invalidateQueries({ queryKey: keys.experiments(experiment.projectId) });
    },
  });
}

export function useUpdateVariants(experiment: Pick<Experiment, 'id' | 'projectId'>) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; patch: VariantPatch }>) =>
      Promise.all(updates.map((u) => api.updateVariant(u.id, u.patch))),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.experiment(experiment.id) });
      void client.invalidateQueries({ queryKey: keys.experiments(experiment.projectId) });
    },
  });
}

export function useVersionsQuery(variantId: string | undefined) {
  const api = useData();
  return useQuery({
    queryKey: keys.versions(variantId ?? ''),
    queryFn: () => api.listVariantVersions(variantId!),
    enabled: Boolean(variantId),
  });
}

/** Save one variant's code; its history and the experiment refresh. */
export function useSaveVariantCode(experiment: Pick<Experiment, 'id' | 'projectId'>) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, js, css }: { variantId: string; js: string; css: string }) =>
      api.updateVariant(variantId, { js, css }),
    onSuccess: (_r, { variantId }) => {
      void client.invalidateQueries({ queryKey: keys.versions(variantId) });
      void client.invalidateQueries({ queryKey: keys.experiment(experiment.id) });
    },
  });
}

/** Add or remove a variant (drafts only). Remaining weights are rebalanced evenly. */
export function useEditVariants(experiment: Experiment) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.experiment(experiment.id) });
    void client.invalidateQueries({ queryKey: keys.experiments(experiment.projectId) });
  };
  const add = useMutation({
    mutationFn: async () => {
      const used = new Set(experiment.variants.map((v) => v.key));
      const letter = 'bcdefghijklmnopqrstuvwxyz'.split('').find((l) => !used.has(l))!;
      const even = Math.round((100 / (experiment.variants.length + 1)) * 100) / 100;
      await api.addVariant(experiment.id, {
        key: letter,
        name: letter.toUpperCase(),
        weight: even,
      });
      await Promise.all(experiment.variants.map((v) => api.updateVariant(v.id, { weight: even })));
      return letter;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (variantId: string) => {
      const rest = experiment.variants.filter((v) => v.id !== variantId);
      const even = Math.round((100 / rest.length) * 100) / 100;
      await api.deleteVariant(variantId);
      await Promise.all(rest.map((v) => api.updateVariant(v.id, { weight: even })));
    },
    onSuccess: refresh,
  });
  return { add, remove };
}

export function useSegmentsQuery(projectId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.segments(projectId),
    queryFn: () => api.listSegments(projectId),
  });
}

export function useSegmentMutations(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: keys.segments(projectId) });
  return {
    create: useMutation({
      mutationFn: ({ name, rules }: { name: string; rules: ConditionGroup }) =>
        api.createSegment(projectId, name, rules),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, name, rules }: { id: string; name?: string; rules?: ConditionGroup }) =>
        api.updateSegment(id, { name, rules }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteSegment(id), onSuccess: refresh }),
  };
}

export function useMetricMutations(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: keys.metrics(projectId) });
  return {
    create: useMutation({
      mutationFn: (m: Omit<Metric, 'id'>) => api.createMetric(m),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        patch,
      }: {
        id: string;
        patch: Partial<Omit<Metric, 'id' | 'projectId'>>;
      }) => api.updateMetric(id, patch),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteMetric(id), onSuccess: refresh }),
  };
}

export function useGoalMutations(experimentId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: keys.goals(experimentId) });
  return {
    set: useMutation({
      mutationFn: ({
        metricId,
        role,
        limit,
      }: {
        metricId: string;
        role: ExperimentGoal['role'];
        limit: GuardrailLimit | null;
      }) => api.setExperimentGoal(experimentId, metricId, role, limit),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (metricId: string) => api.removeExperimentGoal(experimentId, metricId),
      onSuccess: refresh,
    }),
  };
}

export function useResultsQuery(experimentId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.results(experimentId),
    queryFn: () => api.experimentResults(experimentId),
  });
}

export function useDailyQuery(experimentId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.daily(experimentId),
    queryFn: () => api.experimentDaily(experimentId),
  });
}

export function useProjectMutations(workspaceId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.projects(workspaceId) });
    void client.invalidateQueries({ queryKey: keys.overview(workspaceId) });
  };
  return {
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateProject>[1] }) =>
        api.updateProject(id, patch),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteProject(id), onSuccess: refresh }),
  };
}
