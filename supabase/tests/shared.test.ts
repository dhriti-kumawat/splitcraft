import { toSdkConfig, toSdkTargeting } from '../functions/_shared/config.ts';
import { cleanEvent, hostFromOrigin, MAX_EVENTS, parseBatch } from '../functions/_shared/events.ts';
import type { ConditionGroup, ConfigSource } from '../functions/_shared/types.ts';

const KEY = 'prj_0123456789abcdef0123456789abcdef';
const goal = {
  type: 'goal',
  key: 'purchase',
  visitorId: 'v_0123456789abcdef01234567',
  url: 'https://mytrips.dev/',
  at: 1,
};

describe('parseBatch', () => {
  it('accepts a valid batch', () => {
    expect(parseBatch(JSON.stringify({ projectKey: KEY, events: [goal] }))).toEqual({
      ok: true,
      projectKey: KEY,
      events: [{ type: 'goal', key: 'purchase', visitorId: goal.visitorId, url: goal.url }],
    });
  });

  it('rejects malformed batches', () => {
    expect(parseBatch('{nope')).toMatchObject({ ok: false, error: 'invalid JSON' });
    expect(parseBatch('[]')).toMatchObject({ ok: false, error: 'invalid batch' });
    expect(parseBatch(JSON.stringify({ projectKey: 'prj_bad', events: [goal] }))).toMatchObject({
      ok: false,
      error: 'invalid projectKey',
    });
    expect(parseBatch(JSON.stringify({ projectKey: KEY, events: [] }))).toMatchObject({
      ok: false,
    });
    const tooMany = Array.from({ length: MAX_EVENTS + 1 }, () => goal);
    expect(parseBatch(JSON.stringify({ projectKey: KEY, events: tooMany }))).toMatchObject({
      ok: false,
    });
    expect(parseBatch('x'.repeat(64 * 1024 + 1))).toMatchObject({
      ok: false,
      error: 'body too large',
    });
  });

  it('drops invalid events but keeps the valid ones', () => {
    const result = parseBatch(
      JSON.stringify({ projectKey: KEY, events: [goal, { type: 'hack' }, null] }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.events).toHaveLength(1);
  });
});

describe('cleanEvent', () => {
  it('keeps a session ping with its traits, and drops one without them', () => {
    const ping = {
      type: 'ping',
      visitorId: goal.visitorId,
      url: goal.url,
      props: { d: 'mobile', n: 2 },
    };
    expect(cleanEvent(ping)).toEqual(ping);
    expect(cleanEvent({ ...ping, props: undefined })).toBeNull();
    expect(cleanEvent({ ...ping, props: { big: 'x'.repeat(3000) } })).toBeNull();
  });

  it('keeps exposure fields', () => {
    expect(
      cleanEvent({
        ...goal,
        type: 'exposure',
        key: undefined,
        experimentKey: 'trust',
        variantKey: 'b',
      }),
    ).toEqual({
      type: 'exposure',
      experimentKey: 'trust',
      variantKey: 'b',
      visitorId: goal.visitorId,
      url: goal.url,
    });
  });

  it('keeps finite values and small props on goals', () => {
    expect(cleanEvent({ ...goal, value: 49.5, props: { currency: 'GBP' } })).toMatchObject({
      value: 49.5,
      props: { currency: 'GBP' },
    });
    expect(cleanEvent({ ...goal, value: 'NaN' })).not.toHaveProperty('value');
    expect(cleanEvent({ ...goal, props: { big: 'x'.repeat(3000) } })).not.toHaveProperty('props');
    expect(cleanEvent({ ...goal, props: ['not', 'an', 'object'] })).not.toHaveProperty('props');
  });

  it('drops unknown fields', () => {
    expect(cleanEvent({ ...goal, project_id: 'someone-else', created_at: 0 })).not.toHaveProperty(
      'project_id',
    );
  });

  it.each([
    ['unknown type', { ...goal, type: 'ping' }],
    ['bad visitor id', { ...goal, visitorId: '<script>' }],
    ['missing url', { ...goal, url: undefined }],
    ['non-http url', { ...goal, url: 'javascript:alert(1)' }],
    ['long url', { ...goal, url: `https://a.dev/${'x'.repeat(2050)}` }],
    ['bad goal key', { ...goal, key: 'has spaces' }],
    ['exposure without experiment', { ...goal, type: 'exposure', variantKey: 'b' }],
    [
      'exposure with bad variant',
      { ...goal, type: 'exposure', experimentKey: 'trust', variantKey: '' },
    ],
  ])('rejects %s', (_, event) => {
    expect(cleanEvent(event)).toBeNull();
  });
});

describe('hostFromOrigin', () => {
  it('returns the hostname without port', () => {
    expect(hostFromOrigin('https://www.mytrips.dev')).toBe('www.mytrips.dev');
    expect(hostFromOrigin('http://localhost:5173')).toBe('localhost');
    expect(hostFromOrigin(null)).toBe('');
    expect(hostFromOrigin('null')).toBe('');
  });
});

describe('toSdkTargeting', () => {
  const returning: ConditionGroup = {
    mode: 'all',
    items: [{ type: 'visitor_type', value: 'returning' }],
  };
  const mobile: ConditionGroup = {
    mode: 'all',
    items: [{ type: 'device_type', value: ['mobile'] }],
  };
  const segments = { s1: returning, s2: mobile };

  it('ANDs segments in "all" mode', () => {
    expect(
      toSdkTargeting({ who: { mode: 'all', segmentIds: ['s1', 's2'] } }, segments).who,
    ).toEqual([returning, mobile]);
  });

  it('wraps segments in one ANY group in "any" mode', () => {
    expect(
      toSdkTargeting({ who: { mode: 'any', segmentIds: ['s1', 's2'] } }, segments).who,
    ).toEqual([{ mode: 'any', items: [returning, mobile] }]);
  });

  it('turns a deleted segment into "matches nobody" rather than dropping it', () => {
    const who = toSdkTargeting({ who: { mode: 'all', segmentIds: ['gone'] } }, segments).who!;
    expect(who[0]).toEqual({ mode: 'none', items: [{ mode: 'all', items: [] }] });
  });

  it('omits empty parts', () => {
    expect(toSdkTargeting({ who: { mode: 'all', segmentIds: [] }, how: [] }, segments)).toEqual({});
  });
});

describe('toSdkConfig goals', () => {
  const metric = (source: string, sourceConfig: Record<string, unknown>) => ({
    id: 'm1',
    eventKey: 'goal_key',
    source,
    sourceConfig,
  });
  const build = (m: ReturnType<typeof metric>) =>
    toSdkConfig(
      {
        experiments: [
          { key: 'e', name: 'E', trafficPct: 100, targeting: {}, metricIds: ['m1'], variants: [] },
        ],
        segments: {},
        metrics: [m],
      },
      'prj_x',
      '/e',
    ).goals;

  it('skips pageview goals with an operator the SDK does not know', () => {
    expect(build(metric('pageview', { url: { op: 'startsWith', value: '/a' } })).pageviews).toEqual(
      [],
    );
    expect(build(metric('pageview', { url: { op: 'is', value: '/a' } })).pageviews).toHaveLength(1);
  });

  it('skips click goals without a selector', () => {
    expect(build(metric('click', {})).clicks).toEqual([]);
    expect(build(metric('click', { selector: '' })).clicks).toEqual([]);
  });

  it('includes custom JS trackers with their pages', () => {
    expect(
      build(
        metric('custom_js', {
          code: 'splitcraft.trackEvent("goal_key")',
          pages: [{ op: 'matches', value: '/trips/*' }, { op: 'bad' }],
        }),
      ).custom,
    ).toEqual([
      {
        key: 'goal_key',
        code: 'splitcraft.trackEvent("goal_key")',
        pages: [{ op: 'matches', value: '/trips/*' }],
      },
    ]);
    expect(build(metric('custom_js', { code: '  ' })).custom).toEqual([]);
  });

  it('leaves out a dataLayer goal without an event name', () => {
    expect(build(metric('datalayer', { event: '' }))).toEqual({
      clicks: [],
      pageviews: [],
      custom: [],
      datalayer: [],
      transactions: [],
    });
  });
});

describe('toSdkConfig: dataLayer and transaction goals', () => {
  const source = (metrics: ConfigSource['metrics']): ConfigSource => ({
    experiments: [
      {
        key: 'x',
        name: 'X',
        trafficPct: 100,
        targeting: {},
        metricIds: metrics.map((m) => m.id),
        variants: [],
      },
    ],
    segments: {},
    metrics,
  });

  it('passes dataLayer goals with valid filters, and transactions with default paths', () => {
    const config = toSdkConfig(
      source([
        {
          id: 'a',
          eventKey: 'cart',
          source: 'datalayer',
          sourceConfig: {
            event: 'add_to_cart',
            filters: [
              { path: 'ecommerce.currency', op: 'is', value: 'INR' },
              { path: 'x', op: 'drop table' },
            ],
            valuePath: 'ecommerce.value',
          },
        },
        { id: 'b', eventKey: 'purchase', source: 'transaction', sourceConfig: {} },
      ]),
      'prj_x',
      '/e',
    );
    expect(config.goals.datalayer).toEqual([
      {
        key: 'cart',
        event: 'add_to_cart',
        filters: [{ path: 'ecommerce.currency', op: 'is', value: 'INR' }],
        valuePath: 'ecommerce.value',
      },
    ]);
    expect(config.goals.transactions).toEqual([
      {
        key: 'purchase',
        event: 'purchase',
        valuePath: 'ecommerce.value',
        idPath: 'ecommerce.transaction_id',
        currencyPath: 'ecommerce.currency',
      },
    ]);
  });
});

describe('toSdkConfig: browsing and Web Vitals goals', () => {
  it('lists the kinds used, and nothing when none are', () => {
    const src = (metrics: ConfigSource['metrics']): ConfigSource => ({
      experiments: [
        {
          key: 'x',
          name: 'X',
          trafficPct: 100,
          targeting: {},
          metricIds: metrics.map((m) => m.id),
          variants: [],
        },
      ],
      segments: {},
      metrics,
    });
    const goals = toSdkConfig(
      src([
        { id: 'a', eventKey: 'browse.page', source: 'browsing', sourceConfig: { kind: 'pages' } },
        { id: 'b', eventKey: 'vitals.lcp', source: 'web_vitals', sourceConfig: { vital: 'lcp' } },
        { id: 'c', eventKey: 'vitals.x', source: 'web_vitals', sourceConfig: { vital: 'fid' } },
      ]),
      'prj_x',
      '/e',
    ).goals;
    expect(goals.browsing).toEqual(['pages']);
    expect(goals.vitals).toEqual(['lcp']);
    expect(toSdkConfig(src([]), 'prj_x', '/e').goals).not.toHaveProperty('vitals');
  });
});
