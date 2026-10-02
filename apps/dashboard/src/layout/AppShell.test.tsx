import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/Button';
import { RequireAuth } from '../auth/RequireAuth';
import { WorkspaceProvider } from '../data/WorkspaceProvider';
import { fakeData } from '../test/fakeData';
import { renderApp } from '../test/renderApp';
import { AppShell } from './AppShell';
import { TopBarActions } from './TopBarActions';

// Pages render after the async session check; wait for the shell before querying.
async function renderAt(
  path: string,
  routeList?: NonNullable<Parameters<typeof renderApp>[1]>['routeList'],
) {
  const router = renderApp(path, { routeList });
  await screen.findByRole('complementary', { name: 'Sidebar' });
  return router;
}

const breadcrumb = () =>
  within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('routing', () => {
  it('links to the docs and the website from the sidebar', async () => {
    renderApp('/projects');
    const nav = await screen.findByRole('navigation', { name: 'Splitcraft site' });
    expect(within(nav).getByRole('link', { name: /Documentation/ })).toHaveAttribute(
      'href',
      'https://splitcraft.vercel.app/docs/',
    );
    expect(within(nav).getByRole('link', { name: /Splitcraft website/ })).toHaveAttribute(
      'href',
      'https://splitcraft.vercel.app/',
    );
  });

  it('redirects / to /projects', async () => {
    const router = await renderAt('/');
    expect(router.state.location.pathname).toBe('/projects');
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('redirects a project root to its experiments', async () => {
    const router = await renderAt('/p/trip-demo');
    expect(router.state.location.pathname).toBe('/p/trip-demo/experiments');
  });

  it('shows a not-found page for unknown paths and unknown projects', async () => {
    await renderAt('/nope');
    expect(screen.getByRole('heading', { name: "This page doesn't exist" })).toBeInTheDocument();
    screen.getByRole('link', { name: 'Go to Projects' });
  });

  it('shows a project not-found page inside the shell', async () => {
    await renderAt('/p/unknown/experiments');
    expect(screen.getByRole('heading', { name: "This project doesn't exist" })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });
});

describe('breadcrumb', () => {
  it('shows workspace / page, with the last item as the current page', async () => {
    await renderAt('/projects');
    expect(breadcrumb()).toEqual(['Northwind Travel', 'Projects']);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Projects')).toHaveAttribute('aria-current', 'page');
  });

  it('includes the project and section on project pages', async () => {
    await renderAt('/p/trip-demo/metrics/new');
    expect(breadcrumb()).toEqual(['Northwind Travel', 'Trip Demo', 'Metrics', 'New metric']);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Trip Demo' })).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments',
    );
  });
});

describe('name breadcrumbs', () => {
  it('shows the experiment name', async () => {
    await renderAt('/p/trip-demo/experiments/trust/basics');
    await waitFor(() =>
      expect(breadcrumb()).toEqual([
        'Northwind Travel',
        'Trip Demo',
        'Experiments',
        'Trust badges under Book button',
      ]),
    );
  });

  it('shows the segment name', async () => {
    await renderAt('/p/trip-demo/audiences/seg-mobile');
    await waitFor(() => expect(breadcrumb().at(-1)).toBe('Mobile first-timers'));
    expect(breadcrumb()).toEqual([
      'Northwind Travel',
      'Trip Demo',
      'Audiences',
      'Mobile first-timers',
    ]);
  });

  it('shows the metric name', async () => {
    await renderAt('/p/trip-demo/metrics/m-book');
    await waitFor(() => expect(breadcrumb().at(-1)).toBe('Book click'));
  });
});

describe('sidebar', () => {
  it('shows workspace navigation and hides the project section outside a project', async () => {
    await renderAt('/projects');
    const workspaceNav = screen.getByRole('navigation', { name: 'Workspace' });
    expect(within(workspaceNav).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByText('Current project')).not.toBeInTheDocument();
  });

  it('shows the current project and marks the active section', async () => {
    await renderAt('/p/trip-demo/audiences');
    const projectNav = screen.getByRole('navigation', { name: 'Current project' });
    const links = within(projectNav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(links).toEqual([
      'Experiments',
      'Audiences',
      'Metrics',
      'Feature flags',
      'Install',
      'Settings',
    ]);
    expect(within(projectNav).getByRole('link', { name: 'Audiences' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Switch project: Trip Demo' })).toBeInTheDocument();
  });

  it('shows event usage as a meter', async () => {
    await renderAt('/projects');
    const meter = await screen.findByRole('meter', { name: 'Events this month' });
    expect(meter).toHaveAttribute('aria-valuenow', '48210');
    expect(meter).toHaveAttribute('aria-valuemax', '100000');
    expect(screen.getByText('48,210')).toBeInTheDocument();
  });

  it('says when the monthly event limit is reached', async () => {
    const data = fakeData();
    data.api.eventsThisMonth = async () => 100_000;
    renderApp('/projects', { data: data.api });
    expect(
      await screen.findByText(
        /Limit reached\. Experiments are paused and events aren't stored until/,
      ),
    ).toBeInTheDocument();
  });

  it('shows the signed-in user', async () => {
    await renderAt('/projects');
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
  });
});

describe('project switcher', () => {
  it('opens, lists projects and navigates to the chosen one', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/p/trip-demo/experiments');
    const button = screen.getByRole('button', { name: 'Switch project: Trip Demo' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = within(document.getElementById(button.getAttribute('aria-controls')!)!);
    expect(panel.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Trip Demomytrips.dev',
      'Checkout Labshoplab.dev',
      'Portfolioalexmorgan.dev',
    ]);
    expect(panel.getByRole('link', { name: /^Trip Demo/ })).toHaveAttribute('aria-current', 'true');

    await user.click(panel.getByRole('link', { name: /^Checkout Lab/ }));
    expect(router.state.location.pathname).toBe('/p/checkout-lab/experiments');
    expect(screen.getByRole('button', { name: 'Switch project: Checkout Lab' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    await renderAt('/p/trip-demo/experiments');
    const button = screen.getByRole('button', { name: 'Switch project: Trip Demo' });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    await renderAt('/p/trip-demo/experiments');
    const button = screen.getByRole('button', { name: 'Switch project: Trip Demo' });
    await user.click(button);
    await user.click(screen.getByRole('main'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('top bar actions', () => {
  it('renders page actions into the top bar', async () => {
    await renderAt('/demo', [
      {
        element: (
          <RequireAuth>
            <WorkspaceProvider>
              <AppShell />
            </WorkspaceProvider>
          </RequireAuth>
        ),
        children: [
          {
            path: 'demo',
            element: (
              <TopBarActions>
                <Button>Export</Button>
              </TopBarActions>
            ),
          },
        ],
      },
    ]);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});

describe('accessibility basics', () => {
  it('has a skip link to the main content', async () => {
    await renderAt('/projects');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
