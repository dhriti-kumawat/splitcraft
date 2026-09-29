import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DHRITI, fakeAuth } from '../../test/fakeAuth';
import { fakeData, WORKSPACE } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function openTeam(data = fakeData()) {
  const router = renderApp('/team', { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Team' });
  await screen.findByText('dhriti@mytrips.dev');
  return { router, ...data };
}

const row = (email: string) => screen.getByText(email).closest('tr')!;

describe('team', () => {
  it('lists members with roles and marks you', async () => {
    await openTeam();
    expect(within(row('dhriti@mytrips.dev')).getByText('You')).toBeInTheDocument();
    expect(within(row('max@mytrips.dev')).getByText('max')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for ada@mytrips.dev' })).toHaveValue('admin');
  });

  it('changes a role and removes a member', async () => {
    const user = userEvent.setup();
    const { peopleNow } = await openTeam();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role for max@mytrips.dev' }),
      'Admin',
    );
    await vi.waitFor(() =>
      expect(peopleNow().find((p) => p.email === 'max@mytrips.dev')!.role).toBe('admin'),
    );
    await user.click(screen.getByRole('button', { name: 'Remove ada@mytrips.dev' }));
    await vi.waitFor(() => expect(screen.queryByText('ada@mytrips.dev')).not.toBeInTheDocument());
  });

  it('creates an invite link and lists it until revoked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await openTeam();
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));
    expect(screen.getByText('Enter the email address they will log in with.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'New@Team.dev');
    await user.selectOptions(screen.getByLabelText('Role'), 'Admin');
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Link for new@team.dev');
    expect(status).toHaveTextContent('/invite/00000000-0000-0000-0000-000000000001');
    await user.click(within(status).getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/invite\/00000000-0000-0000-0000-000000000001$/),
    );

    const pending = await screen.findByRole('table', { name: 'Pending invites' });
    expect(within(pending).getByText('new@team.dev')).toBeInTheDocument();
    await user.click(
      within(pending).getByRole('button', { name: 'Revoke invite for new@team.dev' }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole('table', { name: 'Pending invites' })).not.toBeInTheDocument(),
    );
  });

  it('is read-only for members', async () => {
    await openTeam(fakeData({ workspaces: [{ ...WORKSPACE, role: 'member' }] }));
    expect(screen.queryByRole('combobox', { name: /Role for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Invite people' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('shows why a role change failed', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    data.api.setRole = async () => {
      throw new Error('Only an owner can change or remove an owner.');
    };
    await openTeam(data);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role for ada@mytrips.dev' }),
      'Member',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only an owner can change or remove an owner.',
    );
  });

  it('leaves the workspace after confirming', async () => {
    const user = userEvent.setup();
    const other = {
      id: 'ws_2',
      name: 'Agency Clients',
      plan: 'free' as const,
      role: 'member' as const,
    };
    const { router, peopleNow } = await openTeam(fakeData({ workspaces: [WORKSPACE, other] }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    const dialog = screen.getByRole('dialog', { name: `Leave ${WORKSPACE.name}?` });
    await user.click(within(dialog).getByRole('button', { name: 'Leave workspace' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(peopleNow().some((p) => p.userId === 'u_1')).toBe(false);
  });
});

describe('workspace settings', () => {
  it('renames the workspace', async () => {
    const user = userEvent.setup();
    const { workspacesNow } = fakeData();
    const data = fakeData();
    renderApp('/workspace', { data: data.api });
    const input = await screen.findByLabelText('Workspace name');
    await user.clear(input);
    await user.type(input, 'Trips Inc');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(data.workspacesNow()[0]!.name).toBe('Trips Inc'));
    expect(workspacesNow()[0]!.name).toBe("Dhriti's Workspace");
  });

  it('deletes the workspace after typing its name', async () => {
    const user = userEvent.setup();
    const other = {
      id: 'ws_2',
      name: 'Agency Clients',
      plan: 'free' as const,
      role: 'owner' as const,
    };
    const data = fakeData({ workspaces: [WORKSPACE, other] });
    renderApp('/workspace', { data: data.api });
    await user.click(await screen.findByRole('button', { name: 'Delete workspace' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete workspace' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), WORKSPACE.name);
    await user.click(confirm);
    await vi.waitFor(() => expect(data.workspacesNow().map((w) => w.id)).toEqual(['ws_2']));
  });

  it('is read-only for non-owners', async () => {
    renderApp('/workspace', {
      data: fakeData({ workspaces: [{ ...WORKSPACE, role: 'admin' }] }).api,
    });
    expect(await screen.findByLabelText('Workspace name')).toBeDisabled();
    expect(screen.getByText('Only owners can rename the workspace.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete workspace' })).toBeDisabled();
  });

  it('creates a new workspace from the switcher and switches to it', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    renderApp('/projects', { data: data.api });
    await user.click(await screen.findByRole('button', { name: /Switch workspace/ }));
    await user.click(screen.getByRole('button', { name: '+ New workspace' }));
    await user.type(screen.getByLabelText('Name'), 'Side project');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(
      await screen.findByRole('button', { name: 'Switch workspace: Side project' }),
    ).toBeInTheDocument();
  });

  it('offers to create a workspace when you have none', async () => {
    renderApp('/projects', { data: fakeData({ workspaces: [] }).api });
    expect(await screen.findByRole('heading', { name: 'No workspace yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a workspace' })).toBeInTheDocument();
  });
});

describe('invite page', () => {
  const TOKEN = '11111111-1111-1111-1111-111111111111';

  async function openInvite(data = fakeData(), signedInAs = DHRITI) {
    const auth = fakeAuth({ signedIn: true });
    auth.api.getUser = async () => signedInAs;
    const router = renderApp(`/invite/${TOKEN}`, { data: data.api, api: auth.api });
    await screen.findByRole('heading', { level: 1 });
    return { router, auth };
  }

  it('joins the workspace and opens it', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    data.seedInvite(TOKEN, { email: DHRITI.email, role: 'admin' });
    const { router } = await openInvite(data);
    expect(screen.getByRole('heading', { name: 'Join Agency Clients' })).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Join Agency Clients' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(localStorage.getItem('splitly_workspace')).toBe('ws_joined');
    localStorage.removeItem('splitly_workspace');
  });

  it('explains an invite for another email', async () => {
    const data = fakeData();
    data.seedInvite(TOKEN, { email: 'someone@else.dev' });
    await openInvite(data);
    expect(
      screen.getByRole('heading', { name: 'This invite is for someone@else.dev' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a different account' })).toBeInTheDocument();
  });

  it('explains invalid, expired and used invites', async () => {
    await openInvite();
    expect(
      screen.getByRole('heading', { name: "This invite link isn't valid" }),
    ).toBeInTheDocument();
  });

  it('explains an expired invite', async () => {
    const data = fakeData();
    data.seedInvite(TOKEN, { email: DHRITI.email, expiresAt: '2020-01-01T00:00:00Z' });
    await openInvite(data);
    expect(screen.getByRole('heading', { name: 'This invite has expired' })).toBeInTheDocument();
  });
});
