import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData, WORKSPACE } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(data = fakeData()) {
  const router = renderApp('/p/marketing-site/settings', { data: data.api });
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
    await user.type(name, 'Marketing site EU');
    const domain = screen.getByLabelText('Main domain');
    await user.clear(domain);
    await user.type(domain, 'https://EU.LarkspurTravel.com/');
    await user.tab();
    expect(domain).toHaveValue('eu.larkspurtravel.com');
    await user.click(screen.getByRole('button', { name: 'Remove localhost:5173' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(save);
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(projectsNow().find((p) => p.id === 'marketing-site')).toMatchObject({
      name: 'Marketing site EU',
      mainDomain: 'eu.larkspurtravel.com',
      allowedDomains: ['staging.larkspurtravel.com'],
    });
  });

  it('validates before saving', async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(screen.getByLabelText('Project name'));
    await user.clear(screen.getByLabelText('Main domain'));
    await user.type(screen.getByLabelText('Main domain'), '*.larkspurtravel.com');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter a project name.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enter a domain like larkspurtravel.com or localhost:3000, without a wildcard.',
      ),
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
      '/p/marketing-site/install',
    );
  });

  it('deletes the project only after typing its name', async () => {
    const user = userEvent.setup();
    const { router, projectsNow } = await open();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Marketing site”?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete project' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Trip demo');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/to confirm/));
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Marketing site');
    await user.click(confirm);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(projectsNow().map((p) => p.id)).not.toContain('marketing-site');
  });

  it('does not let plain members delete', async () => {
    await open(fakeData({ workspaces: [{ ...WORKSPACE, role: 'member' }] }));
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeDisabled();
    expect(
      screen.getByText('Only workspace owners and admins can delete a project.'),
    ).toBeInTheDocument();
  });
});

describe('alerts', () => {
  it('adds a Slack alert, sends a test and removes it', async () => {
    const user = userEvent.setup();
    const { alertsNow, testedAlerts } = await open();
    const section = screen.getByRole('region', { name: 'Alerts' });
    expect(await within(section).findByText('No alerts yet.')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Add alert' }));
    expect(within(section).getByText(/Paste the Slack incoming webhook URL/)).toBeInTheDocument();

    await user.type(
      within(section).getByLabelText('Slack webhook URL'),
      'https://hooks.slack.com/services/T0/B0/secret',
    );
    await user.click(
      within(section).getByRole('checkbox', { name: 'The planned sample is reached' }),
    );
    await user.click(within(section).getByRole('button', { name: 'Add alert' }));
    expect(await within(section).findByText('https://hooks.slack.com/…')).toBeInTheDocument();
    expect(alertsNow()[0]).toMatchObject({
      kind: 'slack',
      events: ['winner_found', 'guardrail_paused'],
    });

    await user.click(within(section).getByRole('button', { name: 'Send a test to Slack alert' }));
    await vi.waitFor(() => expect(testedAlerts).toEqual(['alert-1']));
    expect(
      within(section).getByRole('button', { name: 'Send a test to Slack alert' }),
    ).toHaveTextContent('Sent');

    await user.click(within(section).getByRole('button', { name: 'Remove Slack alert' }));
    expect(await within(section).findByText('No alerts yet.')).toBeInTheDocument();
  });

  it('needs an https webhook URL and at least one alert', async () => {
    const user = userEvent.setup();
    await open();
    const section = screen.getByRole('region', { name: 'Alerts' });
    await user.selectOptions(within(section).getByLabelText('Send to'), 'webhook');
    await user.type(within(section).getByLabelText('Webhook URL'), 'http://x.dev/hook');
    for (const name of [
      'A clear winner on the primary goal',
      'The planned sample is reached',
      'A guardrail paused a test',
    ])
      await user.click(within(section).getByRole('checkbox', { name }));
    await user.click(within(section).getByRole('button', { name: 'Add alert' }));
    expect(within(section).getByText('Enter an https:// URL.')).toBeInTheDocument();
    expect(within(section).getByText('Pick at least one alert.')).toBeInTheDocument();
  });
});
