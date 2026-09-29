import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';
import { fromGroups, toGroups } from '../../lib/segments';

async function open(path = '/p/trip-demo/audiences', data = fakeData()) {
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
    const { segmentsNow } = await open('/p/trip-demo/audiences/seg-returners');
    expect(
      screen.getByText(
        'Returning visitors and viewed pages matches pattern /trips/* at least 3 times in 7 days.',
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
    const { router, segmentsNow } = await open('/p/trip-demo/audiences/new');
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
      expect(router.state.location.pathname).toBe('/p/trip-demo/audiences/seg-3'),
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
    await open('/p/trip-demo/audiences/new');
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
    const { router, segmentsNow } = await open('/p/trip-demo/audiences/seg-returners');
    await user.click(screen.getByRole('button', { name: 'Delete segment' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “High-intent returners”?' });
    expect(dialog).toHaveTextContent('It is used by Hero headline: price-led.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete segment' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/p/trip-demo/audiences'));
    expect(segmentsNow().map((s) => s.id)).toEqual(['seg-mobile']);
  });

  it('shows not found for an unknown segment', async () => {
    await open('/p/trip-demo/audiences/nope');
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
