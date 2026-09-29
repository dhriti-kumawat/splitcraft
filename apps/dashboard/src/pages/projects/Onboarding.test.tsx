import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData, PROJECTS } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(data = fakeData()) {
  renderApp('/projects', { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  return data;
}

const checklist = () => screen.findByRole('region', { name: 'Get your first test live' });

beforeEach(() => localStorage.clear());

describe('onboarding checklist', () => {
  it('starts a new workspace at "Create a project"', async () => {
    const user = userEvent.setup();
    await open(fakeData({ projects: [], experiments: [] }));
    const card = await checklist();
    expect(within(card).getByText('0 of 5 done · about 10 minutes')).toBeInTheDocument();
    const current = within(card)
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('aria-current'));
    expect(current).toHaveTextContent('Create a project');
    await user.click(within(card).getByRole('button', { name: 'New project' }));
    expect(await screen.findByRole('heading', { name: 'New project' })).toBeInTheDocument();
  });

  it('ticks off steps from real data and points at the next one', async () => {
    const draftOnly = EXPERIMENTS.filter((e) => e.id === 'trust');
    await open(
      fakeData({
        projects: PROJECTS.map((p) => ({
          ...p,
          installedAt: p.id === 'trip-demo' ? p.installedAt : null,
        })),
        experiments: draftOnly,
      }),
    );
    const card = await checklist();
    expect(within(card).getByText('3 of 5 done · about 10 minutes')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Open experiment' })).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments/trust/variants',
    );
  });

  it('hides for good when asked, and when everything is done', async () => {
    const user = userEvent.setup();
    const data = fakeData({ projects: [], experiments: [] });
    await open(data);
    await user.click(within(await checklist()).getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('region', { name: 'Get your first test live' })).toBeNull();
    expect(localStorage.getItem('splitcraft_onboarding_hidden_ws_1')).toBe('1');

    localStorage.clear();
    await open();
    expect(screen.queryByRole('region', { name: 'Get your first test live' })).toBeNull();
  });
});
