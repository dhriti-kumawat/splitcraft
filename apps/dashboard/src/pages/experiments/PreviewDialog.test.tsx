import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stopPreview } from '../../lib/previewBridge';
import { EXTENSION_ZIP_URL } from '../../lib/snippet';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open() {
  renderApp('/p/trip-demo/experiments/trust/variants', { data: fakeData().api });
  await screen.findByRole('navigation', { name: 'Experiment steps' });
}

afterEach(() => {
  stopPreview();
  delete document.documentElement.dataset.splitcraftPreview;
  localStorage.clear();
});

describe('Preview on site without the extension', () => {
  it('explains the three ways, installing the extension first', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Preview on site' }));
    const dialog = screen.getByRole('dialog', { name: 'Preview on site' });
    expect(
      await within(dialog).findByRole('link', { name: 'Download the extension' }),
    ).toHaveAttribute('href', EXTENSION_ZIP_URL);
    expect(within(dialog).getByText('Load unpacked')).toBeInTheDocument();
    expect(within(dialog).getByText('Splitcraft preview').getAttribute('href')).toMatch(
      /^javascript:/,
    );
    expect(within(dialog).getByRole('link', { name: 'Open with the snippet' })).toBeInTheDocument();
  });

  it('opens the page for the bookmark in a tab it can talk to', async () => {
    const user = userEvent.setup();
    const win = { postMessage: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    await open();
    await user.click(screen.getByRole('button', { name: 'Preview on site' }));
    await user.click(screen.getByRole('button', { name: 'Open the page' }));
    expect(openSpy.mock.calls[0]![0]).toMatch(
      /^https:\/\/mytrips\.dev\/\?splitcraft_force=trust%3Ab/,
    );
    expect(openSpy.mock.calls[0]![1]).toBe('_blank');
    expect(screen.getByText(/Page opened/)).toBeInTheDocument();
    expect(screen.getByText('Previewing live')).toBeInTheDocument();
    openSpy.mockRestore();
  });
});

describe('Preview on site with the extension', () => {
  it('opens the preview at once and shows it is live', async () => {
    document.documentElement.dataset.splitcraftPreview = '1.0.0';
    const requests: Array<{ type: string }> = [];
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; id?: number; request?: { type: string } };
      if (d?.source !== 'splitcraft-dashboard') return;
      requests.push(d.request!);
      const result = d.request!.type === 'ping' ? { version: '1.0.0', userScripts: false } : {};
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'splitcraft-extension', id: d.id, reply: { ok: true, result } },
          source: window,
        }),
      );
    };
    window.addEventListener('message', onMessage);
    const user = userEvent.setup();
    await open();
    const more = await screen.findByRole('button', { name: 'Other ways to preview' });
    await user.click(screen.getByRole('button', { name: 'Preview on site' }));
    await vi.waitFor(() => expect(requests.map((r) => r.type)).toContain('open'));
    expect(await screen.findByText('Previewing live')).toBeInTheDocument();

    await user.click(more);
    const dialog = screen.getByRole('dialog', { name: 'Preview on site' });
    expect(await within(dialog).findByText('Installed (version 1.0.0).')).toBeInTheDocument();
    expect(within(dialog).getByText(/Allow user scripts/)).toBeInTheDocument();
    window.removeEventListener('message', onMessage);
  });
});
