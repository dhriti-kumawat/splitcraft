import { makeContext, NOW } from '../test/context';
import { dataLayerValue, evaluateCondition, evaluateGroup, evaluateGroups } from './conditions';
import type { Condition, ConditionGroup } from './types';

const DAY = 24 * 60 * 60 * 1000;
const yes: Condition = { type: 'visitor_type', value: 'returning' };
const no: Condition = { type: 'visitor_type', value: 'new' };

describe('evaluateCondition', () => {
  it('visitor_type', () => {
    expect(evaluateCondition(yes, makeContext())).toBe(true);
    expect(evaluateCondition(no, makeContext())).toBe(false);
    expect(evaluateCondition(no, makeContext({ visitor: { isNew: true } }))).toBe(true);
  });

  it('session_number and pages_viewed_session', () => {
    const ctx = makeContext({ visitor: { sessionNumber: 3, pagesViewedThisSession: 5 } });
    expect(evaluateCondition({ type: 'session_number', op: 'gte', value: 3 }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'session_number', op: 'gt', value: 3 }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'pages_viewed_session', op: 'gte', value: 4 }, ctx)).toBe(
      true,
    );
  });

  it('page_views_matching counts only matching views inside the window', () => {
    const ctx = makeContext({
      visitor: {
        history: [
          { url: 'https://mytrips.dev/trips/lisbon', at: NOW - 1 * DAY },
          { url: 'https://mytrips.dev/trips/porto', at: NOW - 2 * DAY },
          { url: 'https://mytrips.dev/about', at: NOW - 2 * DAY },
          { url: 'https://mytrips.dev/trips/rome', at: NOW - 10 * DAY },
        ],
      },
    });
    const rule = (count: number, days: number): Condition => ({
      type: 'page_views_matching',
      url: { op: 'matches', value: '/trips/*' },
      count,
      days,
    });
    expect(evaluateCondition(rule(2, 7), ctx)).toBe(true);
    expect(evaluateCondition(rule(3, 7), ctx)).toBe(false);
    expect(evaluateCondition(rule(3, 30), ctx)).toBe(true);
  });

  it('device_type and screen_width', () => {
    const ctx = makeContext({ device: { type: 'mobile', screenWidth: 390 } });
    expect(evaluateCondition({ type: 'device_type', value: ['mobile', 'tablet'] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'device_type', value: ['desktop'] }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'screen_width', op: 'lt', value: 768 }, ctx)).toBe(true);
  });

  it('country', () => {
    const ctx = makeContext({ country: 'GB' });
    expect(evaluateCondition({ type: 'country', op: 'is', value: ['GB', 'IE'] }, ctx)).toBe(true);
    expect(
      evaluateCondition(
        { type: 'country', op: 'is', value: 'GB' },
        makeContext({ country: undefined }),
      ),
    ).toBe(false);
  });

  it('utm reads first-touch or last-touch', () => {
    const ctx = makeContext({
      utm: { first: { source: 'google' }, last: { source: 'newsletter', medium: 'email' } },
    });
    const utm = (touch: 'first' | 'last', value: string): Condition => ({
      type: 'utm',
      param: 'source',
      touch,
      op: 'is',
      value,
    });
    expect(evaluateCondition(utm('first', 'google'), ctx)).toBe(true);
    expect(evaluateCondition(utm('last', 'google'), ctx)).toBe(false);
    expect(evaluateCondition(utm('last', 'newsletter'), ctx)).toBe(true);
    expect(
      evaluateCondition({ type: 'utm', param: 'campaign', touch: 'last', op: 'not_exists' }, ctx),
    ).toBe(true);
  });

  it('source_type', () => {
    const ctx = makeContext({ sourceType: 'paid' });
    expect(evaluateCondition({ type: 'source_type', value: ['paid', 'social'] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'source_type', value: ['organic'] }, ctx)).toBe(false);
  });

  it('cookie', () => {
    const ctx = makeContext({ cookies: { plan: 'pro', consent: '1' } });
    expect(evaluateCondition({ type: 'cookie', name: 'plan', op: 'is', value: 'PRO' }, ctx)).toBe(
      true,
    );
    expect(evaluateCondition({ type: 'cookie', name: 'consent', op: 'exists' }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'cookie', name: 'beta', op: 'exists' }, ctx)).toBe(false);
  });

  it('data_layer uses the latest pushed value', () => {
    const ctx = makeContext({
      dataLayer: [
        { event: 'page', user: { plan: 'free' } },
        { event: 'upgrade', user: { plan: 'pro' } },
        { event: 'click' },
      ],
    });
    expect(
      evaluateCondition({ type: 'data_layer', key: 'user.plan', op: 'is', value: 'pro' }, ctx),
    ).toBe(true);
    expect(evaluateCondition({ type: 'data_layer', key: 'cart.total', op: 'exists' }, ctx)).toBe(
      false,
    );
  });

  it('js_variable reads a dotted path on the global object', () => {
    const ctx = makeContext({ global: { app: { user: { plan: 'team', seats: 12 } } } });
    expect(
      evaluateCondition(
        { type: 'js_variable', path: 'app.user.plan', op: 'is', value: 'team' },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'js_variable', path: 'app.user.seats', op: 'is', value: '12' },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition({ type: 'js_variable', path: 'app.missing.deep', op: 'exists' }, ctx),
    ).toBe(false);
  });

  it('custom_js matches on a truthy return and fails closed on errors', () => {
    const ctx = makeContext();
    expect(evaluateCondition({ type: 'custom_js', code: 'return 1 + 1 === 2' }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'custom_js', code: 'return false' }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'custom_js', code: 'throw new Error("x")' }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'custom_js', code: 'return (' }, ctx)).toBe(false);
  });

  it('fails closed on an unknown condition type', () => {
    const unknown = { type: 'weather', value: 'sunny' } as unknown as Condition;
    expect(evaluateCondition(unknown, makeContext())).toBe(false);
  });
});

