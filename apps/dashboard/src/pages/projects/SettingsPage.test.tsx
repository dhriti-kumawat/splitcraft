import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData, WORKSPACE } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(data = fakeData()) {
  const router = renderApp('/p/trip-demo/settings', { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  return { router, ...data };
}

describe('project settings', () => {
  it('edits and saves the name and domains', async () => {
    const user = userEvent.setup();
    const { projectsNow } = await open();
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();

    const name = screen.getByLabelText('Project name');
    await user.clear(name);
    await user.type(name, 'Trip Demo EU');
    const domain = screen.getByLabelText('Main domain');
    await user.clear(domain);
    await user.type(domain, 'https://EU.MyTrips.dev/');
    await user.tab();
    expect(domain).toHaveValue('eu.mytrips.dev');
    await user.click(screen.getByRole('button', { name: 'Remove localhost:5173' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(save);
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(projectsNow().find((p) => p.id === 'trip-demo')).toMatchObject({
      name: 'Trip Demo EU',
      mainDomain: 'eu.mytrips.dev',
      allowedDomains: ['staging.mytrips.dev'],
    });
  });

  it('validates before saving', async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(screen.getByLabelText('Project name'));
    await user.clear(screen.getByLabelText('Main domain'));
    await user.type(screen.getByLabelText('Main domain'), '*.mytrips.dev');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter a project name.')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a domain like mytrips.dev or localhost:3000, without a wildcard.'),
    ).toBeInTheDocument();
  });

  it('shows and copies the public key and the install status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open();
    const key = screen.getByLabelText('Public key');
    expect(key.textContent).toMatch(/^prj_/);
    await user.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(writeText).toHaveBeenCalledWith(key.textContent);
    expect(screen.getByText(/Live since 1 Sept 2026|Live since 1 Sep 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View install code' })).toHaveAttribute(
      'href',
      '/p/trip-demo/install',
    );
  });

  it('deletes the project only after typing its name', async () => {
    const user = userEvent.setup();
    const { router, projectsNow } = await open();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Trip Demo”?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete project' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Trip demo');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/to confirm/));
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Trip Demo');
    await user.click(confirm);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(projectsNow().map((p) => p.id)).not.toContain('trip-demo');
  });

  it('does not let plain members delete', async () => {
    await open(fakeData({ workspaces: [{ ...WORKSPACE, role: 'member' }] }));
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeDisabled();
    expect(
      screen.getByText('Only workspace owners and admins can delete a project.'),
    ).toBeInTheDocument();
  });
});
