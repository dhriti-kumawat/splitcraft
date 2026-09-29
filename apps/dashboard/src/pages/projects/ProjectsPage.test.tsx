import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DataApi } from '../../data/api';
import { fakeData, WORKSPACE } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function openProjects(data = fakeData()) {
  const router = renderApp('/projects', { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  return { router, ...data };
}

const card = (name: string) => screen.getByRole('article', { name });

describe('projects grid', () => {
  it('shows each project with status, stats and domains', async () => {
    await openProjects();
    const trip = card('Trip Demo');
    expect(within(trip).getByText('Snippet live')).toBeInTheDocument();
    expect(within(trip).getByText('mytrips.dev', { selector: '.mono' })).toBeInTheDocument();
    expect(await within(trip).findByText('56.4k')).toBeInTheDocument();
    expect(within(trip).getByText('Visitors, 30d')).toBeInTheDocument();
    expect(within(trip).getByText('2')).toBeInTheDocument();
    expect(within(trip).getByText('localhost:5173')).toBeInTheDocument();
    expect(within(trip).getByRole('link', { name: 'Trip Demo' })).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments',
    );
  });

  it('uses the singular for one live test', async () => {
    await openProjects();
    expect(await within(card('Checkout Lab')).findByText('Live test')).toBeInTheDocument();
  });

  it('shows "No winner yet" until results exist', async () => {
    await openProjects();
    expect(within(card('Trip Demo')).getByText('No winner yet')).toBeInTheDocument();
  });

  it('shows install steps for a project that has not pinged yet', async () => {
    await openProjects();
    const portfolio = card('Portfolio');
    expect(within(portfolio).getByText('Not installed')).toBeInTheDocument();
    expect(within(portfolio).getByText('Waiting for the first ping')).toBeInTheDocument();
    expect(within(portfolio).getByRole('link', { name: 'View install steps' })).toHaveAttribute(
      'href',
      '/p/portfolio/install',
    );
  });

  it('offers only the New project card when the workspace is empty', async () => {
    await openProjects(fakeData({ projects: [] }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Website, web app or staging copy/ }),
    ).toBeInTheDocument();
  });
});

