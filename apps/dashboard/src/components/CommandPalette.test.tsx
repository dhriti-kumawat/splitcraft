import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';

async function openPalette(path = '/projects') {
  const user = userEvent.setup();
  const router = renderApp(path);
  await screen.findByRole('complementary', { name: 'Sidebar' });
  await user.keyboard('{Control>}k{/Control}');
  const dialog = await screen.findByRole('dialog', { name: 'Search' });
  return { user, router, dialog };
}

describe('command palette', () => {
  it('opens with Ctrl+K and closes with Escape, returning focus', async () => {
    const { user } = await openPalette();
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('opens from the search button', async () => {
    const user = userEvent.setup();
    renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'Search' }));
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });

  it('finds experiments in any project and opens one with Enter', async () => {
    const { user, router } = await openPalette();
    await user.type(screen.getByRole('combobox'), 'trust');
    const listbox = screen.getByRole('listbox');
    await waitFor(() =>
      expect(
        within(listbox).getByRole('option', { name: /Trust badges under Book button/ }),
      ).toHaveAttribute('aria-selected', 'true'),
    );
    await user.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/p/marketing-site/experiments/trust/basics');
  });

  it('moves between results with the arrow keys', async () => {
    const { user } = await openPalette();
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[1]).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it("includes the current project's audiences and metrics", async () => {
    const { user, router } = await openPalette('/p/marketing-site/experiments');
    await user.type(screen.getByRole('combobox'), 'returners');
    await user.click(await screen.findByRole('option', { name: /High-intent returners/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/p/marketing-site/audiences/seg-returners'),
    );
  });

  it('says when nothing matches', async () => {
    const { user } = await openPalette();
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText('No matches for “zzzz”.')).toBeInTheDocument();
  });
});
