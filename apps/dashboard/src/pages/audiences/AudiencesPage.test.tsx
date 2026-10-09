import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';
import { fromGroups, toGroups } from '../../lib/segments';

async function open(path = '/p/marketing-site/audiences', data = fakeData()) {
  const router = renderApp(path, { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Audiences' });
  await screen.findByRole('link', { name: /High-intent returners/ });
  return { router, ...data };
}

describe('audiences', () => {
  it('lists saved segments with how many live tests use them', async () => {
    await open();
    const nav = screen.getByRole('navigation', { name: 'Saved segments' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['High-intent returners1 test', 'Mobile first-timers']);
    expect(screen.getByText('Pick a segment, or create a new one.')).toBeInTheDocument();
  });

  it('shows a segment in plain words and saves edits', async () => {
    const user = userEvent.setup();
    const { segmentsNow } = await open('/p/marketing-site/audiences/seg-returners');
    expect(
      screen.getByText(
        'Returning visitors and viewed pages matching /trips/* at least 3 times in 7 days.',
      ),
    ).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save segment' });
    expect(save).toBeDisabled();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Segment group 1, condition 1 value' }),
      'New visitor',
    );
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(save);
    expect(
      await screen.findByText('Saved. Live experiments use it from the next page load.'),
    ).toBeInTheDocument();
    expect(segmentsNow()[0]!.rules.items[0]).toEqual({
      mode: 'all',
      items: [{ type: 'visitor_type', value: 'new' }],
    });
  });

  it('creates a new segment and opens it', async () => {
    const user = userEvent.setup();
    const { router, segmentsNow } = await open('/p/marketing-site/audiences/new');
    await user.click(screen.getByRole('button', { name: 'Create segment' }));
    expect(screen.getByText('Name the segment.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Segment name'), 'Paid visitors');
    await user.click(screen.getByRole('button', { name: '+ Condition' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Segment group 1, condition 1 field' }),
      'Source type',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Paid' }));
    await user.click(screen.getByRole('checkbox', { name: 'Organic search' }));
    await user.click(screen.getByRole('button', { name: 'Create segment' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/p/marketing-site/audiences/seg-3'),
    );
    expect(segmentsNow()[2]).toMatchObject({
      name: 'Paid visitors',
      rules: {
        mode: 'all',
        items: [{ mode: 'all', items: [{ type: 'source_type', value: ['paid'] }] }],
      },
    });
  });

  it('refuses to save incomplete conditions', async () => {
    const user = userEvent.setup();
    await open('/p/marketing-site/audiences/new');
    await user.type(screen.getByLabelText('Segment name'), 'Cookie people');
    await user.click(screen.getByRole('button', { name: '+ Condition' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Segment group 1, condition 1 field' }),
      'Cookie',
    );
    await user.click(screen.getByRole('button', { name: 'Create segment' }));
    expect(screen.getByText('1 condition needs a value.')).toBeInTheDocument();
  });

  it('warns before deleting a segment in use', async () => {
    const user = userEvent.setup();
    const { router, segmentsNow } = await open('/p/marketing-site/audiences/seg-returners');
    await user.click(screen.getByRole('button', { name: 'Delete segment' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “High-intent returners”?' });
    expect(dialog).toHaveTextContent('It is used by Hero headline: price-led.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete segment' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/p/marketing-site/audiences'),
    );
    expect(segmentsNow().map((s) => s.id)).toEqual(['seg-mobile']);
  });

  it('shows not found for an unknown segment', async () => {
    await open('/p/marketing-site/audiences/nope');
    expect(screen.getByText("This segment doesn't exist.")).toBeInTheDocument();
  });
});

describe('segment rules shape', () => {
  it('stores builder groups as one ALL group and reads older flat rules', () => {
    const groups = [
      { mode: 'any' as const, items: [{ type: 'visitor_type' as const, value: 'new' as const }] },
    ];
    expect(toGroups(fromGroups(groups))).toEqual(groups);
    const flat = {
      mode: 'all' as const,
      items: [{ type: 'visitor_type' as const, value: 'new' as const }],
    };
    expect(toGroups(flat)).toEqual([flat]);
    expect(toGroups({ mode: 'all', items: [] })).toEqual([]);
  });
});

describe('saved triggers and page sets', () => {
  it('switches between segments, triggers and page sets', async () => {
    const user = userEvent.setup();
    const { router } = await open();
    const tabs = screen.getByRole('navigation', { name: 'Audience types' });
    await user.click(within(tabs).getByRole('link', { name: 'Triggers' }));
    expect(router.state.location.pathname).toBe('/p/marketing-site/audiences/triggers');
    expect(await screen.findByRole('link', { name: 'Engaged mobile visit' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ New trigger' })).toBeInTheDocument();
    await user.click(within(tabs).getByRole('link', { name: 'Page sets' }));
    expect(
      await screen.findByRole('link', { name: 'Trip and deal pages3 URL rules' }),
    ).toBeInTheDocument();
  });

  it('edits a saved trigger', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    renderApp('/p/marketing-site/audiences/triggers/trg-engaged', { data: data.api });
    const name = await screen.findByLabelText('Trigger name');
    await user.clear(name);
    await user.type(name, 'Engaged visit');
    await user.click(screen.getByRole('button', { name: 'Save trigger' }));
    expect(
      await screen.findByText('Saved. Experiments that already use it keep their own copy.'),
    ).toBeInTheDocument();
    expect(data.savedNow().triggers[0]!.name).toBe('Engaged visit');
  });

  it('creates a page set', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    const router = renderApp('/p/marketing-site/audiences/page-sets/new', { data: data.api });
    await user.type(await screen.findByLabelText('Page set name'), 'Checkout');
    await user.click(screen.getByRole('button', { name: 'Create page set' }));
    expect(screen.getByText('1 rule needs a value.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Page rule 1 value' }), '/checkout');
    await user.click(screen.getByRole('button', { name: 'Create page set' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/p/marketing-site/audiences/page-sets/page_sets-2',
      ),
    );
    expect(data.savedNow().page_sets[1]).toMatchObject({
      name: 'Checkout',
      rules: { include: [{ op: 'matches', value: '/checkout' }] },
    });
  });

  it('inserts a saved audience into a segment as a copy', async () => {
    const user = userEvent.setup();
    const { segmentsNow } = await open('/p/marketing-site/audiences/seg-mobile');
    const before = segmentsNow().find((s) => s.id === 'seg-mobile')!.rules.items.length;
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Insert saved audience' }),
      'High-intent returners',
    );
    await user.click(screen.getByRole('button', { name: 'Save segment' }));
    await vi.waitFor(() =>
      expect(segmentsNow().find((s) => s.id === 'seg-mobile')!.rules.items.length).toBeGreaterThan(
        before,
      ),
    );
  });
});
