// The public demo (demo.html, part of the production build): the dashboard with the example
// data (Larkspur Travel), signed in as Maya, no account and no Supabase. Everything lives in
// memory, so nothing anyone changes is saved; a reload starts fresh.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import '../../../design/tokens.css';
import './index.css';
import { AuthProvider } from './auth/AuthProvider';
import { DataContext } from './data/context';
import { SITE_URL } from './lib/snippet';
import { routes } from './router';
import { fakeAuth } from './test/fakeAuth';
import { fakeData } from './test/fakeData';
import styles from './demo.module.css';

const start = new URLSearchParams(location.search).get('path') ?? '/projects';
const data = fakeData();
// Example code for the Sticky Book Now bar, so the code editor shows something real.
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
const router = createMemoryRouter(routes, { initialEntries: [start] });

// Keep the address bar in step, so Back, Forward and reload work.
router.subscribe((state) => {
  if (state.historyAction === 'POP') return;
  const url = `?path=${encodeURIComponent(state.location.pathname + state.location.search)}`;
  if (state.historyAction === 'PUSH') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
});
addEventListener('popstate', () => {
  const next = new URLSearchParams(location.search).get('path') ?? '/projects';
  void router.navigate(next, { replace: true });
});

function DemoNote() {
  return (
    <aside className={styles.note} aria-label="Demo">
      <span>
        <b>Demo</b> with example data. Changes aren&apos;t saved.
      </span>
      <a href={new URL('/request-access/', SITE_URL).href} className={styles.link}>
        Request access
      </a>
    </aside>
  );
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider api={fakeAuth({ signedIn: true }).api}>
      <DataContext.Provider value={data.api}>
        <RouterProvider router={router} />
        <DemoNote />
      </DataContext.Provider>
    </AuthProvider>
  </QueryClientProvider>,
);
