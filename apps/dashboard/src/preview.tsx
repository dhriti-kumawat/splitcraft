// Design review tool, development only (not part of the production build):
//   npm run dev -w apps/dashboard, then open /preview.html?path=/p/trip-demo/experiments/sticky/results
// Renders any screen with the test fixtures (the design's example data), signed in, no Supabase.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import '../../../design/tokens.css';
import './index.css';
import { AuthProvider } from './auth/AuthProvider';
import { DataContext } from './data/context';
import { routes } from './router';
import { fakeAuth } from './test/fakeAuth';
import { fakeData } from './test/fakeData';

const params = new URLSearchParams(location.search);
const path = params.get('path') ?? '/projects';
const signedIn = !/^\/(login|signup|forgot-password)/.test(path);
// &workspaces=none shows the first-run screen for an account without a workspace.
const data = fakeData(params.get('workspaces') === 'none' ? { workspaces: [] } : {});
const router = createMemoryRouter(routes, { initialEntries: [path] });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider api={fakeAuth({ signedIn }).api}>
      <DataContext.Provider value={data.api}>
        <RouterProvider router={router} />
      </DataContext.Provider>
    </AuthProvider>
  </QueryClientProvider>,
);
