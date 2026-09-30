import type { PreviewState } from './protocol';

// A small in-memory stand-in for the chrome.* APIs the service worker uses.
type Listener = (...args: never[]) => unknown;
const listeners: Record<string, Listener> = {};
const store: Record<string, unknown> = {};
const chromeMock = {
  runtime: {
    id: 'ext',
    getManifest: () => ({ version: '1.0.0' }),
    onMessage: { addListener: (fn: Listener) => (listeners.message = fn) },
  },
  storage: {
    session: {
      get: vi.fn(async (k: string | null) =>
        k === null ? { ...store } : k in store ? { [k]: store[k] } : {},
      ),
      set: vi.fn(async (o: Record<string, unknown>) => void Object.assign(store, o)),
      remove: vi.fn(async (k: string) => void delete store[k]),
    },
  },
  tabs: {
    create: vi.fn(async () => ({ id: 7 })),
    update: vi.fn(async () => ({})),
    reload: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    onRemoved: { addListener: (fn: Listener) => (listeners.removed = fn) },
  },
  webNavigation: { onCommitted: { addListener: (fn: Listener) => (listeners.committed = fn) } },
  scripting: { executeScript: vi.fn(async () => [{ result: 'live' }]) },
  userScripts: undefined as unknown,
};
vi.stubGlobal('chrome', chromeMock);
await import('./background');

const state = (js = 'go()'): PreviewState => ({
  experimentKey: 'hero',
  experimentName: 'Hero',
  variants: [
    { key: 'control', name: 'Control' },
    { key: 'b', name: 'B', js, css: '.x{}' },
  ],
  variantKey: 'b',
  source: 'live',
});

function send(from: 'dashboard' | 'page', request: unknown, tabId: number, origin: string) {
  return new Promise<{ ok: boolean; result?: unknown; error?: string }>((resolve) => {
    listeners.message!(
      { from, request } as never,
      { id: 'ext', tab: { id: tabId }, origin } as never,
      resolve as never,
    );
  });
}
const DASH = 'https://splitcraft-app.vercel.app';

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.clearAllMocks();
});

describe('service worker', () => {
  it('answers pings from the dashboard only', async () => {
    expect(await send('dashboard', { type: 'ping' }, 1, DASH)).toEqual({
      ok: true,
      result: { version: '1.0.0', userScripts: false },
    });
    expect((await send('dashboard', { type: 'ping' }, 1, 'https://evil.test')).ok).toBe(false);
  });

  it('opens the page and injects the preview on each page load of that site', async () => {
    const res = await send(
      'dashboard',
      { type: 'open', url: 'https://shop.test/p', hosts: ['shop.test'], state: state() },
      1,
      DASH,
    );
    expect(res).toEqual({ ok: true, result: { tabId: 7 } });
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, { url: 'https://shop.test/p' });

    listeners.committed!({ tabId: 7, frameId: 0, url: 'https://shop.test/p' } as never);
    await vi.waitFor(() => expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(3));
    const files = chromeMock.scripting.executeScript.mock.calls.map((c) => (c as never[])[0]);
    expect(files[1]).toMatchObject({ files: ['splitcraft-preview.iife.js'], world: 'MAIN' });
    expect(files[2]).toMatchObject({ args: [state(), false], world: 'MAIN' });

    // Leaving the site ends the preview and tells the dashboard.
    listeners.committed!({ tabId: 7, frameId: 0, url: 'https://other.test/' } as never);
    await vi.waitFor(() =>
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'stopped',
        experimentKey: 'hero',
      }),
    );
    expect(store['tab:7']).toBeUndefined();
  });

  it('refuses pages outside the project', async () => {
    const res = await send(
      'dashboard',
      { type: 'open', url: 'https://evil.test/', hosts: ['shop.test'], state: state() },
      1,
      DASH,
    );
    expect(res.ok).toBe(false);
  });

  it('applies CSS edits live and reloads for JS edits', async () => {
    store['tab:7'] = { state: state(), hosts: ['shop.test'], dashboardTabId: 1 };
    await send('dashboard', { type: 'update', state: state() }, 1, DASH);
    expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
    chromeMock.scripting.executeScript.mockResolvedValueOnce([{ result: 'rerun' }]);
    await send('dashboard', { type: 'update', state: state('other()') }, 1, DASH);
    expect(chromeMock.tabs.reload).toHaveBeenCalledWith(7);
    // Another dashboard tab's edits don't touch this preview.
    chromeMock.tabs.reload.mockClear();
    chromeMock.scripting.executeScript.mockClear();
    await send('dashboard', { type: 'update', state: state('x()') }, 2, DASH);
    expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('lets the page panel switch or stop, but never send code', async () => {
    store['tab:7'] = { state: state(), hosts: ['shop.test'], dashboardTabId: 1 };
    await send('page', { type: 'switch', variantKey: 'control' }, 7, 'https://shop.test');
    expect((store['tab:7'] as { state: PreviewState }).state.variantKey).toBe('control');
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'switched',
      experimentKey: 'hero',
      variantKey: 'control',
    });
    await send('page', { type: 'update', state: state('steal()') }, 7, 'https://shop.test');
    expect((store['tab:7'] as { state: PreviewState }).state.variants[1]!.js).toBe('go()');
    await send('page', { type: 'stop' }, 7, 'https://shop.test');
    expect(store['tab:7']).toBeUndefined();
  });
});
