import { assignVariant } from '../../../packages/sdk/src/bucketing';
import { parseRates, plan, random } from './plan';

const NOW = Date.UTC(2026, 8, 29, 12);
const base = {
  projectId: 'p1',
  experimentId: 'e1',
  experimentKey: 'sticky',
  goalKey: 'book_click',
  url: 'https://mytrips.dev/trips/norway',
  now: NOW,
  days: 14,
  variants: [
    { key: 'control', weight: 50, rate: 0.05 },
    { key: 'b', weight: 50, rate: 0.055 },
  ],
};

describe('plan', () => {
  const events = plan({ ...base, visitors: 20_000 });
  const exposures = events.filter((e) => e.type === 'exposure');
  const goals = events.filter((e) => e.type === 'goal');

  it('is repeatable for the same seed', () => {
    expect(plan({ ...base, visitors: 500 })).toEqual(plan({ ...base, visitors: 500 }));
    expect(plan({ ...base, visitors: 500, seed: 2 })).not.toEqual(plan({ ...base, visitors: 500 }));
  });

  it('buckets every visitor exactly as the SDK would', () => {
    for (const e of exposures.slice(0, 500)) {
      expect(e.variant_key).toBe(
        assignVariant(e.visitor_id, {
          experimentKey: 'sticky',
          trafficPct: 100,
          variants: base.variants,
        }),
      );
    }
  });

  it('splits by weight and converts near the chosen rates', () => {
    const count = (k: string) => exposures.filter((e) => e.variant_key === k).length;
    expect(Math.abs(count('control') / exposures.length - 0.5)).toBeLessThan(0.01);
    const rateFor = (k: string) => {
      const ids = new Set(exposures.filter((e) => e.variant_key === k).map((e) => e.visitor_id));
      return goals.filter((g) => ids.has(g.visitor_id)).length / ids.size;
    };
    expect(rateFor('control')).toBeCloseTo(0.05, 1);
    expect(rateFor('b')).toBeCloseTo(0.055, 1);
  });

  it('spreads exposures over the days and never converts before exposure or after now', () => {
    const times = exposures.map((e) => Date.parse(e.created_at));
    expect(Math.min(...times)).toBeGreaterThanOrEqual(NOW - 14 * 86_400_000);
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW);
    const exposedAt = new Map(exposures.map((e) => [e.visitor_id, Date.parse(e.created_at)]));
    for (const g of goals) {
      const t = Date.parse(g.created_at);
      expect(t).toBeGreaterThanOrEqual(exposedAt.get(g.visitor_id)!);
      expect(t).toBeLessThanOrEqual(NOW);
    }
  });

  it('marks every event as simulated with a valid visitor id', () => {
    expect(events.every((e) => e.props.simulated === true)).toBe(true);
    expect(events.every((e) => /^[A-Za-z0-9_-]{8,64}$/.test(e.visitor_id))).toBe(true);
  });

  it('leaves visitors outside the traffic share out', () => {
    const some = plan({ ...base, visitors: 2000, trafficPct: 25 }).filter(
      (e) => e.type === 'exposure',
    );
    expect(Math.abs(some.length / 2000 - 0.25)).toBeLessThan(0.04);
  });
});

describe('helpers', () => {
  it('parses rates and rejects bad ones', () => {
    expect(parseRates('control=0.05, b=0.055')).toEqual({ control: 0.05, b: 0.055 });
    expect(() => parseRates('b=5')).toThrow('Bad rate');
    expect(() => parseRates('b')).toThrow('Bad rate');
  });

  it('random is deterministic and in [0, 1)', () => {
    const a = random(7);
    const b = random(7);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
