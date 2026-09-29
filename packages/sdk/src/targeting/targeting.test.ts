import { makeContext, NOW } from '../test/context';
import {
  evaluateTargeting,
  matchesWithoutElements,
  matchFrequency,
  matchWhereUrl,
  waitForDataLayer,
  type Targeting,
} from './index';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('matchWhereUrl', () => {
  const trips = 'https://mytrips.dev/trips/lisbon';

  it('matches every page when there are no include rules', () => {
    expect(matchWhereUrl(trips, undefined)).toBe(true);
    expect(matchWhereUrl(trips, { include: [] })).toBe(true);
  });

  it('ORs include rules', () => {
    const where = {
      include: [
        { op: 'matches' as const, value: '/checkout/*' },
        { op: 'matches' as const, value: '/trips/*' },
      ],
    };
    expect(matchWhereUrl(trips, where)).toBe(true);
    expect(matchWhereUrl('https://mytrips.dev/about', where)).toBe(false);
  });

  it('lets exclude win over include', () => {
    const where = {
      include: [{ op: 'matches' as const, value: '/trips/*' }],
      exclude: [{ op: 'contains' as const, value: 'lisbon' }],
    };
    expect(matchWhereUrl(trips, where)).toBe(false);
    expect(matchWhereUrl('https://mytrips.dev/trips/porto', where)).toBe(true);
  });

  it('applies exclude when there are no include rules', () => {
    expect(matchWhereUrl(trips, { exclude: [{ op: 'is', value: '/trips/lisbon' }] })).toBe(false);
  });
});

describe('matchFrequency', () => {
  const seen = (lastAt: number, lastSessionId = 's_old') =>
    makeContext({ exposure: { lastAt, lastSessionId } });

  it('always matches before the first exposure', () => {
    for (const when of [
      { mode: 'once' as const },
      { mode: 'once_per_session' as const },
      { mode: 'every_n_days' as const, days: 7 },
    ]) {
      expect(matchFrequency(when, makeContext())).toBe(true);
    }
  });

  it('every_load and no rule always match', () => {
    expect(matchFrequency(undefined, seen(NOW))).toBe(true);
    expect(matchFrequency({ mode: 'every_load' }, seen(NOW))).toBe(true);
  });

  it('once never matches again', () => {
    expect(matchFrequency({ mode: 'once' }, seen(NOW - 30 * DAY))).toBe(false);
  });

  it('once_per_session matches only in a new session', () => {
    expect(matchFrequency({ mode: 'once_per_session' }, seen(NOW - HOUR, 's_old'))).toBe(true);
    expect(matchFrequency({ mode: 'once_per_session' }, seen(NOW - HOUR, 's_current'))).toBe(false);
  });

  it('every_n_days matches once N days have passed', () => {
    expect(matchFrequency({ mode: 'every_n_days', days: 7 }, seen(NOW - 6 * DAY))).toBe(false);
    expect(matchFrequency({ mode: 'every_n_days', days: 7 }, seen(NOW - 7 * DAY))).toBe(true);
  });
});

describe('matchesWithoutElements', () => {
  const targeting: Targeting = {
    who: [{ mode: 'all', items: [{ type: 'visitor_type', value: 'returning' }] }],
    where: { include: [{ op: 'matches', value: '/trips/*' }] },
    how: [{ mode: 'any', items: [{ type: 'pages_viewed_session', op: 'gte', value: 2 }] }],
    when: { mode: 'once_per_session' },
  };
  const ctx = makeContext({ url: 'https://mytrips.dev/trips/lisbon' });

  it('matches when WHO, WHERE, HOW and WHEN all match', () => {
    expect(matchesWithoutElements(targeting, ctx)).toBe(true);
  });

  it('fails when any one part fails', () => {
    expect(matchesWithoutElements(targeting, { ...ctx, url: 'https://mytrips.dev/' })).toBe(false);
    expect(
      matchesWithoutElements(targeting, { ...ctx, visitor: { ...ctx.visitor, isNew: true } }),
    ).toBe(false);
    expect(
      matchesWithoutElements(targeting, {
        ...ctx,
        visitor: { ...ctx.visitor, pagesViewedThisSession: 1 },
      }),
    ).toBe(false);
    expect(
      matchesWithoutElements(targeting, {
        ...ctx,
        exposure: { lastAt: NOW, lastSessionId: 's_current' },
      }),
    ).toBe(false);
  });

  it('matches everyone everywhere with empty targeting', () => {
    expect(matchesWithoutElements({}, makeContext())).toBe(true);
  });
});

