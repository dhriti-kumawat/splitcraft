import { EXPERIMENTS } from '../test/fakeData';
import {
  extensionVersion,
  openForBookmark,
  openWithExtension,
  pingExtension,
  previewState,
  stopPreview,
  updatePreview,
} from './previewBridge';

const exp = EXPERIMENTS.find((e) => e.id === 'trust')!;

afterEach(() => {
  stopPreview();
  delete document.documentElement.dataset.splitcraftPreview;
  vi.unstubAllGlobals();
});

describe('previewState', () => {
  it('takes the editor’s variants and starts on the first variant', () => {
    const state = previewState(exp, [
      { key: 'control', name: 'Control', js: '', css: '' },
      { key: 'b', name: 'B', js: 'go()', css: '' },
    ]);
    expect(state).toMatchObject({ experimentKey: 'trust', variantKey: 'b', source: 'live' });
    expect(state.variants[1]).toEqual({ key: 'b', name: 'B', js: 'go()', css: '', url: undefined });
  });
});

describe('bookmark tab', () => {
  it('answers the page that says hello, at its origin, and sends later edits', () => {
    const win = { postMessage: vi.fn() };
    vi.stubGlobal(
      'open',
      vi.fn(() => win),
    );
    expect(openForBookmark('https://larkspurtravel.com/?x', previewState(exp))).toBe(true);
    expect(window.open).toHaveBeenCalledWith('https://larkspurtravel.com/?x', '_blank');

    const hello = (source: unknown) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'splitcraft-preview', type: 'hello' },
          origin: 'https://www.larkspurtravel.com',
          source: source as Window,
        }),
      );
    hello({ postMessage: vi.fn() }); // Another window: ignored.
    expect(win.postMessage).not.toHaveBeenCalled();
    hello(win);
    expect(win.postMessage).toHaveBeenCalledWith(
      { source: 'splitcraft-dashboard', type: 'state', state: previewState(exp) },
      'https://www.larkspurtravel.com',
    );

    const edited = previewState(exp, [
      { key: 'control', name: 'Control' },
      { key: 'b', name: 'B', css: '.x{}' },
    ]);
    updatePreview(edited);
    expect(win.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: expect.objectContaining({ variants: edited.variants }) }),
      'https://www.larkspurtravel.com',
    );
    updatePreview({ ...edited, variantKey: 'control' }, true);
    expect(win.postMessage.mock.lastCall![0].state.variantKey).toBe('control');

    stopPreview();
    expect(win.postMessage).toHaveBeenLastCalledWith(
      { source: 'splitcraft-dashboard', type: 'stop' },
      'https://www.larkspurtravel.com',
    );
  });

  it('reports a blocked pop-up', () => {
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    );
    expect(openForBookmark('https://larkspurtravel.com/', previewState(exp))).toBe(false);
  });
});

describe('extension', () => {
  /** Plays the extension's content script: answers requests posted by the page. */
  function fakeExtension(answer: (req: { type: string }) => unknown) {
    document.documentElement.dataset.splitcraftPreview = '1.0.0';
    const requests: Array<{ type: string }> = [];
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; id?: number; request?: { type: string } };
      if (d?.source !== 'splitcraft-dashboard') return;
      requests.push(d.request!);
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            source: 'splitcraft-extension',
            id: d.id,
            reply: { ok: true, result: answer(d.request!) },
          },
          source: window,
        }),
      );
    };
    window.addEventListener('message', onMessage);
    return { requests, done: () => window.removeEventListener('message', onMessage) };
  }

  it('is found through the content script and asked to open and update the preview', async () => {
    expect(extensionVersion()).toBeNull();
    expect(await pingExtension()).toBeNull();
    const ext = fakeExtension((r) =>
      r.type === 'ping' ? { version: '1.0.0', userScripts: true } : {},
    );
    expect(await pingExtension()).toEqual({ version: '1.0.0', userScripts: true });
    await openWithExtension(
      'https://larkspurtravel.com/',
      ['larkspurtravel.com'],
      previewState(exp),
    );
    expect(ext.requests.at(-1)).toMatchObject({
      type: 'open',
      url: 'https://larkspurtravel.com/',
      hosts: ['larkspurtravel.com'],
    });
    updatePreview(previewState(exp));
    await vi.waitFor(() =>
      expect(ext.requests.at(-1)).toMatchObject({ type: 'update', select: false }),
    );
    stopPreview();
    await vi.waitFor(() =>
      expect(ext.requests.at(-1)).toEqual({ type: 'stop', experimentKey: 'trust' }),
    );
    ext.done();
  });
});
