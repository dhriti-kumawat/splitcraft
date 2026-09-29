import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(path: string, data = fakeData()) {
  const router = renderApp(path, { data: data.api });
  await screen.findByRole('heading', { level: 1 });
  return { router, ...data };
}

describe('metrics list', () => {
  it('lists metrics with source, key, measure and use', async () => {
    await open('/p/trip-demo/metrics');
    const row = (await screen.findByRole('link', { name: 'Book click' })).closest('tr')!;
    expect(within(row).getByText('Click · selector')).toBeInTheDocument();
    expect(within(row).getByText('book_click')).toBeInTheDocument();
    expect(within(row).getByText('Unique conversions')).toBeInTheDocument();
    expect(within(row).getByText('5 experiments')).toBeInTheDocument();
  });

  it('offers the sources the SDK tracks and marks the others as coming later', async () => {
    const user = userEvent.setup();
    await open('/p/trip-demo/metrics');
    await user.click(screen.getByRole('button', { name: '+ New metric' }));
    const menu = screen.getByRole('list', { name: 'Event source' });
    expect(within(menu).getByRole('link', { name: 'Custom JS' })).toHaveAttribute(
      'href',
      '/p/trip-demo/metrics/new?source=custom-js',
    );
    expect(within(menu).getByText('dataLayer').closest('[aria-disabled]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('list', { name: 'Event source' })).not.toBeInTheDocument();
  });
});

describe('click tracker', () => {
  it('creates a click metric with an auto key and selector health', async () => {
    const user = userEvent.setup();
    const { router, metricsNow } = await open('/p/trip-demo/metrics/new?source=click');
    expect(screen.getByRole('radio', { name: 'Click · selector' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.type(screen.getByLabelText('Name'), 'Reserve click');
    expect(screen.getByLabelText(/Event key/)).toHaveValue('reserve_click');

    await user.type(screen.getByLabelText(/CSS selector/), 'div:nth-child(2)');
    expect(screen.getByText(/Avoid position selectors/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/CSS selector/));
    await user.type(screen.getByLabelText(/CSS selector/), '.reserve-btn');
    expect(screen.getByText('Does not depend on element position')).toBeInTheDocument();
    expect(screen.getByText(/e\.target\.closest\("\.reserve-btn"\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'First click per page' }));
    await user.click(screen.getByRole('radio', { name: /Total conversions/ }));
    expect(screen.queryByRole('radio', { name: /Sum of value/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create metric' }));

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toMatch(/\/p\/trip-demo\/metrics\/m-new-/),
    );
    expect(metricsNow().at(-1)).toMatchObject({
      name: 'Reserve click',
      eventKey: 'reserve_click',
      source: 'click',
      sourceConfig: { selector: '.reserve-btn', firstPerPage: true },
      measure: 'total',
      measureConfig: { direction: 'increase', windowDays: 7 },
    });
  });

  it('validates the form', async () => {
    const user = userEvent.setup();
    await open('/p/trip-demo/metrics/new?source=click');
    await user.click(screen.getByRole('button', { name: 'Create metric' }));
    expect(screen.getByText('Name the metric.')).toBeInTheDocument();
    expect(screen.getByText('Use letters, numbers, _ . : or - (up to 100).')).toBeInTheDocument();
    expect(screen.getAllByText('Enter at least one CSS selector.')).not.toHaveLength(0);
    expect(screen.getByText('Fix the highlighted fields.')).toBeInTheDocument();
  });

  it('reports a duplicate event key', async () => {
    const user = userEvent.setup();
    await open('/p/trip-demo/metrics/new?source=click');
    await user.type(screen.getByLabelText('Name'), 'Book click');
    await user.type(screen.getByLabelText(/CSS selector/), '.x');
    await user.click(screen.getByRole('button', { name: 'Create metric' }));
    expect(
      await screen.findByText('The event key "book_click" is already used by another metric.'),
    ).toBeInTheDocument();
  });
});

describe('custom JS tracker', () => {
  it('checks the code and saves it with its pages and value measure', async () => {
    const user = userEvent.setup();
    const { metricsNow } = await open('/p/trip-demo/metrics/new?source=custom-js');
    await user.type(screen.getByLabelText('Name'), 'Add-on selected');
    await user.click(screen.getByRole('button', { name: 'Insert snippet' }));
    expect(
      (screen.getByRole('textbox', { name: 'Tracker code' }) as HTMLTextAreaElement).value,
    ).toContain("splitly.trackEvent('add_on_selected'");
    expect(
      await screen.findByText('Event key add_on_selected found in the code'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Tracker code' }), {
      target: { value: 'if (' },
    });
    expect(await screen.findByText(/Syntax error:/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tracker code' }), {
      target: { value: "splitly.trackEvent('add_on_selected', { value: 12 })" },
    });

    await user.click(screen.getByRole('button', { name: '+ Page' }));
    await user.type(screen.getByLabelText('Page 1 URL'), '/trips/*');
    await user.click(screen.getByRole('radio', { name: /Sum of value/ }));
    await user.click(await screen.findByRole('button', { name: 'Create metric' }));
    await vi.waitFor(() =>
      expect(metricsNow().at(-1)).toMatchObject({
        source: 'custom_js',
        eventKey: 'add_on_selected',
        measure: 'sum',
        sourceConfig: {
          code: "splitly.trackEvent('add_on_selected', { value: 12 })",
          pages: [{ op: 'matches', value: '/trips/*' }],
        },
      }),
    );
  });
});

describe('editing', () => {
  it('edits an existing metric and locks its source', async () => {
    const user = userEvent.setup();
    const { metricsNow } = await open('/p/trip-demo/metrics/m-confirm');
    expect(screen.getByRole('radio', { name: 'Pageview · URL' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Click · selector' })).toBeDisabled();
    const url = screen.getByRole('textbox', { name: 'URL' });
    await user.clear(url);
    await user.type(url, '/checkout/thanks');
    await user.click(screen.getByRole('button', { name: 'Save metric' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(metricsNow().find((m) => m.id === 'm-confirm')!.sourceConfig).toEqual({
      url: { op: 'is', value: '/checkout/thanks' },
    });
  });

  it('warns before deleting a primary goal', async () => {
    const user = userEvent.setup();
    const { router, metricsNow } = await open('/p/trip-demo/metrics/m-book');
    await user.click(screen.getByRole('button', { name: 'Delete metric' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Book click”?' });
    expect(dialog).toHaveTextContent('It is the primary goal of');
    await user.click(within(dialog).getByRole('button', { name: 'Delete metric' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/p/trip-demo/metrics'));
    expect(metricsNow().some((m) => m.id === 'm-book')).toBe(false);
  });

  it('shows not found for an unknown metric', async () => {
    renderApp('/p/trip-demo/metrics/nope', { data: fakeData().api });
    expect(await screen.findByText("This metric doesn't exist.")).toBeInTheDocument();
  });
});
