import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Button } from '../components/Button';
import { WorkspaceProvider } from '../data/WorkspaceProvider';
import { routes } from '../router';
import { AppShell } from './AppShell';
import { TopBarActions } from './TopBarActions';

function renderAt(path: string, routeList = routes) {
  const router = createMemoryRouter(routeList, { initialEntries: [path] });
  render(
    <WorkspaceProvider>
      <RouterProvider router={router} />
    </WorkspaceProvider>,
  );
  return router;
}

const breadcrumb = () =>
  within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('routing', () => {
  it('redirects / to /projects', () => {
    const router = renderAt('/');
    expect(router.state.location.pathname).toBe('/projects');
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('redirects a project root to its experiments', () => {
    const router = renderAt('/p/trip-demo');
    expect(router.state.location.pathname).toBe('/p/trip-demo/experiments');
  });

  it('shows a not-found page for unknown paths and unknown projects', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: "This page doesn't exist" })).toBeInTheDocument();
    screen.getByRole('link', { name: 'Go to Projects' });
  });

  it('shows a project not-found page inside the shell', () => {
    renderAt('/p/unknown/experiments');
    expect(screen.getByRole('heading', { name: "This project doesn't exist" })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });
});

describe('breadcrumb', () => {
  it('shows workspace / page, with the last item as the current page', () => {
    renderAt('/projects');
    expect(breadcrumb()).toEqual(["Dhriti's Workspace", 'Projects']);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Projects')).toHaveAttribute('aria-current', 'page');
  });

  it('includes the project and section on project pages', () => {
    renderAt('/p/trip-demo/metrics/new');
    expect(breadcrumb()).toEqual(["Dhriti's Workspace", 'Trip Demo', 'Metrics', 'New metric']);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Trip Demo' })).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments',
    );
  });
});

describe('sidebar', () => {
  it('shows workspace navigation and hides the project section outside a project', () => {
    renderAt('/projects');
    const workspaceNav = screen.getByRole('navigation', { name: 'Workspace' });
    expect(within(workspaceNav).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByText('Current project')).not.toBeInTheDocument();
  });

  it('shows the current project and marks the active section', () => {
    renderAt('/p/trip-demo/audiences');
    const projectNav = screen.getByRole('navigation', { name: 'Current project' });
    const links = within(projectNav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(links).toEqual(['Experiments', 'Audiences', 'Metrics', 'Install', 'Settings']);
    expect(within(projectNav).getByRole('link', { name: 'Audiences' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Switch project: Trip Demo' })).toBeInTheDocument();
  });

  it('shows event usage as a meter', () => {
    renderAt('/projects');
    const meter = screen.getByRole('meter', { name: 'Events this month' });
    expect(meter).toHaveAttribute('aria-valuenow', '48210');
    expect(meter).toHaveAttribute('aria-valuemax', '100000');
    expect(screen.getByText('48,210')).toBeInTheDocument();
  });

  it('shows the signed-in user', () => {
    renderAt('/projects');
    expect(screen.getByText('Dhriti Kumawat')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
  });
});

describe('project switcher', () => {
  it('opens, lists projects and navigates to the chosen one', async () => {
    const user = userEvent.setup();
    const router = renderAt('/p/trip-demo/experiments');
    const button = screen.getByRole('button', { name: 'Switch project: Trip Demo' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = within(document.getElementById(button.getAttribute('aria-controls')!)!);
    expect(panel.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Trip Demomytrips.dev',
      'Checkout Labshoplab.dev',
      'Portfoliodhriti.dev',
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
    renderAt('/p/trip-demo/experiments');
    const button = screen.getByRole('button', { name: 'Switch project: Trip Demo' });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    renderAt('/p/trip-demo/experiments');
    const button = screen.getByRole('button', { name: 'Switch project: Trip Demo' });
    await user.click(button);
    await user.click(screen.getByRole('main'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('top bar actions', () => {
  it('renders page actions into the top bar', () => {
    renderAt('/demo', [
      {
        element: <AppShell />,
        children: [
          {
            path: 'demo',
            element: (
              <TopBarActions>
                <Button>New project</Button>
              </TopBarActions>
            ),
          },
        ],
      },
    ]);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: 'New project' })).toBeInTheDocument();
  });
});

describe('accessibility basics', () => {
  it('has a skip link to the main content', () => {
    renderAt('/projects');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
