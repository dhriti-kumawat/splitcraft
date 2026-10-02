import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { MAX_VARIANTS } from '../lib/chartColors';
import { evenWeights } from '../lib/experiments';
import type { ConditionGroup } from '../lib/targeting';
import { TEMPLATES } from '../lib/templates';
import type {
  Experiment,
  FlagPatch,
  ExperimentSuggestion,
  ExperimentGoal,
  ExperimentPatch,
  GuardrailLimit,
  Invite,
  Metric,
  NewProject,
  Project,
  Role,
  SavedKind,
  SavedRules,
  ExperimentType,
  MvtFactor,
  NewVariant,
  VariantPatch,
  VariantStats,
} from './api';
import { useData } from './context';

export const keys = {
  workspaces: (userId: string) => ['workspaces', userId] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  project: (projectId: string) => ['project', projectId] as const,
  overview: (workspaceId: string) => ['overview', workspaceId] as const,
  activity: (workspaceId: string, limit: number) => ['activity', workspaceId, limit] as const,
  events: (workspaceId: string) => ['eventsThisMonth', workspaceId] as const,
  experiments: (projectId: string) => ['experiments', projectId] as const,
  experimentStats: (projectId: string) => ['experimentStats', projectId] as const,
  lastEvent: (projectId: string) => ['lastEvent', projectId] as const,
  sessionSample: (projectId: string) => ['sessionSample', projectId] as const,
  experiment: (experimentId: string) => ['experiment', experimentId] as const,
  metrics: (projectId: string) => ['metrics', projectId] as const,
  goals: (experimentId: string) => ['goals', experimentId] as const,
  versions: (variantId: string) => ['versions', variantId] as const,
  segments: (projectId: string) => ['segments', projectId] as const,
  saved: (kind: SavedKind, projectId: string) => ['saved', kind, projectId] as const,
  results: (experimentId: string) => ['results', experimentId] as const,
  breakdown: (experimentId: string, dimension: string) =>
    ['breakdown', experimentId, dimension] as const,
  daily: (experimentId: string) => ['daily', experimentId] as const,
  people: (workspaceId: string) => ['people', workspaceId] as const,
  invites: (workspaceId: string) => ['invites', workspaceId] as const,
  invite: (token: string) => ['invite', token] as const,
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

export function useActivityQuery(workspaceId: string, limit: number) {
  const api = useData();
  return useQuery({
    queryKey: keys.activity(workspaceId, limit),
    queryFn: () => api.workspaceActivity(workspaceId, limit),
  });
}

export function useBreakdownQuery(experimentId: string, dimension: 'device' | 'source') {
  const api = useData();
  return useQuery({
    queryKey: keys.breakdown(experimentId, dimension),
    queryFn: () => api.experimentBreakdown(experimentId, dimension),
  });
}

export function useSessionSampleQuery(projectId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.sessionSample(projectId),
    queryFn: () => api.sessionSample(projectId),
    staleTime: 5 * 60_000,
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

export function useCreateDemoProject(workspaceId: string) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.createDemoProject(workspaceId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projects(workspaceId) });
      void client.invalidateQueries({ queryKey: keys.overview(workspaceId) });
      void client.invalidateQueries({ queryKey: keys.activity(workspaceId, 5) });
    },
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

/** Experiments (and optionally their stats) for several projects, keyed by project id. */
export function useExperimentsByProject(
  projectIds: string[],
  { stats = false, enabled = true } = {},
) {
  const api = useData();
  return useQueries({
    queries: projectIds.flatMap((id) => [
      { queryKey: keys.experiments(id), queryFn: () => api.listExperiments(id), enabled },
      ...(stats
        ? [{ queryKey: keys.experimentStats(id), queryFn: () => api.experimentStats(id), enabled }]
        : []),
    ]),
    combine: (results) => {
      const step = stats ? 2 : 1;
      return Object.fromEntries(
        projectIds.map((id, i) => [
          id,
          {
            experiments: results[i * step]?.data as Experiment[] | undefined,
            stats: stats ? (results[i * step + 1]?.data as VariantStats[] | undefined) : undefined,
          },
        ]),
      );
    },
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
    mutationFn: ({ name, type }: { name: string; type: ExperimentType }) =>
      api.createExperiment(projectId, name, type),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.experiments(projectId) }),
  });
}

