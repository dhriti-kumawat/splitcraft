import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData, RESULTS } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(id = 'sticky', data = fakeData()) {
  renderApp(`/p/trip-demo/experiments/${id}/results`, { data: data.api });
  await screen.findByRole('navigation', { name: 'Experiment steps' });
  return data;
}

describe('results', () => {
  it('states the verdict and progress like the design', async () => {
    await open();
    const banner = await screen.findByText('B is ahead, with a 96% chance to beat Control');
    expect(banner.closest('[role="status"]')).toHaveTextContent(
      /92% of the planned sample reached\. Keep it running about \d+ more days? before you call it\./,
    );
    expect(screen.getByText('24,860 of 27,000 visitors')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Planned sample' })).toHaveAttribute(
      'aria-valuenow',
      '24860',
    );
  });

  it('shows the four KPIs from the worked example', async () => {
    await open();
    await screen.findByText('B is ahead, with a 96% chance to beat Control');
    expect(screen.getByText('Uplift, B vs Control').closest('div')).toHaveTextContent('+9.7%');
    expect(screen.getByText('95% range −1.4% to +20.8%')).toBeInTheDocument();
    expect(screen.getByText('Chance to beat Control').closest('div')).toHaveTextContent('96%');
    expect(screen.getByText('50.2 / 49.8')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('χ² p = 0.53, split is healthy')).toBeInTheDocument();
  });

  it('lists variants with rates, uplift, chance and the guardrail', async () => {
    await open();
    await screen.findByText('B is ahead, with a 96% chance to beat Control');
    const table = within(screen.getByRole('region', { name: 'Book click by variant' })).getByRole(
      'table',
    );
    const rows = within(table).getAllByRole('row');
    expect(within(rows[0]!).getByText('Guardrail: Purchase')).toBeInTheDocument();
    const control = rows.find((r) => within(r).queryByText('Control'))!;
    expect(control).toHaveTextContent('12,480');
    expect(control).toHaveTextContent('4.98%');
    expect(control).toHaveTextContent('4%');
    // Purchase is measured as revenue per visitor (18,000 / 12,480).
    expect(control).toHaveTextContent('Baseline 1.44');
    const b = rows.find((r) => within(r).queryByRole('rowheader', { name: 'B' }))!;
    expect(b).toHaveTextContent('5.47%');
    expect(b).toHaveTextContent('+9.7%');
    expect(b).toHaveTextContent('96%');
    expect(b).toHaveTextContent('1.49, no drop past the limit');
  });

  it('describes the chart for screen readers and shows a legend', async () => {
    await open();
    const figure = await screen.findByRole('figure', {
      name: /Cumulative Book click conversion rate over 14 days/,
    });
    expect(figure).toHaveAccessibleName(
      /Control 4\.98%, B 5\.47%\. The table above has the exact numbers\./,
    );
    expect(within(figure).getByText('Control')).toBeInTheDocument();
  });

  it('reports secondary goals with their range', async () => {
    await open();
    const section = await screen.findByRole('region', { name: 'Secondary goals' });
    expect(within(section).getByText('Confirmation page')).toBeInTheDocument();
    expect(within(section).getByText('B vs Control')).toBeInTheDocument();
  });

  it('warns about a sample ratio mismatch before anything else', async () => {
    const results = {
      sticky: RESULTS.sticky!.map((a) => (a.variantKey === 'b' ? { ...a, visitors: 11_000 } : a)),
    };
    await open('sticky', fakeData({ results }));
    expect(
      await screen.findByText("Sample ratio mismatch: don't trust these numbers yet"),
    ).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });

  it('asks for a primary goal, and waits for launch on drafts', async () => {
    const data = fakeData();
    await open('trust', data);
    expect(await screen.findByText('Results appear here after launch.')).toBeInTheDocument();
  });
});

describe('breakdown', () => {
  it('shows the primary goal by device and by traffic source', async () => {
    const user = userEvent.setup();
    renderApp('/p/trip-demo/experiments/sticky/results');
    const section = await screen.findByRole('region', { name: 'Book click by device' });
    const mobile = await within(section).findByRole('row', { name: /Mobile/ });
    expect(mobile).toHaveTextContent('4.94%');
    expect(mobile).toHaveTextContent('5.81%');
    expect(within(section).getByRole('row', { name: /Unknown/ })).toHaveTextContent(
      'Too few visitors',
    );
    await user.click(within(section).getByRole('button', { name: 'Traffic source' }));
    expect(
      await screen.findByRole('region', { name: 'Book click by traffic source' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Organic search/ })).toBeInTheDocument();
  });
});

describe('MVT results', () => {
  it('ranks combinations and shows each section version pooled', async () => {
    const lvl = (key: string, name: string) => ({ key, name, js: '', css: '' });
    const factors = [
      { key: 's1', name: 'Headline', levels: [lvl('a', 'Original'), lvl('b', 'Short')] },
      { key: 's2', name: 'Button', levels: [lvl('a', 'Original'), lvl('b', 'Green')] },
    ];
    const keys = ['control', 'v01', 'v10', 'v11'];
    const conv = { control: 100, v01: 100, v10: 160, v11: 170 } as Record<string, number>;
    const base = EXPERIMENTS.find((e) => e.id === 'sticky')!;
    const mvt = {
      ...base,
      type: 'mvt' as const,
      factors,
      variants: keys.map((key) => ({
        ...base.variants[0]!,
        id: `sticky-${key}`,
        key,
        name: key,
        weight: 25,
      })),
    };
    const arm = (variantKey: string) => ({
      metricId: 'm-book',
      variantKey,
      visitors: 2000,
      converters: conv[variantKey]!,
      events: conv[variantKey]!,
      eventsSumsq: 0,
      valueSum: 0,
      valueSumsq: 0,
      viewers: 0,
    });
    await open(
      'sticky',
      fakeData({
        experiments: EXPERIMENTS.map((e) => (e.id === 'sticky' ? mvt : e)),
        results: { sticky: keys.map(arm) },
      }),
    );
    const byVariant = await screen.findByRole('region', { name: 'Book click by variant' });
    const names = within(byVariant)
      .getAllByRole('rowheader')
      .map((r) => r.textContent);
    expect(names).toEqual(['control', 'v11', 'v10', 'v01']);
    const headline = screen.getByRole('table', { name: 'Headline' });
    expect(within(headline).getByRole('row', { name: /Short/ })).toHaveTextContent('4,000');
    expect(within(headline).getByRole('row', { name: /Short/ })).toHaveTextContent('330');
  });
});

describe('personalization reach', () => {
  it('shows visitors reached and goal rates without a comparison', async () => {
    await open(
      'sticky',
      fakeData({
        experiments: EXPERIMENTS.map((e) =>
          e.id === 'sticky' ? { ...e, type: 'personalization' as const } : e,
        ),
      }),
    );
    expect(await screen.findByText('Visitors reached')).toBeInTheDocument();
    expect(screen.getByText('Book click')).toBeInTheDocument();
    expect(screen.getAllByText(/converted$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/chance to beat/)).not.toBeInTheDocument();
  });
});
