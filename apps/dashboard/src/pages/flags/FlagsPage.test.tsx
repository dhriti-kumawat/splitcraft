import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(data = fakeData()) {
  renderApp('/p/trip-demo/flags', { data: data.api });
  await screen.findByRole('heading', { level: 1, name: 'Feature flags' });
  return data;
}

describe('feature flags', () => {
  it('shows how to use a flag when there are none', async () => {
    await open();
    expect(await screen.findByText(/No flags yet/)).toBeInTheDocument();
    expect(screen.getAllByText(/splitcraft\.isEnabled/).length).toBeGreaterThan(0);
  });

  it('creates a flag, turns it on, rolls it out and targets a segment', async () => {
    const user = userEvent.setup();
    const { flagsNow } = await open();
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    const dialog = screen.getByRole('dialog', { name: 'New feature flag' });
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));
    expect(within(dialog).getByText(/Name the flag/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Name'), 'New checkout');
    expect(within(dialog).getByLabelText('Key, used in your code')).toHaveValue('new-checkout');
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));

    const toggle = await screen.findByRole('switch', { name: 'New checkout on' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    await vi.waitFor(() => expect(flagsNow()[0]!.enabled).toBe(true));

    const pct = screen.getByLabelText('New checkout rollout percentage');
    await user.clear(pct);
    await user.type(pct, '10');
    await user.tab();
    await vi.waitFor(() => expect(flagsNow()[0]!.rolloutPct).toBe(10));

    await user.selectOptions(
      screen.getByLabelText('New checkout audience'),
      'High-intent returners',
    );
    await vi.waitFor(() => expect(flagsNow()[0]!.segmentIds).toEqual(['seg-returners']));

    await user.click(screen.getByRole('button', { name: 'Delete New checkout' }));
    expect(await screen.findByText(/No flags yet/)).toBeInTheDocument();
  });

  it('refuses a key that is already used', async () => {
    const user = userEvent.setup();
    await open(
      fakeData({
        flags: [
          {
            id: 'f1',
            key: 'new-checkout',
            name: 'Old',
            enabled: true,
            rolloutPct: 50,
            segmentIds: [],
          },
        ],
      }),
    );
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    const dialog = screen.getByRole('dialog', { name: 'New feature flag' });
    await user.type(within(dialog).getByLabelText('Name'), 'New checkout');
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The key "new-checkout" is already used.',
    );
  });
});
