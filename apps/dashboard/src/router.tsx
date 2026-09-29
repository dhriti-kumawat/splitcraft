import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { WorkspaceProvider } from './data/WorkspaceProvider';
import { AuthPage } from './pages/auth/AuthPage';
import { MetricsPage } from './pages/metrics/MetricsPage';
import { BasicsPage } from './pages/experiments/BasicsPage';
import { ExperimentLayout } from './pages/experiments/ExperimentLayout';
import { ExperimentsPage } from './pages/experiments/ExperimentsPage';
import { AppShell } from './layout/AppShell';
import type { RouteHandle } from './layout/crumbs';
import { NotFoundPage } from './pages/NotFoundPage';
import { Placeholder } from './pages/Placeholder';
import { ProjectRoute } from './pages/ProjectRoute';
import { InstallPage } from './pages/projects/InstallPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';

const crumb = (label: string, to?: string): RouteHandle => ({ crumbs: () => [{ label, to }] });

// Heavier screens (Monaco, Recharts, the condition builder) load on first visit, so the
// dashboard's first load stays small.

// Screen → route map from design/README.md.
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/projects" replace /> },
  { path: 'login', element: <AuthPage key="login" mode="login" /> },
  { path: 'signup', element: <AuthPage key="signup" mode="signup" /> },
  { path: 'forgot-password', element: <AuthPage key="forgot" mode="forgot" /> },
  { path: 'reset-password', element: <AuthPage key="reset" mode="reset" /> },
  {
    element: (
      <RequireAuth>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </RequireAuth>
    ),
    children: [
      { path: 'projects', element: <ProjectsPage />, handle: crumb('Projects') },
      {
        path: 'team',
        element: <Placeholder title="Team" step="a later step" />,
        handle: crumb('Team'),
      },
      {
        path: 'p/:projectId',
        element: <ProjectRoute />,
        handle: {
          crumbs: ({ project }) =>
            project ? [{ label: project.name, to: `/p/${project.id}/experiments` }] : [],
        } satisfies RouteHandle,
        children: [
          { index: true, element: <Navigate to="experiments" replace /> },
          {
            path: 'experiments',
            handle: crumb('Experiments'),
            children: [
              {
                index: true,
                element: <ExperimentsPage />,
              },
              {
                path: ':expId',
                element: <ExperimentLayout />,
                handle: crumb('Experiment'),
                children: [
                  { index: true, element: <Navigate to="basics" replace /> },
                  { path: 'basics', element: <BasicsPage /> },
                  {
                    path: 'variants',
                    lazy: async () => ({
                      Component: (await import('./pages/experiments/VariantsPage')).VariantsPage,
                    }),
                  },
                  {
                    path: 'targeting',
                    lazy: async () => ({
                      Component: (await import('./pages/experiments/TargetingPage')).TargetingPage,
                    }),
                  },
                  {
                    path: 'goals',
                    lazy: async () => ({
                      Component: (await import('./pages/experiments/GoalsPage')).GoalsPage,
                    }),
                  },
                  {
                    path: 'results',
                    // Recharts is large; load it only when someone opens results.
                    lazy: async () => ({
                      Component: (await import('./pages/experiments/ResultsPage')).ResultsPage,
                    }),
                  },
                ],
              },
            ],
          },
          {
            path: 'audiences',
            handle: crumb('Audiences'),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('./pages/audiences/AudiencesPage')).AudiencesPage,
                }),
              },
              {
                path: ':segmentId',
                lazy: async () => ({
                  Component: (await import('./pages/audiences/AudiencesPage')).AudiencesPage,
                }),
                handle: crumb('Segment'),
              },
            ],
          },
          {
            path: 'metrics',
            handle: crumb('Metrics'),
            children: [
              { index: true, element: <MetricsPage /> },
              {
                path: 'new',
                lazy: async () => ({
                  Component: (await import('./pages/metrics/MetricEditor')).MetricEditor,
                }),
                handle: crumb('New metric'),
              },
              {
                path: ':metricId',
                lazy: async () => ({
                  Component: (await import('./pages/metrics/MetricEditor')).MetricEditor,
                }),
                handle: crumb('Metric'),
              },
            ],
          },
          {
            path: 'install',
            element: <InstallPage />,
            handle: crumb('Install'),
          },
          {
            path: 'settings',
            element: <Placeholder title="Settings" step="a later step" />,
            handle: crumb('Settings'),
          },
        ],
      },
      { path: '*', element: <NotFoundPage />, handle: crumb('Not found') },
    ],
  },
];

export const router = createBrowserRouter(routes);
