// @vitest-environment jsdom
import {
  buildContext,
  classifySource,
  deviceType,
  loadState,
  recordExposure,
  recordPageview,
  saveState,
} from './context';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const T0 = Date.UTC(2026, 8, 29, 12);

afterEach(() => {
  localStorage.clear();
  document.cookie = 'plan=; Max-Age=0';
});

describe('recordPageview', () => {
  it('starts session 1 on the first page view', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/', '', T0);
    expect(state.s).toMatchObject({ n: 1, p: 1, src: 'direct' });
    expect(state.h).toEqual([['https://mytrips.dev/', T0]]);
  });

  it('counts pages within a session', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/', '', T0);
    recordPageview(state, 'https://mytrips.dev/trips', '', T0 + 5 * MIN);
    expect(state.s).toMatchObject({ n: 1, p: 2 });
  });

  it('starts a new session after 30 minutes of inactivity', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/', '', T0);
    const firstId = state.s!.id;
    recordPageview(state, 'https://mytrips.dev/', '', T0 + 29 * MIN);
    expect(state.s!.n).toBe(1);
    recordPageview(state, 'https://mytrips.dev/', '', T0 + 60 * MIN);
    expect(state.s).toMatchObject({ n: 2, p: 1 });
    expect(state.s!.id).not.toBe(firstId);
  });

  it('keeps first-touch UTMs and updates last-touch UTMs', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/?utm_source=google&utm_medium=cpc', '', T0);
    recordPageview(state, 'https://mytrips.dev/about', '', T0 + MIN);
    recordPageview(
      state,
      'https://mytrips.dev/?utm_source=newsletter&utm_medium=email',
      '',
      T0 + DAY,
    );
    expect(state.u.f).toEqual({ source: 'google', medium: 'cpc' });
    expect(state.u.l).toEqual({ source: 'newsletter', medium: 'email' });
  });

  it('classifies the source once per session', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/', 'https://www.google.com/', T0);
    recordPageview(state, 'https://mytrips.dev/trips', 'https://mytrips.dev/', T0 + MIN);
    expect(state.s!.src).toBe('organic');
  });

  it('keeps at most 50 history entries from the last 30 days', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/old', '', T0 - 31 * DAY);
    for (let i = 0; i < 60; i++) recordPageview(state, `https://mytrips.dev/${i}`, '', T0 + i);
    expect(state.h).toHaveLength(50);
    expect(state.h[0]![0]).toBe('https://mytrips.dev/10');
    expect(state.h.some(([url]) => url.endsWith('/old'))).toBe(false);
  });
});

describe('loadState / saveState', () => {
  it('round-trips through localStorage', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/', '', T0);
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('starts fresh on corrupted data', () => {
    localStorage.setItem('splitcraft_state', '{broken');
    expect(loadState()).toEqual({ h: [], x: {}, u: { f: {}, l: {} } });
    localStorage.setItem('splitcraft_state', '{"h":"nope"}');
    expect(loadState().h).toEqual([]);
  });
});

describe('buildContext', () => {
  it('fills the targeting context from state and the browser', () => {
    const state = loadState();
    recordPageview(state, 'https://mytrips.dev/?utm_source=google', '', T0);
    recordExposure(state, 'trust', T0);
    document.cookie = 'plan=pro';
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [{ plan: 'pro' }];

    const ctx = buildContext(state, 'trust', 'GB', T0 + MIN);
    expect(ctx.url).toBe(location.href);
    expect(ctx.visitor).toMatchObject({ isNew: true, sessionNumber: 1, pagesViewedThisSession: 1 });
    expect(ctx.visitor.history).toEqual([
      { url: 'https://mytrips.dev/?utm_source=google', at: T0 },
    ]);
    expect(ctx.utm.first).toEqual({ source: 'google' });
    expect(ctx.country).toBe('GB');
    expect(ctx.cookies.plan).toBe('pro');
    expect(ctx.dataLayer).toEqual([{ plan: 'pro' }]);
    expect(ctx.exposure).toEqual({ lastAt: T0, lastSessionId: state.s!.id });
    expect(buildContext(state, 'other', undefined, T0).exposure).toBeUndefined();
  });
});

describe('deviceType', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', 'mobile'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36', 'mobile'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'tablet'],
    ['Mozilla/5.0 (Linux; Android 15; SM-X910) Safari/537.36', 'tablet'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Safari/605.1.15', 'desktop'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0', 'desktop'],
  ])('%s is %s', (ua, expected) => {
    expect(deviceType(ua)).toBe(expected);
  });
});

describe('classifySource', () => {
  const host = 'mytrips.dev';
  it.each([
    ['', {}, 'direct'],
    ['https://mytrips.dev/trips', {}, 'direct'],
    ['https://www.google.com/', {}, 'organic'],
    ['https://duckduckgo.com/', {}, 'organic'],
    ['https://t.co/abc', {}, 'social'],
    ['https://www.linkedin.com/feed', {}, 'social'],
    ['https://blog.example.org/post', {}, 'referral'],
    ['https://www.google.com/', { medium: 'cpc' }, 'paid'],
    ['', { medium: 'email' }, 'email'],
    ['', { medium: 'social', source: 'instagram' }, 'social'],
    ['', { source: 'partner' }, 'referral'],
  ] as const)('%s %o is %s', (referrer, utm, expected) => {
    expect(classifySource(referrer, utm, host)).toBe(expected);
  });
});