describe('evaluateGroup', () => {
  const ctx = makeContext();

  it('all / any / none', () => {
    expect(evaluateGroup({ mode: 'all', items: [yes, yes] }, ctx)).toBe(true);
    expect(evaluateGroup({ mode: 'all', items: [yes, no] }, ctx)).toBe(false);
    expect(evaluateGroup({ mode: 'any', items: [no, yes] }, ctx)).toBe(true);
    expect(evaluateGroup({ mode: 'any', items: [no, no] }, ctx)).toBe(false);
    expect(evaluateGroup({ mode: 'none', items: [no, no] }, ctx)).toBe(true);
    expect(evaluateGroup({ mode: 'none', items: [no, yes] }, ctx)).toBe(false);
  });

  it('treats an empty group as matching', () => {
    for (const mode of ['all', 'any', 'none'] as const) {
      expect(evaluateGroup({ mode, items: [] }, ctx)).toBe(true);
    }
  });

  it('evaluates nested groups', () => {
    // Returning visitors on mobile or tablet, but not from the UK.
    const group: ConditionGroup = {
      mode: 'all',
      items: [
        yes,
        {
          mode: 'any',
          items: [
            { type: 'device_type', value: ['mobile'] },
            { type: 'device_type', value: ['tablet'] },
          ],
        },
        { mode: 'none', items: [{ type: 'country', op: 'is', value: 'GB' }] },
      ],
    };
    expect(evaluateGroup(group, makeContext({ device: { type: 'tablet' }, country: 'FR' }))).toBe(
      true,
    );
    expect(evaluateGroup(group, makeContext({ device: { type: 'tablet' }, country: 'GB' }))).toBe(
      false,
    );
    expect(evaluateGroup(group, makeContext({ device: { type: 'desktop' }, country: 'FR' }))).toBe(
      false,
    );
  });

  it('stops evaluating once the result is known', () => {
    const spy = { type: 'custom_js', code: 'globalThis.__splitcraftCalls++; return true' } as const;
    (globalThis as Record<string, unknown>).__splitcraftCalls = 0;
    evaluateGroup({ mode: 'any', items: [yes, spy] }, ctx);
    evaluateGroup({ mode: 'all', items: [no, spy] }, ctx);
    expect((globalThis as Record<string, unknown>).__splitcraftCalls).toBe(0);
    delete (globalThis as Record<string, unknown>).__splitcraftCalls;
  });
});

describe('evaluateGroups', () => {
  it('ANDs top-level groups and matches everyone when empty', () => {
    const ctx = makeContext();
    expect(evaluateGroups(undefined, ctx)).toBe(true);
    expect(evaluateGroups([], ctx)).toBe(true);
    expect(
      evaluateGroups(
        [
          { mode: 'all', items: [yes] },
          { mode: 'any', items: [yes] },
        ],
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateGroups(
        [
          { mode: 'all', items: [yes] },
          { mode: 'any', items: [no] },
        ],
        ctx,
      ),
    ).toBe(false);
  });
});

describe('dataLayerValue', () => {
  it('skips gtag arguments objects and non-objects', () => {
    // gtag() pushes its `arguments` object, not a plain object.
    const toArguments = function () {
      // eslint-disable-next-line prefer-rest-params
      return arguments;
    } as (...args: unknown[]) => IArguments;
    const gtagArgs = toArguments('config', 'G-XXXX');
    expect(dataLayerValue([{ currency: 'GBP' }, gtagArgs, 'junk', null], 'currency')).toBe('GBP');
  });
});
