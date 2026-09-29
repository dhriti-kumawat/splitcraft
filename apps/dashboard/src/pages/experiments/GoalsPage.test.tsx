import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(id: string, data = fakeData()) {
  renderApp(`/p/trip-demo/experiments/${id}/goals`, { data: data.api });
  await screen.findByText('Primary goal');
  await screen.findByRole('heading', { name: /Secondary goals/ });
  return data;
}

describe('goals', () => {
  it('shows the primary goal with how it is counted, locked after launch', async () => {
    await open('sticky');
    expect(
      await screen.findByText('Click on .book-now-btn · unique conversions · higher is better'),
    ).toBeInTheDocument();
    expect(screen.getByText('Locked since launch')).toBeInTheDocument();
    expect(screen.queryByLabelText('Change to')).not.toBeInTheDocument();
  });

  it('changes the primary goal of a draft', async () => {
    const user = userEvent.setup();
    const { patches } = await open('trust');
    expect(screen.getByText('Locks at launch')).toBeInTheDocument();
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

  it('offers new goals by source and marks the rest as coming later', async () => {
    await open('trust');
    const aside = screen.getByRole('complementary', { name: 'Add a goal' });
    expect(within(aside).getByRole('link', { name: /Custom event/ })).toHaveAttribute(
      'href',
      '/p/trip-demo/metrics/new?source=custom-js',
    );
    expect(
      within(aside)
        .getByText(/Web Vitals/)
        .closest('[aria-disabled]'),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(within(aside).queryByText(/Formula/)).not.toBeInTheDocument();
  });
});
