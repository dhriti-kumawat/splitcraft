import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(id = 'trust', data = fakeData()) {
  renderApp(`/p/marketing-site/experiments/${id}/audience`, { data: data.api });
  await screen.findByRole('heading', { name: 'Who can see this test' });
  return data;
}

const saved = (patches: Array<{ id: string; patch: unknown }>) =>
  (patches.at(-1)!.patch as { targeting: Record<string, unknown> }).targeting;

describe('audience step', () => {
  it('is its own step, between Variations and Targeting, starting as everyone', async () => {
    await open();
    const steps = screen.getByRole('navigation', { name: 'Experiment steps' });
    expect(
      within(steps)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining('Basics'),
      expect.stringContaining('Variations'),
      expect.stringContaining('Audience'),
      expect.stringContaining('Targeting'),
      expect.stringContaining('Goals'),
      expect.stringContaining('Results'),
    ]);
    expect(screen.getByRole('radio', { name: /Everyone/ })).toBeChecked();
    expect(screen.queryByRole('heading', { name: 'Saved audiences' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save audience' })).toBeDisabled();
  });

  it('uses saved audiences, matched by all, and keeps pages and triggers as they are', async () => {
    const user = userEvent.setup();
    const { patches } = await open('hero');
    expect(screen.getByRole('radio', { name: /Specific visitors/ })).toBeChecked();
    // Each saved audience shows what it means.
    expect(await screen.findByText('High-intent returners')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add saved audience' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mobile first-timers' }));
    await user.click(screen.getByRole('button', { name: 'All of them' }));
    expect(
      screen.getByText(/^High-intent returners and Mobile first-timers, on pages \//),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(saved(patches)).toEqual({
      who: { mode: 'all', segmentIds: ['seg-returners', 'seg-mobile'] },
      where: { include: [{ op: 'is', value: '/' }] },
    });
  });

  it('builds conditions for this test only, and saves them as a reusable audience', async () => {
    const user = userEvent.setup();
    const data = await open();
    await user.click(screen.getByRole('radio', { name: /Specific visitors/ }));
    const own = screen.getByRole('region', { name: 'Only for this test' });
    await user.click(within(own).getByRole('button', { name: '+ Add group' }));
    await user.selectOptions(
      within(own).getByRole('combobox', { name: 'Audience group 1, condition 1 field' }),
      'Pages viewed this visit',
    );
    await user.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    // Stored with the test, in the same shape a saved audience uses.
    expect(saved(data.patches)).toEqual({
      who: {
        mode: 'any',
        segmentIds: [],
        rules: {
          mode: 'all',
          items: [{ mode: 'all', items: [{ type: 'pages_viewed_session', op: 'gte', value: 2 }] }],
        },
      },
    });
    expect(
      screen.getByText(/^Visitors where pages viewed this visit is at least 2/),
    ).toBeInTheDocument();

    // Promote it: it becomes a saved audience this test (and others) use.
    await user.click(
      within(own).getByRole('button', { name: 'Save as an audience to reuse in other tests' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Save as audience' });
    await user.type(within(dialog).getByRole('textbox'), 'Browsers');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    expect(await screen.findByText(/Saved “Browsers” to Audiences/)).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Saved audiences' });
    expect(within(list).getByText('Browsers')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save audience' }));
    await vi.waitFor(() =>
      expect((saved(data.patches).who as { segmentIds: string[] }).segmentIds).toHaveLength(1),
    );
    expect((saved(data.patches).who as { rules?: unknown }).rules).toBeUndefined();
  });

  it('asks for an audience or a condition when Specific visitors has none', async () => {
    const user = userEvent.setup();
    const { patches } = await open();
    await user.click(screen.getByRole('radio', { name: /Specific visitors/ }));
    await user.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(
      screen.getByText('Add a saved audience or a condition, or choose Everyone.'),
    ).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it('goes back to everyone', async () => {
    const user = userEvent.setup();
    const { patches } = await open('hero');
    await user.click(screen.getByRole('radio', { name: /Everyone/ }));
    await user.click(screen.getByRole('button', { name: 'Save audience' }));
    await vi.waitFor(() => expect(patches).toHaveLength(1));
    expect(saved(patches)).toEqual({ where: { include: [{ op: 'is', value: '/' }] } });
  });

  it('opens Audiences in a new tab to create or edit saved audiences', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await open('hero');
    await user.click(screen.getByRole('button', { name: 'Add saved audience' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create or edit audiences…' }));
    expect(openSpy).toHaveBeenCalledWith('/p/marketing-site/audiences', '_blank', 'noopener');
    openSpy.mockRestore();
  });
});
