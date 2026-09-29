import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(id = 'trust', data = fakeData()) {
  renderApp(`/p/trip-demo/experiments/${id}/targeting`, { data: data.api });
  await screen.findByRole('heading', { name: 'Segment' });
  await screen.findByRole('combobox', { name: 'Add segment' });
  return data;
}

const saved = (patches: Array<{ id: string; patch: unknown }>) =>
  (patches.at(-1)!.patch as { targeting: unknown }).targeting;

describe('targeting', () => {
  it('starts as everyone, every page, every load', async () => {
    await open();
    expect(screen.getByText('everyone (no segment)')).toBeInTheDocument();
    expect(screen.getByText('Runs on every page of the site.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Every page load' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText('Everyone, on every page, on every page load.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save targeting' })).toBeDisabled();
  });

  it('builds WHO, WHERE, HOW and WHEN and saves them', async () => {
    const user = userEvent.setup();
    const { patches } = await open();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Add segment' }),
      'High-intent returners',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Add segment' }),
      'Mobile first-timers',
    );
    await user.click(screen.getByRole('button', { name: 'all' }));

    await user.click(screen.getByRole('button', { name: '+ Rule' }));
    await user.type(screen.getByRole('textbox', { name: 'Page rule 1 value' }), '/trips/*');
    await user.click(screen.getByRole('button', { name: '+ Rule' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Page rule 2 include or exclude' }),
      'EXCLUDE',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Page rule 2 operator' }),
      'contains',
    );
    await user.type(screen.getByRole('textbox', { name: 'Page rule 2 value' }), '/archive');
    await user.click(screen.getByRole('button', { name: '+ Element rule' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Element rule 1 CSS selector' }),
      '.book-now-btn',
    );

    await user.click(screen.getByRole('button', { name: '+ Add group' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Trigger group 1, condition 1 field' }),
      'Pages viewed this visit',
    );

    await user.click(screen.getByRole('radio', { name: 'Every N days' }));
    const days = screen.getByLabelText('Days');
    await user.clear(days);
    await user.type(days, '14');

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(
      screen.getByText(
        'High-intent returners and Mobile first-timers, on pages /trips/*, except /archive, with .book-now-btn on the page, when pages viewed this visit is at least 2, every 14 days.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save targeting' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(saved(patches)).toEqual({
      who: { mode: 'all', segmentIds: ['seg-returners', 'seg-mobile'] },
      where: {
        include: [{ op: 'matches', value: '/trips/*' }],
        exclude: [{ op: 'contains', value: '/archive' }],
        elements: [{ selector: '.book-now-btn' }],
      },
      how: [{ mode: 'all', items: [{ type: 'pages_viewed_session', op: 'gte', value: 2 }] }],
      when: { mode: 'every_n_days', days: 14 },
    });
  });

  it('refuses to save empty or invalid rules', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: '+ Rule' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Page rule 1 operator' }),
      'regex',
    );
    await user.type(screen.getByRole('textbox', { name: 'Page rule 1 value' }), '(');
    await user.click(screen.getByRole('button', { name: 'Save targeting' }));
    expect(screen.getByText('1 rule needs a value.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Page rule 1 value' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('removes segments and rules', async () => {
    const user = userEvent.setup();
    await open('hero');
    expect(screen.getByText('High-intent returners')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove High-intent returners' }));
    await user.click(screen.getByRole('button', { name: 'Remove Page rule 1' }));
    expect(screen.getByText('Everyone, on every page, on every page load.')).toBeInTheDocument();
  });

  it('shows live traffic and warns that saved rules apply to live visitors', async () => {
    const user = userEvent.setup();
    await open('sticky');
    expect(
      screen.getByText(/visitors a day entered this test in the last 7 days/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Once' }));
    expect(
      screen.getByText("Live: new rules apply from each visitor's next page."),
    ).toBeInTheDocument();
  });
});

describe('URL tester', () => {
  it('checks a URL against the unsaved rules with the SDK matcher', async () => {
    const user = userEvent.setup();
    await open('sticky');
    const tester = screen.getByRole('region', { name: 'Test a URL' });
    const input = within(tester).getByLabelText('URL to test');
    await user.clear(input);
    await user.type(input, 'mytrips.dev/trips/norway');
    expect(within(tester).getByText('Where: matches /trips/*')).toBeInTheDocument();
    expect(
      within(tester).getByText('Triggers are checked in the visit on the site'),
    ).toBeInTheDocument();
    expect(within(tester).getByRole('status')).toHaveTextContent('This page is in the test');

    await user.clear(input);
    await user.type(input, 'mytrips.dev/about');
    expect(within(tester).getByRole('status')).toHaveTextContent(
      'Visitors on this page never see the test.',
    );
  });
});

describe('reach estimate', () => {
  it('estimates reach and each trigger group from recent sessions', async () => {
    const user = userEvent.setup();
    await open();
    const reach = await screen.findByLabelText('Reach estimate');
    expect(reach).toHaveTextContent('100% of sessions · ≈ 200 visitors a day');
    expect(reach).toHaveTextContent('From 20 of 6,000 sessions in the last 30 days.');

    await user.click(screen.getByRole('button', { name: '+ Add group' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Trigger group 1, condition 1 field' }),
      'Device type',
    );
    const group = screen.getByRole('group', { name: 'Trigger group 1' });
    expect(within(group).getByText(/% match/)).toBeInTheDocument();
    expect(screen.getByLabelText('Reach estimate')).toHaveTextContent(/of sessions/);
  });

  it('explains when there is no traffic yet', async () => {
    await open('trust', fakeData({ sessionSample: { sessions: 0, days: 0, sample: [] } }));
    expect(
      await screen.findByText(
        'Reach appears once the snippet has seen some visits. It samples the last 30 days.',
      ),
    ).toBeInTheDocument();
  });
});

describe('saved targeting', () => {
  it('uses a saved page set and inserts a saved trigger as copies', async () => {
    const user = userEvent.setup();
    const { patches } = await open();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Use saved page set' }),
      'Trip and deal pages · 3 URL rules',
    );
    expect(screen.getByRole('textbox', { name: 'Page rule 1 value' })).toHaveValue('/trips/*');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Insert saved trigger' }),
      'Engaged mobile visit',
    );
    await user.click(screen.getByRole('button', { name: 'Save targeting' }));
    await vi.waitFor(() => expect(patches.length).toBe(1));
    expect(saved(patches)).toMatchObject({
      where: {
        include: [
          { op: 'matches', value: '/trips/*' },
          { op: 'regex', value: '^/deals/(summer|monsoon)' },
        ],
        exclude: [{ op: 'contains', value: '/archive' }],
      },
      how: [{ mode: 'all', items: [{ type: 'screen_width' }, { type: 'pages_viewed_session' }] }],
    });
  });

  it('saves the current page rules as a page set', async () => {
    const user = userEvent.setup();
    const data = await open();
    await user.click(screen.getByRole('button', { name: '+ Rule' }));
    await user.type(screen.getByRole('textbox', { name: 'Page rule 1 value' }), '/checkout');
    await user.click(screen.getByRole('button', { name: 'Save these rules as a page set' }));
    await user.type(screen.getByLabelText('Name'), 'Checkout');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved “Checkout” to Audiences.')).toBeInTheDocument();
    expect(data.savedNow().page_sets.at(-1)).toMatchObject({
      name: 'Checkout',
      rules: { include: [{ op: 'matches', value: '/checkout' }] },
    });
  });
});