describe('new project drawer', () => {
  async function openDrawer(data = fakeData()) {
    const user = userEvent.setup();
    const ctx = await openProjects(data);
    await user.click(
      within(screen.getByRole('banner')).getByRole('button', { name: 'New project' }),
    );
    const drawer = screen.getByRole('complementary', { name: 'New project' });
    return { user, drawer, ...ctx };
  }

  it('opens from the top bar with focus in the name field, and closes with Escape', async () => {
    const { user, drawer } = await openDrawer();
    expect(within(drawer).getByText('Step 1 of 2 · Details')).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Project name')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'New project' })).not.toBeInTheDocument();
  });

  it('validates name and domain', async () => {
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole('button', { name: 'Create project' }));
    expect(within(drawer).getByText('Enter a project name.')).toBeInTheDocument();
    expect(
      within(drawer).getByText("Enter your site's domain, like mytrips.dev."),
    ).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Project name')).toHaveAttribute('aria-invalid', 'true');

    await user.type(within(drawer).getByLabelText('Main domain'), '*.mytrips.dev');
    expect(
      within(drawer).getByText(
        'Enter a domain like mytrips.dev or localhost:3000, without a wildcard.',
      ),
    ).toBeInTheDocument();
  });

  it('adds and removes allowed domains as chips, rejecting invalid ones', async () => {
    const { user, drawer } = await openDrawer();
    const input = within(drawer).getByLabelText('Also allow on');
    await user.type(
      input,
      'https://Staging.alexmorgan.dev/{Enter}localhost:3000,*.vercel.app{Enter}',
    );
    expect(within(drawer).getByText('staging.alexmorgan.dev')).toBeInTheDocument();
    expect(within(drawer).getByText('localhost:3000')).toBeInTheDocument();
    expect(within(drawer).getByText('*.vercel.app')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Remove localhost:3000' }));
    expect(within(drawer).queryByText('localhost:3000')).not.toBeInTheDocument();

    await user.type(input, 'not a domain{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(
      within(drawer).getByText(
        'Enter a domain like shop.example.com, localhost:3000 or *.example.com.',
      ),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.keyboard('{Backspace}');
    expect(within(drawer).queryByText('*.vercel.app')).not.toBeInTheDocument();
  });

  it('creates the project, then shows the install code and waits for the first ping', async () => {
    const { user, drawer, created, receiveFirstPing } = await openDrawer();
    await user.type(within(drawer).getByLabelText('Project name'), 'Portfolio 2');
    await user.type(
      within(drawer).getByLabelText('Main domain'),
      'https://www.alexmorgan.dev/about',
    );
    await user.type(within(drawer).getByLabelText('Also allow on'), 'localhost:3000{Enter}');
    await user.click(within(drawer).getByRole('button', { name: 'Create project' }));

    const step2 = await screen.findByRole('complementary', { name: 'Portfolio 2' });
    expect(created).toEqual([
      {
        workspaceId: WORKSPACE.id,
        name: 'Portfolio 2',
        mainDomain: 'www.alexmorgan.dev',
        allowedDomains: ['localhost:3000'],
      },
    ]);
    expect(within(step2).getByText('Step 2 of 2 · Install')).toBeInTheDocument();
    const code = within(step2).getByLabelText('Install code');
    expect(code.textContent).toContain('data-project="prj_new1');
    expect(within(step2).getByRole('status')).toHaveTextContent('Listening for first ping…');
    expect(within(step2).getByRole('link', { name: 'Open project' })).toHaveAttribute(
      'href',
      '/p/new-1/experiments',
    );

    receiveFirstPing();
    expect(
      await within(step2).findByText('Snippet live: first ping received', {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    // The new card in the grid updates too.
    expect(
      await within(await screen.findByRole('article', { name: 'Portfolio 2' })).findByText(
        'Snippet live',
      ),
    ).toBeInTheDocument();
  }, 10_000);

  it('shows an error when creating fails', async () => {
    const data = fakeData();
    data.api.createProject = (async () => {
      throw new Error('duplicate key value');
    }) as DataApi['createProject'];
    const { user, drawer } = await openDrawer(data);
    await user.type(within(drawer).getByLabelText('Project name'), 'X');
    await user.type(within(drawer).getByLabelText('Main domain'), 'x.dev');
    await user.click(within(drawer).getByRole('button', { name: 'Create project' }));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      "Couldn't create the project: duplicate key value",
    );
  });
});

describe('install tabs', () => {
  it('switch between targets with clicks and arrow keys, and copy the code', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderApp('/p/portfolio/install');
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    const html = screen.getByRole('tab', { name: 'HTML' });
    expect(html).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Install code').textContent).toContain('<script');

    await user.click(screen.getByRole('tab', { name: 'Next.js' }));
    expect(screen.getByLabelText('Install code').textContent).toContain(
      'strategy="beforeInteractive"',
    );

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'React' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'React' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'HTML' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(screen.getByLabelText('Install code').textContent);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Listening for first ping…');
  });
});

describe('workspaces', () => {
  it('switch workspace from the sidebar', async () => {
    const user = userEvent.setup();
    const other = {
      id: 'ws_2',
      name: 'Agency Clients',
      plan: 'free' as const,
      role: 'member' as const,
    };
    const data = fakeData({ workspaces: [WORKSPACE, other] });
    await openProjects(data);
    expect(screen.getByRole('article', { name: 'Trip Demo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch workspace: Northwind Travel' }));
    await user.click(screen.getByRole('link', { name: 'Agency Clients' }));
    expect(
      await screen.findByRole('button', { name: 'Switch workspace: Agency Clients' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('asks owners to name a workspace that still has a default name', async () => {
    const user = userEvent.setup();
    const data = fakeData({ workspaces: [{ ...WORKSPACE, name: "Jo's Workspace" }] });
    renderApp('/projects', { data: data.api });
    await screen.findByRole('heading', { name: 'Give your workspace a name' });
    await user.type(screen.getByLabelText('Workspace name'), 'Northwind Travel');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Give your workspace a name' })).toBeNull(),
    );
    expect(data.workspacesNow()[0]!.name).toBe('Northwind Travel');
  });

  it("doesn't ask non-owners to name the workspace", async () => {
    renderApp('/projects', {
      data: fakeData({ workspaces: [{ ...WORKSPACE, name: 'My workspace', role: 'member' }] }).api,
    });
    await screen.findByRole('heading', { level: 1, name: 'Projects' });
    expect(screen.queryByRole('heading', { name: 'Give your workspace a name' })).toBeNull();
  });

  it('explains when the account has no workspace', async () => {
    renderApp('/projects', { data: fakeData({ workspaces: [] }).api });
    expect(
      await screen.findByRole('heading', { name: 'Set up a workspace to start testing' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create a workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Join with an invite' })).toBeInTheDocument();
  });

  it('opens an invite pasted on the no-workspace screen', async () => {
    const user = userEvent.setup();
    const router = renderApp('/projects', { data: fakeData({ workspaces: [] }).api });
    const input = await screen.findByLabelText('Invite link');
    await user.click(screen.getByRole('button', { name: 'Open invite' }));
    expect(screen.getByText('Paste the whole invite link your teammate sent.')).toBeInTheDocument();
    await user.type(input, 'https://app.example/invite/11111111-1111-1111-1111-111111111111');
    await user.click(screen.getByRole('button', { name: 'Open invite' }));
    expect(router.state.location.pathname).toBe('/invite/11111111-1111-1111-1111-111111111111');
  });

  it('explains when loading fails', async () => {
    const data = fakeData();
    data.api.listWorkspaces = async () => {
      throw new Error('JWT expired');
    };
    renderApp('/projects', { data: data.api });
    expect(
      await screen.findByRole('heading', { name: "Couldn't load your workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/JWT expired/)).toBeInTheDocument();
  });
});

describe('best uplift and recent activity', () => {
  it('shows the best clear uplift on a project card', async () => {
    await openProjects();
    const trip = screen.getByRole('article', { name: 'Trip Demo' });
    expect(await within(trip).findByText('+9.7%')).toBeInTheDocument();
    expect(within(trip).getByText('Best uplift')).toBeInTheDocument();
    const lab = screen.getByRole('article', { name: 'Checkout Lab' });
    expect(within(lab).getByText('No winner yet')).toBeInTheDocument();
  });

  it('lists recent activity with links and project names', async () => {
    await openProjects();
    const panel = await screen.findByRole('region', { name: 'Recent activity' });
    const launched = await within(panel).findByRole('link', {
      name: '“Sticky Book Now bar” launched',
    });
    expect(launched).toHaveAttribute('href', '/p/trip-demo/experiments/sticky');
    expect(within(panel).getByText('Trip Demo · 12 min ago')).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: 'Audience “High-intent returners” edited' }),
    ).toHaveAttribute('href', '/p/trip-demo/audiences/seg-returners');
  });

  it('explains an empty activity feed', async () => {
    await openProjects(fakeData({ activity: [] }));
    expect(
      await screen.findByText(
        'Nothing yet. Create a project, then experiments and audiences show up here.',
      ),
    ).toBeInTheDocument();
  });
});
