import type { SessionPing } from '../data/api';
import { SESSION_SAMPLE } from '../test/fakeData';
import { evaluateCondition, evaluateGroup, evaluateTargeting, formatRange, share } from './reach';
import type { ConditionGroup } from './targeting';

const ping = (
  p: Partial<SessionPing['props']> = {},
  url = 'https://s.dev/trips/oslo',
): SessionPing => ({
  url,
  props: { d: 'mobile', w: 390, s: 'paid', n: 1, ...p },
});

describe('reach conditions', () => {
  it('checks the traits a session ping carries', () => {
    expect(evaluateCondition({ type: 'visitor_type', value: 'new' }, ping())).toBe(true);
    expect(evaluateCondition({ type: 'session_number', op: 'gte', value: 2 }, ping())).toBe(false);
    expect(evaluateCondition({ type: 'device_type', value: ['mobile', 'tablet'] }, ping())).toBe(
      true,
    );
    expect(evaluateCondition({ type: 'screen_width', op: 'gte', value: 768 }, ping())).toBe(false);
    expect(evaluateCondition({ type: 'source_type', value: ['paid'] }, ping())).toBe(true);
    expect(
      evaluateCondition(
        { type: 'utm', param: 'campaign', touch: 'first', op: 'is', value: 'summer' },
        ping({ uf: { campaign: 'summer' } }),
      ),
    ).toBe(true);
  });

  it("says unknown for what needs the live page, or country before it's collected", () => {
    expect(evaluateCondition({ type: 'cookie', name: 'x', op: 'exists' }, ping())).toBeNull();
    expect(
      evaluateCondition({ type: 'pages_viewed_session', op: 'gte', value: 2 }, ping()),
    ).toBeNull();
    expect(evaluateCondition({ type: 'country', op: 'is', value: 'IN' }, ping())).toBeNull();
    expect(
      evaluateCondition({ type: 'country', op: 'is', value: 'IN' }, ping({ c: 'IN' })),
    ).toBe(true);
  });
});

describe('reach groups', () => {
  const mobile = { type: 'device_type' as const, value: ['mobile' as const] };
  const cookie = { type: 'cookie' as const, name: 'x', op: 'exists' as const };
  const g = (mode: ConditionGroup['mode'], ...items: ConditionGroup['items']): ConditionGroup => ({
    mode,
    items,
  });

  it('uses three-valued logic', () => {
    expect(evaluateGroup(g('all', mobile, cookie), ping())).toBeNull();
    expect(evaluateGroup(g('all', mobile, cookie), ping({ d: 'desktop' }))).toBe(false);
    expect(evaluateGroup(g('any', mobile, cookie), ping())).toBe(true);
    expect(evaluateGroup(g('none', mobile), ping())).toBe(false);
    expect(evaluateGroup(g('none', cookie), ping())).toBeNull();
  });

  it('turns a sample into a range', () => {
    const sample = [ping(), ping({ d: 'desktop' }), ping(), ping({ d: 'tablet' })];
    expect(share(sample, (s) => evaluateGroup(g('all', mobile), s))).toEqual({
      low: 0.5,
      high: 0.5,
    });
    expect(share(sample, (s) => evaluateGroup(g('all', mobile, cookie), s))).toEqual({
      low: 0,
      high: 0.5,
    });
    expect(share([], () => true)).toBeNull();
  });

  it('formats a range', () => {
    expect(formatRange({ low: 0.18, high: 0.18 })).toBe('18%');
    expect(formatRange({ low: 0.12, high: 0.18 })).toBe('12%–18%');
    expect(formatRange({ low: 0.042, high: 0.042 })).toBe('4.2%');
  });
});

describe('reach targeting', () => {
  it('combines segments, landing page and triggers', () => {
    const segments = { returners: g2('all', { type: 'visitor_type', value: 'returning' }) };
    const t = {
      who: { mode: 'any' as const, segmentIds: ['returners'] },
      where: { include: [{ op: 'matches' as const, value: '/trips/*' }] },
      how: [g2('all', { type: 'device_type', value: ['mobile'] })],
    };
    expect(evaluateTargeting(t, segments, ping({ n: 3 }))).toBe(true);
    expect(evaluateTargeting(t, segments, ping({ n: 1 }))).toBe(false);
    expect(evaluateTargeting(t, segments, ping({ n: 3 }, 'https://s.dev/'))).toBe(false);
  });

  it('treats a deleted segment as matching nobody, and element rules as unknown', () => {
    expect(evaluateTargeting({ who: { mode: 'any', segmentIds: ['gone'] } }, {}, ping())).toBe(
      false,
    );
    expect(
      evaluateTargeting(
        {
          where: { include: [{ op: 'contains', value: '/trips' }], elements: [{ selector: '.b' }] },
        },
        {},
        ping(),
      ),
    ).toBeNull();
  });

  it('gives 60% for mobile in the fixture sample', () => {
    const mobile = g2('all', { type: 'device_type', value: ['mobile'] });
    expect(share(SESSION_SAMPLE.sample, (s) => evaluateGroup(mobile, s))).toEqual({
      low: 0.6,
      high: 0.6,
    });
  });
});

function g2(mode: ConditionGroup['mode'], ...items: ConditionGroup['items']): ConditionGroup {
  return { mode, items };
}
