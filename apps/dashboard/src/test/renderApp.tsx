import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import type { AuthApi } from '../auth/api';
import { AuthProvider } from '../auth/AuthProvider';
import type { DataApi } from '../data/api';
import { DataContext } from '../data/context';
import { routes } from '../router';
import { fakeAuth } from './fakeAuth';
import { fakeData } from './fakeData';

export function renderApp(
  path: string,
  {
    api = fakeAuth({ signedIn: true }).api,
    data = fakeData().api,
    routeList = routes,
  }: { api?: AuthApi; data?: DataApi; routeList?: RouteObject[] } = {},
) {
  const router = createMemoryRouter(routeList, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api}>
        <DataContext.Provider value={data}>
          <RouterProvider router={router} />
        </DataContext.Provider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}
