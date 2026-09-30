import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

const splitData = () =>
  fakeData({
    experiments: EXPERIMENTS.map((e) => (e.id === 'trust' ? { ...e, type: 'split_url' } : e)),
  });

async function open(data = splitData()) {
  renderApp('/p/trip-demo/experiments/trust/variants', { data: data.api });
  await screen.findByLabelText('Page URL');
  return data;
}

describe('split URL variants', () => {
  it('shows a page URL per variant instead of code', async () => {
    await open();
    expect(screen.getByText(/Original page:/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Code for/ })).toBeNull();
  });

  it('saves a URL on one of the project domains, from a path too', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    await user.type(screen.getByLabelText('Page URL'), '/trips/norway-b');
    await user.tab();
    expect(variantPatches).toContainEqual({
      id: 'trust-b',
      patch: { url: 'https://mytrips.dev/trips/norway-b' },
    });
  });

  it('rejects other domains', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    await user.type(screen.getByLabelText('Page URL'), 'https://evil.test/x');
    await user.tab();
    expect(screen.getByLabelText('Page URL')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/isn't one of this project's domains/)).toBeInTheDocument();
    expect(variantPatches).toEqual([]);
  });
});
