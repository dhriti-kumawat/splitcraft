import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData, WORKSPACE } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(expId: string, data = fakeData()) {
  const router = renderApp(`/p/trip-demo/experiments/${expId}/basics`, { data: data.api });
  await screen.findByRole('navigation', { name: 'Experiment steps' });
  return { router, ...data };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More actions' }));
  return screen.getByRole('menu', { name: 'More actions' });
}

describe('experiment actions menu', () => {
  it('moves focus with the arrow keys and closes on Escape', async () => {
    const user = userEvent.setup();
    await open('urgency');
    const menu = await openMenu(user);
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Duplicate', 'Archive', 'Delete']);
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(items[2]).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus();
  });

  it('duplicates into a new draft and opens it', async () => {
    const user = userEvent.setup();
    const { router, experimentsNow } = await open('sticky');
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/p/trip-demo/experiments/sticky-copy/basics'),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sticky Book Now bar (copy)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(experimentsNow()[0]).toMatchObject({ id: 'sticky-copy', status: 'draft' });
  });

  it('archives a stopped experiment and unarchives it', async () => {
    const user = userEvent.setup();
    await open('urgency');
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Archive' }));
    expect(await screen.findByText('Archived')).toBeInTheDocument();
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Unarchive' }));
    await waitFor(() => expect(screen.queryByText('Archived')).not.toBeInTheDocument());
  });

  it('hides Resume on an archived paused experiment', async () => {
    const price = EXPERIMENTS.find((e) => e.id === 'price')!;
    const data = fakeData({
      experiments: EXPERIMENTS.map((e) =>
        e.id === 'price' ? { ...price, archivedAt: '2026-09-20T10:00:00Z' } : e,
      ),
    });
    await open('price', data);
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
  });

  it("won't archive or delete a live experiment", async () => {
    const user = userEvent.setup();
    const { patches } = await open('sticky');
    const menu = await openMenu(user);
    const archive = within(menu).getByRole('menuitem', { name: /Archive/ });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    expect(archive).toHaveTextContent('End or pause it first.');
    await user.click(archive);
    expect(within(menu).getByRole('menuitem', { name: /Delete/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(patches).toEqual([]);
  });

  it('deletes after confirming and returns to the list', async () => {
    const user = userEvent.setup();
    const { router, experimentsNow } = await open('urgency');
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Urgency banner: “3 spots left””?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep experiment' }));
    expect(experimentsNow().some((e) => e.id === 'urgency')).toBe(true);

    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete experiment' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/trip-demo/experiments'));
    expect(experimentsNow().some((e) => e.id === 'urgency')).toBe(false);
  });

  it('only lets owners and admins delete', async () => {
    const user = userEvent.setup();
    await open('urgency', fakeData({ workspaces: [{ ...WORKSPACE, role: 'member' }] }));
    const del = within(await openMenu(user)).getByRole('menuitem', { name: /Delete/ });
    expect(del).toHaveAttribute('aria-disabled', 'true');
    expect(del).toHaveTextContent('Only workspace owners and admins can delete.');
  });
});

describe('automatic pause', () => {
  it('explains why a crossed guardrail paused the experiment', async () => {
    const price = EXPERIMENTS.find((e) => e.id === 'price')!;
    await open(
      'price',
      fakeData({
        experiments: EXPERIMENTS.map((e) =>
          e.id === 'price'
            ? {
                ...price,
                autoPaused: {
                  at: '2026-09-28T10:00:00Z',
                  metricId: 'm-purchase',
                  variantKey: 'b',
                  uplift: -0.4,
                  upliftLow: -0.637,
                  upliftHigh: -0.163,
                  maxPct: 2,
                },
              }
            : e,
        ),
      }),
    );
    expect(
      await screen.findByText(
        /Purchase in B changed −40\.0% \(95% range −63\.7% to −16\.3%\), past its 2% limit/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Paused automatically on 28 Sept.')).toBeInTheDocument();
  });
});
