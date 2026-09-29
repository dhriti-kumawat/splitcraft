import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { WorkspaceProvider } from './data/WorkspaceProvider';
import { AuthPage } from './pages/auth/AuthPage';
import { ExperimentsPage } from './pages/experiments/ExperimentsPage';
import { AppShell } from './layout/AppShell';
import type { RouteHandle } from './layout/crumbs';
import { NotFoundPage } from './pages/NotFoundPage';
import { Placeholder } from './pages/Placeholder';
import { ProjectRoute } from './pages/ProjectRoute';
import { InstallPage } from './pages/projects/InstallPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';

const crumb = (label: string, to?: string): RouteHandle => ({ crumbs: () => [{ label, to }] });

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
                path: ':expId/*',
                element: <Placeholder title="Experiment" step="feat/experiment-basics" />,
                handle: crumb('Experiment'),
              },
            ],
          },
          {
            path: 'audiences',
            handle: crumb('Audiences'),
            children: [
              { index: true, element: <Placeholder title="Audiences" step="feat/segments" /> },
              {
                path: ':segmentId',
                element: <Placeholder title="Segment" step="feat/segments" />,
                handle: crumb('Segment'),
              },
            ],
          },
          {
            path: 'metrics',
            handle: crumb('Metrics'),
            children: [
              { index: true, element: <Placeholder title="Metrics" step="feat/metrics" /> },
              {
                path: 'new',
                element: <Placeholder title="New metric" step="feat/metrics" />,
                handle: crumb('New metric'),
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
