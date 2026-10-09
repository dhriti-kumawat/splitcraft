import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(id: string, data = fakeData()) {
  renderApp(`/p/marketing-site/experiments/${id}/goals`, { data: data.api });
  await screen.findByText('Primary goal');
  await screen.findByRole('heading', { name: /Secondary goals/ });
  return data;
}

describe('goals', () => {
  it('shows the primary goal with how it is counted, and lets it change after launch', async () => {
    const user = userEvent.setup();
    const { patches } = await open('sticky');
    expect(
      await screen.findByText('Click on .book-now-btn · unique conversions · higher is better'),
    ).toBeInTheDocument();
    expect(screen.getByText(/results are recalculated/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Change to'), 'Purchase');
    await vi.waitFor(() =>
      expect(patches).toContainEqual({ id: 'sticky', patch: { primaryMetricId: 'm-purchase' } }),
    );
  });

  it('changes the primary goal of a draft', async () => {
    const user = userEvent.setup();
    const { patches } = await open('trust');
    expect(screen.queryByText(/results are recalculated/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Change to'), 'Purchase');
    await vi.waitFor(() =>
      expect(patches).toContainEqual({ id: 'trust', patch: { primaryMetricId: 'm-purchase' } }),
    );
  });

  it('lists secondary goals and guardrails', async () => {
    await open('sticky');
    const secondary = screen.getByRole('region', { name: /Secondary goals/ });
    const row = (await within(secondary).findByText('Confirmation page')).closest('tr')!;
    expect(within(row).getByText('Pageview')).toBeInTheDocument();
    expect(within(row).getByText('URL /checkout/done')).toBeInTheDocument();
    const guard = screen.getByRole('region', { name: 'Guardrails' });
    expect(within(guard).getByText('Purchase')).toBeInTheDocument();
    expect(within(guard).getByLabelText('must not drop more than')).toHaveValue('2');
  });

  it('adds and removes secondary goals, and never offers a metric twice', async () => {
    const user = userEvent.setup();
    const { goalsNow } = await open('trust');
    const add = screen.getByLabelText('Add secondary goal');
    expect(within(add).queryByRole('option', { name: 'Book click' })).not.toBeInTheDocument();
    await user.selectOptions(add, 'Search started');
    expect(
      await screen.findByRole('button', { name: 'Remove Search started' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Add guardrail')).queryByRole('option', {
        name: 'Search started',
      }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Search started' }));
    await vi.waitFor(() => expect(goalsNow().trust ?? []).toHaveLength(0));
  });

  it('adds a guardrail with a default limit and edits it', async () => {
    const user = userEvent.setup();
    const { goalsNow } = await open('trust');
    await user.selectOptions(screen.getByLabelText('Add guardrail'), 'Purchase');
    const pct = await screen.findByLabelText('must not drop more than');
    expect(pct).toHaveValue('2');
    await user.clear(pct);
    await user.type(pct, '0');
    expect(pct).toHaveAttribute('aria-invalid', 'true');
    await user.clear(pct);
    await user.type(pct, '1.5');
    await user.tab();
    await vi.waitFor(() =>
      expect(goalsNow().trust![0]).toMatchObject({ role: 'guardrail', limit: { maxPct: 1.5 } }),
    );
  });

  it('offers new goals by source', async () => {
    await open('trust');
    const aside = screen.getByRole('complementary', { name: 'Add a goal' });
    expect(within(aside).getByRole('link', { name: /Custom event/ })).toHaveAttribute(
      'href',
      '/p/marketing-site/metrics/new?source=custom-js&experiment=trust&role=secondary',
    );
    expect(within(aside).getByRole('link', { name: /Web Vitals/ })).toHaveAttribute(
      'href',
      '/p/marketing-site/metrics/new?source=web-vitals&experiment=trust&role=secondary',
    );
    expect(screen.getByRole('link', { name: 'or create a new metric' })).toHaveAttribute(
      'href',
      '/p/marketing-site/metrics/new?source=click&experiment=trust&role=primary',
    );
    expect(within(aside).queryByText(/Coming later/)).not.toBeInTheDocument();
    expect(within(aside).queryByText(/Formula/)).not.toBeInTheDocument();
  });

  it('adds a ready-made metric as a goal in one click', async () => {
    const user = userEvent.setup();
    const { goalsNow } = await open('trust');
    const aside = screen.getByRole('complementary', { name: 'Add a goal' });
    await user.click(
      within(aside).getByRole('button', { name: 'Add Add to cart as secondary goal' }),
    );
    await vi.waitFor(() =>
      expect(goalsNow().trust?.map((g) => [g.metric.name, g.role])).toEqual([
        ['Add to cart', 'secondary'],
      ]),
    );
    expect(goalsNow().trust![0]!.metric.eventKey).toBe('add_to_cart');
    expect(await screen.findByRole('button', { name: 'Remove Add to cart' })).toBeInTheDocument();
    expect(
      within(aside).queryByRole('button', { name: /^Add Add to cart/ }),
    ).not.toBeInTheDocument();
  });

  it('reuses an existing metric with the same event key', async () => {
    const user = userEvent.setup();
    const { goalsNow } = await open('trust');
    await user.click(screen.getByRole('button', { name: 'Add Purchase as secondary goal' }));
    await vi.waitFor(() => expect(goalsNow().trust?.[0]?.metric.id).toBe('m-purchase'));
  });

  it('offers to create a metric for secondary goals and guardrails', async () => {
    await open('trust');
    expect(
      screen.getByRole('link', { name: 'Add secondary goal: create a new metric' }),
    ).toHaveAttribute(
      'href',
      '/p/marketing-site/metrics/new?source=click&experiment=trust&role=secondary',
    );
    expect(
      screen.getByRole('link', { name: 'Add guardrail: create a new metric' }),
    ).toHaveAttribute(
      'href',
      '/p/marketing-site/metrics/new?source=click&experiment=trust&role=guardrail',
    );
  });
});
