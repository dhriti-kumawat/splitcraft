import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import type { AuthApi } from '../auth/api';
import { AuthProvider } from '../auth/AuthProvider';
import { WorkspaceProvider } from '../data/WorkspaceProvider';
import { routes } from '../router';
import { fakeAuth } from './fakeAuth';

export function renderApp(
  path: string,
  {
    api = fakeAuth({ signedIn: true }).api,
    routeList = routes,
  }: { api?: AuthApi; routeList?: RouteObject[] } = {},
) {
  const router = createMemoryRouter(routeList, { initialEntries: [path] });
  render(
    <AuthProvider api={api}>
      <WorkspaceProvider>
        <RouterProvider router={router} />
      </WorkspaceProvider>
    </AuthProvider>,
  );
  return router;
}
