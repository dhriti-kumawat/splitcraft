import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENT_STATS, fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(data = fakeData()) {
  const router = renderApp('/p/trip-demo/experiments', { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Experiments' });
  await screen.findByRole('table');
  return { router, ...data };
}

const row = (name: string) => screen.getByRole('link', { name }).closest('tr')!;

describe('experiments list', () => {
  it('describes the project and counts statuses', async () => {
    await open();
    expect(screen.getByText('5 experiments on mytrips.dev · 2 running now')).toBeInTheDocument();
    const filters = screen.getByRole('group', { name: 'Filter by status' });
    expect(
      within(filters)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['All5', 'Live2', 'Draft1', 'Paused1', 'Ended1']);
  });

  it('shows the worked example on the live test', async () => {
    await open();
    const sticky = row('Sticky Book Now bar');
    expect(within(sticky).getByText('/trips/* · mobile')).toBeInTheDocument();
    expect(within(sticky).getByText('Live')).toBeInTheDocument();
    expect(within(sticky).getByText('24,860')).toBeInTheDocument();
    expect(within(sticky).getByText('Book click')).toBeInTheDocument();
    expect(within(sticky).getByText('+9.7%')).toBeInTheDocument();
    expect(within(sticky).getByText('96%')).toBeInTheDocument();
    expect(within(sticky).getByText('14 days')).toBeInTheDocument();
    expect(within(sticky).getByRole('img', { name: 'B 50%, Control 50%' })).toBeInTheDocument();
    expect(within(sticky).getByRole('link')).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments/sticky/results',
    );
  });

  it('shows dashes for a draft and links it to setup', async () => {
    await open();
    const draft = row('Trust badges under Book button');
    expect(within(draft).getByText('Not started')).toBeInTheDocument();
    expect(within(draft).getAllByText('—')).toHaveLength(3);
    expect(within(draft).getByRole('link')).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments/trust/basics',
    );
  });

  it('marks a losing test in red', async () => {
    await open();
    const ended = row('Urgency banner: “3 spots left”');
    expect(within(ended).getByText('−2.3%')).toHaveClass('down');
    expect(within(ended).getByText('7%')).toBeInTheDocument();
  });

  it('filters by status and search', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Live2' }));
    expect(screen.getByRole('button', { name: 'Live2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('row')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'All5' }));
    await user.type(screen.getByLabelText('Search experiments'), 'price');
    expect(
      screen
        .getAllByRole('row')
        .map((r) => r.querySelector('a')?.textContent)
        .filter(Boolean),
    ).toEqual(['Hero headline: price-led', 'Price summary in checkout']);

    await user.clear(screen.getByLabelText('Search experiments'));
    await user.type(screen.getByLabelText('Search experiments'), 'zzz');
    expect(screen.getByText('No experiments match this filter.')).toBeInTheDocument();
  });

  it('summarises traffic, readiness and health', async () => {
    await open();
    // (6,300 + 6,250 + 3,400 + 3,400) / 7 days
    expect(screen.getByText('2,764')).toBeInTheDocument();
    expect(
      screen.getByText(/Sticky Book Now bar reaches its planned sample in about 2 days\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No sample ratio mismatch in live tests\. Snippet pinged 2 min ago\./),
    ).toBeInTheDocument();
  });

  it('warns about a sample ratio mismatch', async () => {
    const stats = EXPERIMENT_STATS.map((s) =>
      s.experimentId === 'sticky' && s.variantKey === 'b' ? { ...s, visitors: 11_000 } : s,
    );
    await open(fakeData({ stats, lastEventAt: null }));
    expect(
      screen.getByText(
        /Sample ratio mismatch in Sticky Book Now bar\. Check targeting and redirects\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/No events from the snippet yet\./)).toBeInTheDocument();
  });

  it('explains an empty project', async () => {
    renderApp('/p/trip-demo/experiments', { data: fakeData({ experiments: [] }).api });
    expect(
      await screen.findByText('No experiments yet. Create one to start testing.'),
    ).toBeInTheDocument();
  });
});

describe('new experiment', () => {
  it('creates a draft and opens its setup', async () => {
    const user = userEvent.setup();
    const { router, createdExperiments } = await open();
    const opener = within(screen.getByRole('banner')).getByRole('button', {
      name: 'New experiment',
    });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'New experiment' });
    expect(within(dialog).getByLabelText('Name')).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Create draft' }));
    expect(
      within(dialog).getByText('Name the experiment, e.g. "Sticky Book Now bar".'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Name'), 'Free cancellation copy');
    await user.click(within(dialog).getByRole('button', { name: 'Create draft' }));
    expect(createdExperiments).toEqual(['Free cancellation copy']);
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/p/trip-demo/experiments/exp-1/basics'),
    );
  });

  it('closes with Escape and returns focus', async () => {
    const user = userEvent.setup();
    await open();
    const opener = within(screen.getByRole('banner')).getByRole('button', {
      name: 'New experiment',
    });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
