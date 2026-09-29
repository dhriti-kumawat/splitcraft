// @vitest-environment jsdom
import { boot, start, type ExperimentConfig, type ProjectConfig, type Runtime } from './runtime';
import { assignVariant } from './bucketing';
import { removeVariant, styleId } from './apply';
import type { QaSource } from './qa/types';

const exp = (overrides: Partial<ExperimentConfig> = {}): ExperimentConfig => ({
  key: 'trust',
  name: 'Trust badges',
  trafficPct: 100,
  variants: [
    { key: 'control', name: 'Control', weight: 0 },
    {
      key: 'b',
      name: 'B',
      weight: 100,
      css: '.badges{display:block}',
      js: 'window.__ran = (window.__ran || 0) + 1',
    },
  ],
  targeting: {},
  ...overrides,
});

const config = (
  experiments: ExperimentConfig[],
  extra: Partial<ProjectConfig> = {},
): ProjectConfig => ({
  projectKey: 'prj_test',
  eventsUrl: 'https://api.splitcraft.app/e',
  experiments,
  ...extra,
});

const ran = () => (window as unknown as { __ran?: number }).__ran ?? 0;
let beacon: ReturnType<typeof vi.fn>;
let runtime: Runtime | undefined;

async function allSentEvents(): Promise<Array<Record<string, unknown>>> {
  runtime?.stop();
  const bodies = await Promise.all(beacon.mock.calls.map(([, blob]) => (blob as Blob).text()));
  return bodies.flatMap((b) => JSON.parse(b).events);
}

/** Exposures and goals (the session ping has its own test). */
async function sentEvents(): Promise<Array<Record<string, unknown>>> {
  return (await allSentEvents()).filter((e) => e.type !== 'ping');
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  beacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  history.replaceState({}, '', '/trips/norway');
});

afterEach(() => {
  runtime?.stop();
  runtime = undefined;
  // applyVariant remembers where it ran; reset so each test starts clean.
  for (const key of ['trust', 'sticky']) removeVariant(key);
  delete (window as unknown as { __ran?: number }).__ran;
  delete window.splitcraftQa;
  localStorage.clear();
  sessionStorage.clear();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('start', () => {
  it('applies the bucketed variant and sends one exposure', async () => {
    runtime = start(config([exp()]));
    await settle();
    expect(document.getElementById(styleId('trust'))).not.toBeNull();
    expect(ran()).toBe(1);
    const events = await sentEvents();
    expect(events).toEqual([
      expect.objectContaining({ type: 'exposure', experimentKey: 'trust', variantKey: 'b' }),
    ]);
  });

  it('uses the same variant as assignVariant for this visitor', async () => {
    const e = exp({
      variants: [
        { key: 'control', name: 'Control', weight: 50 },
        { key: 'b', name: 'B', weight: 50 },
      ],
    });
    runtime = start(config([e]));
    await settle();
    const [exposure] = await sentEvents();
    const visitorId = exposure!.visitorId as string;
    expect(exposure!.variantKey).toBe(
      assignVariant(visitorId, { experimentKey: 'trust', trafficPct: 100, variants: e.variants }),
    );
  });

  it('does nothing when targeting does not match', async () => {
    runtime = start(
      config([exp({ targeting: { where: { include: [{ op: 'is', value: '/checkout' }] } } })]),
    );
    await settle();
    expect(ran()).toBe(0);
    expect(await sentEvents()).toEqual([]);
  });

  it('does nothing for visitors outside the traffic share', async () => {
    runtime = start(config([exp({ trafficPct: 0 })]));
    await settle();
    expect(ran()).toBe(0);
  });

  it('re-runs on SPA navigation and removes the variant when it no longer matches', async () => {
    runtime = start(
      config([exp({ targeting: { where: { include: [{ op: 'matches', value: '/trips/*' }] } } })]),
    );
    await settle();
    expect(document.getElementById(styleId('trust'))).not.toBeNull();

    history.pushState({}, '', '/about');
    await settle();
    expect(document.getElementById(styleId('trust'))).toBeNull();

    history.pushState({}, '', '/trips/lisbon');
    await settle();
    expect(ran()).toBe(2);
    const exposures = (await sentEvents()).filter((e) => e.type === 'exposure');
    expect(exposures).toHaveLength(2);
  });

  it('counts pages and sessions for targeting across navigations', async () => {
    runtime = start(
      config([
        exp({
          targeting: {
            how: [{ mode: 'all', items: [{ type: 'pages_viewed_session', op: 'gte', value: 2 }] }],
          },
        }),
      ]),
    );
    await settle();
    expect(ran()).toBe(0);
    history.pushState({}, '', '/trips/lisbon');
    await settle();
    expect(ran()).toBe(1);
  });

  it('lets variant code send events with splitcraft.trackEvent', async () => {
    runtime = start(
      config([
        exp({
          variants: [
            { key: 'b', name: 'B', weight: 1, js: 'splitcraft.trackEvent("trust_badges_seen")' },
          ],
        }),
      ]),
    );
    await settle();
    const goals = (await sentEvents()).filter((e) => e.type === 'goal');
    expect(goals.map((g) => g.key)).toEqual(['trust_badges_seen']);
  });

  it('runs custom JS trackers from the config', async () => {
    runtime = start(
      config([], {
        goals: {
          custom: [{ key: 'add_on', code: 'splitcraft.trackEvent("add_on", { value: 5 })' }],
        },
      }),
    );
    const goals = (await sentEvents()).filter((e) => e.type === 'goal');
    expect(goals.map((g) => [g.key, g.value])).toEqual([['add_on', 5]]);
  });

  it('tracks click goals and trackEvent calls', async () => {
    document.body.innerHTML = '<button class="book">Book now</button>';
    runtime = start(config([], { goals: { clicks: [{ key: 'book_click', selector: '.book' }] } }));
    document.querySelector<HTMLButtonElement>('.book')!.click();
    runtime.trackEvent('purchase', { value: 120 });
    const goals = (await sentEvents()).filter((e) => e.type === 'goal');
    expect(goals.map((g) => [g.key, g.value])).toEqual([
      ['book_click', undefined],
      ['purchase', 120],
    ]);
  });

  it('calls reveal after the first run', async () => {
    const reveal = vi.fn();
    runtime = start(config([exp()]), { reveal });
    await settle();
    expect(reveal).toHaveBeenCalledOnce();
  });

  it('never breaks the page when variant code throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runtime = start(
      config([exp({ variants: [{ key: 'b', name: 'B', weight: 1, js: 'throw new Error("x")' }] })]),
    );
    await settle();
    expect((await sentEvents())[0]).toMatchObject({ type: 'exposure' });
  });
});