/** Scans the project's site for experiment ideas. Runs on request: it fetches the live site. */
export function useSuggestExperiments(projectId: string) {
  const api = useData();
  return useMutation({ mutationFn: () => api.suggestExperiments(projectId) });
}

/** One click: a draft with the idea's hypothesis, page and template code in Variation 1. */
export function useCreateFromSuggestion(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (idea: ExperimentSuggestion) => {
      const exp = await api.createExperiment(projectId, idea.name, 'ab');
      await api.updateExperiment(exp.id, { hypothesis: idea.hypothesis, previewUrl: idea.page });
      const template = TEMPLATES.find((t) => t.id === idea.template);
      const variant = exp.variants.find((v) => v.key !== 'control');
      if (template && variant)
        await api.updateVariant(variant.id, { js: template.js, css: template.css });
      return exp;
    },
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

export function useMetricsQuery(projectId: string, enabled = true) {
  const api = useData();
  return useQuery({
    queryKey: keys.metrics(projectId),
    queryFn: () => api.listMetrics(projectId),
    enabled,
  });
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
    onSuccess: (updated, patch) => {
      client.setQueryData(keys.experiment(experiment.id), updated);
      void client.invalidateQueries({ queryKey: keys.experiments(experiment.projectId) });
      // A new primary goal changes what the results are measured on.
      if ('primaryMetricId' in patch) {
        void client.invalidateQueries({ queryKey: keys.results(experiment.id) });
        void client.invalidateQueries({ queryKey: keys.experimentStats(experiment.projectId) });
      }
    },
  });
}

/** Use a metric just created from an experiment's Goals step as its primary or a secondary goal. */
export function useAttachGoal(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experimentId,
      metricId,
      role,
    }: {
      experimentId: string;
      metricId: string;
      role: 'primary' | ExperimentGoal['role'];
    }) => {
      if (role === 'primary')
        await api.updateExperiment(experimentId, { primaryMetricId: metricId });
      else
        await api.setExperimentGoal(
          experimentId,
          metricId,
          role,
          role === 'guardrail' ? { maxPct: 2 } : null,
        );
    },
    onSuccess: (_, { experimentId }) => {
      for (const key of [
        keys.experiment(experimentId),
        keys.goals(experimentId),
        keys.results(experimentId),
        keys.experiments(projectId),
        keys.experimentStats(projectId),
      ])
        void client.invalidateQueries({ queryKey: key });
    },
  });
}

/** A ready-made metric as a goal: reuses the project's metric with that event key, or creates it. */
export function useAddReadyGoal(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  const attach = useAttachGoal(projectId);
  return useMutation({
    mutationFn: async ({
      experimentId,
      metric,
      role,
    }: {
      experimentId: string;
      metric: Omit<Metric, 'id' | 'projectId'>;
      role: 'primary' | ExperimentGoal['role'];
    }) => {
      const existing = (await api.listMetrics(projectId)).find(
        (m) => m.eventKey === metric.eventKey,
      );
      const saved = existing ?? (await api.createMetric({ projectId, ...metric }));
      await attach.mutateAsync({ experimentId, metricId: saved.id, role });
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.metrics(projectId) }),
  });
}

export function useDuplicateExperiment(experiment: Pick<Experiment, 'id' | 'projectId'>) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.duplicateExperiment(experiment.id),
    onSuccess: (copy) => {
      client.setQueryData(keys.experiment(copy.id), copy);
      void client.invalidateQueries({ queryKey: keys.experiments(experiment.projectId) });
    },
  });
}

export function useDeleteExperiment(experiment: Pick<Experiment, 'id' | 'projectId'>) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteExperiment(experiment.id),
    onSuccess: () => {
      client.removeQueries({ queryKey: keys.experiment(experiment.id) });
      void client.invalidateQueries({ queryKey: keys.experiments(experiment.projectId) });
      void client.invalidateQueries({ queryKey: keys.experimentStats(experiment.projectId) });
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

/** MVT: save the sections and regenerate the combination variants. */
export function useSetMvt(experiment: Pick<Experiment, 'id' | 'projectId'>) {
  const api = useData();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ factors, variants }: { factors: MvtFactor[]; variants: NewVariant[] }) =>
      api.setMvt(experiment.id, factors, variants),
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
    mutationFn: async (name: string) => {
      const used = new Set(experiment.variants.map((v) => v.key));
      const letter = 'bcdefghijklmnopqrstuvwxyz'.split('').find((l) => !used.has(l));
      if (!letter) throw new Error(`An experiment can have at most ${MAX_VARIANTS} variants.`);
      const weights = evenWeights(experiment.variants.length + 1);
      await api.addVariant(experiment.id, {
        key: letter,
        name: name.trim() || `Variant ${letter.toUpperCase()}`,
        weight: weights[weights.length - 1]!,
      });
      await Promise.all(
        experiment.variants.map((v, i) => api.updateVariant(v.id, { weight: weights[i]! })),
      );
      return letter;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (variantId: string) => {
      const rest = experiment.variants.filter((v) => v.id !== variantId);
      const weights = evenWeights(rest.length);
      await api.deleteVariant(variantId);
      await Promise.all(rest.map((v, i) => api.updateVariant(v.id, { weight: weights[i]! })));
    },
    onSuccess: refresh,
  });
  return { add, remove };
}

