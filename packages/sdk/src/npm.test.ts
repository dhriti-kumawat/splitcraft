// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { init, ready, subscribe, variant } from './index';
import { useExperiment } from './react';
import type { ProjectConfig } from './runtime';

const config: ProjectConfig = {
  projectKey: 'prj_test',
  eventsUrl: 'https://e.test/events',
  experiments: [
    {
      key: 'hero',
      name: 'Hero',
      trafficPct: 100,
      variants: [
        { key: 'control', name: 'Control', weight: 0 },
        { key: 'b', name: 'B', weight: 100 },
      ],
      targeting: {},
    },
  ],
};

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  Object.defineProperty(navigator, 'sendBeacon', { value: () => true, configurable: true });
});

describe('npm entry', () => {
  it('init fetches the config, starts without hiding the page, and exposes variants', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(config)));
    vi.stubGlobal('fetch', fetchMock);
    const changes = vi.fn();
    const unsubscribe = subscribe(changes);
    expect(ready()).toBe(false);
    expect(variant('hero')).toBeNull();

    const pending = init({ project: 'prj_test', base: 'https://cdn.test/sdk/' });
    expect(document.getElementById('splitcraft-antiflicker')).toBeNull();
    const rt = await pending;
    await settle();
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/v1/config/prj_test.json', {
      credentials: 'omit',
    });
    expect(ready()).toBe(true);
    expect(variant('hero')).toBe('b');
    expect(variant('unknown')).toBeNull();
    expect(changes).toHaveBeenCalled();
    unsubscribe();
    rt?.stop();
    vi.unstubAllGlobals();
  });
});

describe('useExperiment', () => {
  it('renders with the visitor’s variant once the SDK is ready', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const seen: string[] = [];
    function Hero() {
      const { variant: v, ready: r } = useExperiment('hero');
      seen.push(`${r}:${v}`);
      return createElement('p', null, v === 'b' ? 'New hero' : 'Old hero');
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(createElement(Hero)));
    // The previous test already started the SDK, so it is ready with variant b.
    expect(host.textContent).toBe('New hero');
    expect(seen[seen.length - 1]).toBe('true:b');
    await act(async () => root.unmount());
  });
});

describe('isEnabled', () => {
  it('is false before the config loads and reads the flag after', async () => {
    const { isEnabled, start: startSdk } = await import('./index');
    expect(isEnabled('beta-checkout')).toBe(false);
    const rt = startSdk({
      projectKey: 'prj_flags',
      eventsUrl: 'https://e.test/events',
      experiments: [
        {
          key: 'beta-checkout',
          name: 'Beta checkout',
          trafficPct: 100,
          variants: [{ key: 'on', name: 'On', weight: 1 }],
          targeting: {},
          flag: true,
        },
      ],
    });
    await settle();
    expect(isEnabled('beta-checkout')).toBe(true);
    expect(isEnabled('missing')).toBe(false);
    rt.stop();
  });
});