describe('QA mode', () => {
  const panel = () => ({ mount: vi.fn<(source: QaSource) => () => void>(() => () => {}) });

  it('applies the forced variant even when the visitor would not qualify', async () => {
    history.replaceState({}, '', '/trips/norway?splitcraft_force=trust:control');
    const e = exp({
      trafficPct: 0,
      targeting: { who: [{ mode: 'all', items: [{ type: 'visitor_type', value: 'returning' }] }] },
      variants: [
        { key: 'control', name: 'Control', weight: 50, js: 'window.__ran = 99' },
        { key: 'b', name: 'B', weight: 50 },
      ],
    });
    window.splitcraftQa = panel();
    runtime = start(config([e]), { qaPanelUrl: '/qa.js' });
    await settle();
    expect(ran()).toBe(99);
  });

  it('still respects WHERE for forced variants', async () => {
    history.replaceState({}, '', '/about?splitcraft_force=trust:b');
    window.splitcraftQa = panel();
    runtime = start(
      config([exp({ targeting: { where: { include: [{ op: 'matches', value: '/trips/*' }] } } })]),
      { qaPanelUrl: '/qa.js' },
    );
    await settle();
    expect(ran()).toBe(0);
  });

  it('mounts the QA panel with forced and bucketed experiments', async () => {
    history.replaceState({}, '', '/trips/norway?splitcraft_force=trust:b');
    const qa = panel();
    window.splitcraftQa = qa;
    runtime = start(
      config([exp(), exp({ key: 'sticky', name: 'Sticky Book Now bar' })], {
        goals: { clicks: [{ key: 'book_click', selector: '.book' }] },
      }),
      { qaPanelUrl: '/qa.js' },
    );
    await settle();
    expect(qa.mount).toHaveBeenCalledOnce();
    const source = qa.mount.mock.calls[0]![0];
    const state = source.getState();
    expect(state.experiments.map((e) => [e.key, e.variantKey, e.assignedBy])).toEqual([
      ['trust', 'b', 'forced'],
      ['sticky', 'b', 'bucketed'],
    ]);
    expect(state.events).toEqual([
      { label: 'exposure · trust · b', sent: true },
      { label: 'exposure · sticky · b', sent: true },
      { label: 'book_click', sent: false },
    ]);
  });

  it('does not load the QA panel without a forced variant', async () => {
    runtime = start(config([exp()]), { qaPanelUrl: '/qa.js' });
    await settle();
    expect(document.head.querySelector('script')).toBeNull();
  });
});

