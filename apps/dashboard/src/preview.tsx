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
// Example variant code for the Sticky Book Now bar, so the code editor isn't empty.
void data.api.updateVariant('sticky-b', {
  js: `// Keep the Book button in view on mobile trip pages.
splitcraft.waitForElement('.book-now-btn', (btn) => {
  const bar = document.createElement('div');
  bar.className = 'sc-sticky-bar';
  bar.innerHTML = '<span>From ₹18,400</span>';
  bar.appendChild(btn.cloneNode(true));
  document.body.appendChild(bar);

  splitcraft.onceInView(bar, () => splitcraft.trackEvent('sticky_bar_seen'));
});`,
  css: `.sc-sticky-bar {
  position: fixed; inset: auto 0 0 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #fff; box-shadow: 0 -4px 16px rgba(0,0,0,.08);
}`,
});
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