export function useFlagsQuery(projectId: string) {
  const api = useData();
  return useQuery({ queryKey: ['flags', projectId], queryFn: () => api.listFlags(projectId) });
}

export function useFlagMutations(projectId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: ['flags', projectId] });
  return {
    create: useMutation({
      mutationFn: (flag: { key: string; name: string }) => api.createFlag(projectId, flag),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: FlagPatch }) => api.updateFlag(id, patch),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteFlag(id), onSuccess: refresh }),
  };
}

export function useSegmentsQuery(projectId: string, enabled = true) {
  const api = useData();
  return useQuery({
    queryKey: keys.segments(projectId),
    queryFn: () => api.listSegments(projectId),
    enabled,
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

export function useSavedQuery<K extends SavedKind>(kind: K, projectId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.saved(kind, projectId),
    queryFn: () => api.listSaved(kind, projectId),
  });
}

/** Create, rename / edit and delete saved triggers or page sets. */
export function useSavedMutations<K extends SavedKind>(kind: K, projectId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: keys.saved(kind, projectId) });
  return {
    create: useMutation({
      mutationFn: ({ name, rules }: { name: string; rules: SavedRules[K] }) =>
        api.createSaved(kind, projectId, name, rules),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, name, rules }: { id: string; name?: string; rules?: SavedRules[K] }) =>
        api.updateSaved(kind, id, { name, rules }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteSaved(kind, id),
      onSuccess: refresh,
    }),
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
      onSuccess: (updated) => {
        // Show the saved values at once, so switches don't flick back while the list reloads.
        client.setQueryData<Project[]>(keys.projects(workspaceId), (list) =>
          list?.map((p) => (p.id === updated.id ? updated : p)),
        );
        refresh();
      },
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteProject(id), onSuccess: refresh }),
  };
}

export function usePeopleQuery(workspaceId: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.people(workspaceId),
    queryFn: () => api.listPeople(workspaceId),
  });
}

export function useInvitesQuery(workspaceId: string, enabled: boolean) {
  const api = useData();
  return useQuery({
    queryKey: keys.invites(workspaceId),
    queryFn: () => api.listInvites(workspaceId),
    enabled,
  });
}

export function useTeamMutations(workspaceId: string) {
  const api = useData();
  const client = useQueryClient();
  const people = () => void client.invalidateQueries({ queryKey: keys.people(workspaceId) });
  const invites = () => void client.invalidateQueries({ queryKey: keys.invites(workspaceId) });
  return {
    setRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
        api.setRole(workspaceId, userId, role),
      onSuccess: people,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => api.removeMember(workspaceId, userId),
      onSuccess: people,
    }),
    invite: useMutation({
      mutationFn: ({ email, role }: { email: string; role: Invite['role'] }) =>
        api.createInvite(workspaceId, email, role),
      onSuccess: invites,
    }),
    revoke: useMutation({ mutationFn: (id: string) => api.revokeInvite(id), onSuccess: invites }),
  };
}

/** Create, rename or delete workspaces; the workspace list refreshes afterwards. */
export function useWorkspaceMutations(userId: string) {
  const api = useData();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: keys.workspaces(userId) });
  return {
    create: useMutation({
      mutationFn: (name: string) => api.createWorkspace(name),
      onSuccess: refresh,
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => api.renameWorkspace(id, name),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteWorkspace(id),
      onSuccess: refresh,
    }),
  };
}

export function useInviteQuery(token: string) {
  const api = useData();
  return useQuery({
    queryKey: keys.invite(token),
    queryFn: () => api.inviteDetails(token),
    retry: false,
  });
}