describe('project switches', () => {
  it('runs on the first page only when SPA support is off', async () => {
    runtime = start({ ...config([exp()]), options: { spa: false } });
    await settle();
    history.pushState({}, '', '/trips/iceland');
    await settle();
    expect((await sentEvents()).filter((e) => e.type === 'exposure')).toHaveLength(1);
  });
});

describe('boot', () => {
  const script = (attrs: Record<string, string>) => {
    const s = document.createElement('script');
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    return s;
  };

  it('fetches the project config next to the script and starts', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(config([exp()])))));
    vi.stubGlobal('fetch', fetchMock);
    runtime = (await boot(
      script({ src: 'https://splitcraft.vercel.app/sdk/v1.js', 'data-project': 'prj_1' }),
    ))!;
    expect(fetchMock).toHaveBeenCalledWith('https://splitcraft.vercel.app/v1/config/prj_1.json', {
      credentials: 'omit',
    });
    await settle();
    expect(ran()).toBe(1);
  });

  it('hides the page until the variants are applied', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', () => new Promise<Response>((r) => (resolveFetch = r)));
    const booting = boot(
      script({ src: 'https://splitcraft.vercel.app/sdk/v1.js', 'data-project': 'prj_1' }),
    );
    expect(document.getElementById('splitcraft-antiflicker')).not.toBeNull();
    resolveFetch(new Response(JSON.stringify(config([exp()]))));
    runtime = (await booting)!;
    await settle();
    expect(document.getElementById('splitcraft-antiflicker')).toBeNull();
  });

  it("doesn't hide the page when the snippet turns anti-flicker off", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', () => new Promise<Response>((r) => (resolveFetch = r)));
    const booting = boot(
      script({
        src: 'https://splitcraft.vercel.app/sdk/v1.js',
        'data-project': 'prj_1',
        'data-antiflicker': 'off',
      }),
    );
    expect(document.getElementById('splitcraft-antiflicker')).toBeNull();
    resolveFetch(new Response(JSON.stringify(config([exp()]))));
    runtime = (await booting)!;
  });

  it('shows the page and gives up when the config cannot load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 404 })));
    const rt = await boot(
      script({ src: 'https://splitcraft.vercel.app/sdk/v1.js', 'data-project': 'prj_1' }),
    );
    expect(rt).toBeNull();
    expect(document.getElementById('splitcraft-antiflicker')).toBeNull();
  });

  it('uses data-config when given, and does nothing without data-project', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(config([])))));
    vi.stubGlobal('fetch', fetchMock);
    expect(await boot(script({ src: '/v1.js' }))).toBeNull();
    runtime = (await boot(
      script({ src: '/v1.js', 'data-project': 'prj_1', 'data-config': 'https://api.test/c.json' }),
    ))!;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]).toEqual(['https://api.test/c.json', { credentials: 'omit' }]);
  });
});

describe('session ping', () => {
  it('includes the country when the config has one', async () => {
    localStorage.clear();
    runtime = start({
      projectKey: 'prj_test',
      eventsUrl: 'https://e.test',
      experiments: [],
      country: 'IN',
    });
    await settle();
    const [ping] = (await allSentEvents()).filter((e) => e.type === 'ping');
    expect(ping).toMatchObject({ props: { c: 'IN' } });
  });

  it('sends one ping per session with what reach estimates need', async () => {
    localStorage.clear();
    history.replaceState({}, '', '/trips/norway?utm_source=news&utm_medium=email');
    runtime = start({ projectKey: 'prj_test', eventsUrl: 'https://e.test', experiments: [] });
    await settle();
    history.pushState({}, '', '/trips/iceland');
    await settle();
    const pings = (await allSentEvents()).filter((e) => e.type === 'ping');
    expect(pings).toHaveLength(1);
    expect(pings[0]).toMatchObject({
      url: expect.stringContaining('/trips/norway'),
      props: {
        d: 'desktop',
        s: 'email',
        n: 1,
        uf: { source: 'news', medium: 'email' },
      },
    });
  });
});
