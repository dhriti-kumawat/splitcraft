import { testUrl } from './urlTest';

const t = {
  where: {
    include: [
      { op: 'matches' as const, value: '/trips/*' },
      { op: 'regex' as const, value: '^https://mytrips\\.dev/deals/(summer|monsoon)' },
    ],
    exclude: [{ op: 'contains' as const, value: '/archive' }],
    elements: [{ selector: '.book-now-btn' }],
  },
  how: [
    {
      mode: 'all' as const,
      items: [{ type: 'pages_viewed_session' as const, op: 'gte' as const, value: 2 }],
    },
  ],
};

describe('testUrl', () => {
  it('matches include rules with the SDK matcher, even without a scheme', () => {
    const r = testUrl('mytrips.dev/trips/norway?utm_source=google', t);
    expect(r.matches).toBe(true);
    expect(r.lines.map((l) => [l.ok, l.text])).toEqual([
      [true, 'Where: matches /trips/*'],
      [null, 'Element .book-now-btn is checked on the page (waits up to 3 s)'],
      [null, 'Triggers are checked in the visit on the site'],
    ]);
  });

  it('lets exclude win', () => {
    const r = testUrl('https://mytrips.dev/trips/archive/2019', t);
    expect(r.matches).toBe(false);
    expect(r.lines[0]).toEqual({ ok: false, text: 'Excluded by contains /archive' });
  });

  it('reports when no include rule matches', () => {
    expect(testUrl('https://mytrips.dev/about', t).lines[0]).toEqual({
      ok: false,
      text: 'Where: matches none of 2 include rules',
    });
    expect(testUrl('https://mytrips.dev/deals/monsoon', t).matches).toBe(true);
  });

  it('matches every page without include rules, and rejects bad input', () => {
    expect(testUrl('https://x.dev/anything', {}).matches).toBe(true);
    expect(testUrl('http://', {}).valid).toBe(false);
  });
});
