import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stopPreview } from '../../lib/previewBridge';
import { EXTENSION_ZIP_URL } from '../../lib/snippet';
import { fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open() {
  renderApp('/p/marketing-site/experiments/trust/variants', { data: fakeData().api });
  await screen.findByRole('navigation', { name: 'Experiment steps' });
}

afterEach(() => {
  stopPreview();
  delete document.documentElement.dataset.splitcraftPreview;
  localStorage.clear();
});

describe('Preview on site without the extension', () => {
  it('leads with one way to open it and folds the rest away', async () => {
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
    // The demo site has the snippet, so that is the first way offered.
    expect(within(dialog).getByRole('button', { name: 'Open preview' })).toBeInTheDocument();
    expect(within(dialog).getByText('How to install')).toBeInTheDocument();
    expect(within(dialog).getByText('Other ways to open it')).toBeInTheDocument();
  });

  it('opens the page through the snippet, linked to this tab for live edits', async () => {
    const user = userEvent.setup();
    const win = { postMessage: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    await open();
    await user.click(screen.getByRole('button', { name: 'Preview on site' }));
    await user.click(screen.getByRole('button', { name: 'Open preview' }));
    const url = new URL(openSpy.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://larkspurtravel.com');
    expect(url.searchParams.get('splitcraft_force')).toBe('trust:b');
    expect(url.searchParams.get('splitcraft_live')).toBe(location.origin);
    expect(openSpy.mock.calls[0]![1]).toBe('_blank');
    expect(screen.queryByRole('dialog', { name: 'Preview on site' })).not.toBeInTheDocument();
    expect(screen.getByText('Previewing live')).toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('opens the page for the bookmark in a tab it can talk to', async () => {
    const user = userEvent.setup();
    const win = { postMessage: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    await open();
    await user.click(screen.getByRole('button', { name: 'Preview on site' }));
    await user.click(screen.getByText('Other ways to open it'));
    await user.click(screen.getByRole('button', { name: 'Open the page' }));
    expect(openSpy.mock.calls[0]![0]).toMatch(
      /^https:\/\/larkspurtravel\.com\/\?splitcraft_force=trust%3Ab/,
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
    expect(await within(dialog).findByText(/Installed \(version 1\.0\.0\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Allow user scripts/)).toBeInTheDocument();
    window.removeEventListener('message', onMessage);
  });
});
