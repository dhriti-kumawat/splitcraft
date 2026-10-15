import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeData } from '../test/fakeData';
import { renderApp } from '../test/renderApp';

describe('help and feedback', () => {
  it('sends help from any page with the account email and the page', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    renderApp('/p/marketing-site/experiments', { data: data.api });
    const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' });
    await user.click(within(sidebar).getByRole('button', { name: 'Help and feedback' }));
    const dialog = screen.getByRole('dialog', { name: 'Help and feedback' });
    expect(within(dialog).getByText('maya@larkspurtravel.com')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(within(dialog).getByText('Write a message first.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: 'Report a problem' }));
    await user.type(within(dialog).getByLabelText('Message'), 'The chart is empty');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(
      await screen.findByRole('dialog', { name: "Thanks, it's on its way" }),
    ).toHaveTextContent('We’ll reply to maya@larkspurtravel.com.');
    expect(data.feedbackNow()).toEqual([
      {
        kind: 'problem',
        message: 'The chart is empty',
        page: '/p/marketing-site/experiments',
        workspaceId: 'ws_1',
      },
    ]);
  });

  it('leaves the page out when asked', async () => {
    const user = userEvent.setup();
    const data = fakeData();
    renderApp('/projects', { data: data.api });
    const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' });
    await user.click(within(sidebar).getByRole('button', { name: 'Help and feedback' }));
    const dialog = screen.getByRole('dialog', { name: 'Help and feedback' });
    await user.click(within(dialog).getByRole('radio', { name: 'Share feedback' }));
    await user.type(within(dialog).getByLabelText('Message'), 'Love the editor');
    await user.click(within(dialog).getByRole('checkbox', { name: /Include this page/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await screen.findByRole('dialog', { name: "Thanks, it's on its way" });
    expect(data.feedbackNow()[0]).toMatchObject({ kind: 'feedback', page: null });
  });
});
