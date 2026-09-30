// @vitest-environment jsdom
import { bootBookmark } from './bookmark';
import type { PreviewApi } from './types';

const DASH = 'https://splitcraft-app.vercel.app';
const fakeApi = () =>
  ({
    start: vi.fn(),
    update: vi.fn(() => 'live' as const),
    rerun: vi.fn(),
    stop: vi.fn(),
    error: vi.fn(),
    helpers: {},
  }) satisfies PreviewApi;

const config = {
  experiments: [
    {
      key: 'hero',
      name: 'Hero test',
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B', css: '.x{}' },
      ],
    },
  ],
};

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('preview bookmark', () => {
  it('loads saved code from the token and variant in the hash', async () => {
    history.replaceState({}, '', '/after-redirect#splitcraft_preview=tok&splitcraft_force=hero:b');
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(config))));
    vi.stubGlobal('fetch', fetchMock);
    const api = fakeApi();
    const stop = bootBookmark(api, { dashboard: DASH, config: 'https://x.test/config/prj.json' });
    await vi.waitFor(() => expect(api.start).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('https://x.test/config/prj.json?preview=tok', {
      credentials: 'omit',
      cache: 'no-store',
    });
    expect(api.start.mock.calls[0]![0]).toMatchObject({
      experimentKey: 'hero',
      experimentName: 'Hero test',
      variantKey: 'b',
      source: 'saved',
    });
    stop();
  });

  it('explains what to do when the page was not opened from Splitcraft', async () => {
    const api = fakeApi();
    const stop = bootBookmark(api, { dashboard: DASH, config: 'https://x.test/c.json' });
    await vi.waitFor(() =>
      expect(api.error).toHaveBeenCalledWith(expect.stringMatching(/Preview on site/)),
    );
    stop();
  });

  it('takes live state only from the dashboard window that opened the page', async () => {
    const opener = { postMessage: vi.fn() };
    vi.stubGlobal('opener', opener);
    const api = fakeApi();
    const stop = bootBookmark(api, {
      dashboard: DASH,
      config: 'https://x.test/c.json',
      waitMs: 10_000,
    });
    expect(opener.postMessage).toHaveBeenCalledWith(
      { source: 'splitcraft-preview', type: 'hello' },
      DASH,
    );
    const live = { experimentKey: 'hero', experimentName: 'Hero', variants: [], variantKey: 'b' };
    const data = { source: 'splitcraft-dashboard', type: 'state', state: live };
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: 'https://evil.test',
        source: opener as unknown as Window,
      }),
    );
    expect(api.start).not.toHaveBeenCalled();
    window.dispatchEvent(
      new MessageEvent('message', { data, origin: DASH, source: opener as unknown as Window }),
    );
    expect(api.start).toHaveBeenCalledWith({ ...live, source: 'live' }, expect.any(Object));

    // Panel actions go back to the dashboard.
    const { onAction } = api.start.mock.calls[0]![1] as { onAction(a: unknown): void };
    onAction({ type: 'switch', variantKey: 'control' });
    expect(opener.postMessage).toHaveBeenLastCalledWith(
      { source: 'splitcraft-preview', type: 'switch', variantKey: 'control' },
      DASH,
    );
    stop();
  });
});