describe('evaluateTargeting', () => {
  const present = new Set<string>();
  const observers = new Set<() => void>();

  beforeEach(() => {
    vi.useFakeTimers();
    present.clear();
    observers.clear();
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(private readonly cb: () => void) {}
        observe() {
          observers.add(this.cb);
        }
        disconnect() {
          observers.delete(this.cb);
        }
      },
    );
    vi.stubGlobal('document', {
      documentElement: {},
      querySelector: (s: string) => (present.has(s) ? ({} as Element) : null),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const addElement = (s: string) => {
    present.add(s);
    for (const cb of [...observers]) cb();
  };

  it('matches without waiting when there are no element rules', async () => {
    await expect(evaluateTargeting({}, makeContext())).resolves.toBe(true);
  });

  it('ANDs element rules: all must appear', async () => {
    const t: Targeting = { where: { elements: [{ selector: '#cta' }, { selector: '.price' }] } };
    addElement('#cta');
    const result = evaluateTargeting(t, makeContext());
    addElement('.price');
    await expect(result).resolves.toBe(true);
  });

  it('fails when one element never appears within its timeout', async () => {
    const t: Targeting = {
      where: { elements: [{ selector: '#cta' }, { selector: '.price', timeoutMs: 500 }] },
    };
    addElement('#cta');
    const result = evaluateTargeting(t, makeContext());
    vi.advanceTimersByTime(500);
    await expect(result).resolves.toBe(false);
  });

  it('waits 3 s by default', async () => {
    const t: Targeting = { where: { elements: [{ selector: '#late' }] } };
    const result = evaluateTargeting(t, makeContext());
    vi.advanceTimersByTime(2999);
    addElement('#late');
    await expect(result).resolves.toBe(true);

    const timedOut = evaluateTargeting(
      { where: { elements: [{ selector: '#never' }] } },
      makeContext(),
    );
    vi.advanceTimersByTime(3000);
    await expect(timedOut).resolves.toBe(false);
  });

  it('does not wait for elements when the URL does not match', async () => {
    const t: Targeting = {
      where: { include: [{ op: 'is', value: '/checkout' }], elements: [{ selector: '#cta' }] },
    };
    await expect(evaluateTargeting(t, makeContext())).resolves.toBe(false);
    expect(observers.size).toBe(0);
  });
});

describe('waitForDataLayer', () => {
  const t: Targeting = {
    how: [
      {
        mode: 'all',
        items: [
          {
            mode: 'any',
            items: [{ type: 'data_layer', key: 'pageType', op: 'is', value: 'trip' }],
          },
        ],
      },
    ],
  };

  it('resolves once the keys the rules use are in the dataLayer', async () => {
    vi.useFakeTimers();
    const dl: unknown[] = [];
    let done = false;
    void waitForDataLayer(t, 2000, () => dl).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(false);
    dl.push({ pageType: 'trip' });
    await vi.advanceTimersByTimeAsync(60);
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  it('gives up after the wait, and never waits without dataLayer rules', async () => {
    vi.useFakeTimers();
    let done = false;
    void waitForDataLayer(t, 300, () => []).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(350);
    expect(done).toBe(true);
    vi.useRealTimers();
    await expect(waitForDataLayer({}, 5000, () => [])).resolves.toBeUndefined();
  });
});
