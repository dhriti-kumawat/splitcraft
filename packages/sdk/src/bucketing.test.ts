import { assignVariant, bucketOf, BUCKET_COUNT, type Allocation } from './bucketing';

const N = 100_000;
const visitors = Array.from({ length: N }, (_, i) => `vid_${i}_${(i * 2654435761) >>> 0}`);

function shares(allocation: Allocation): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const id of visitors) {
    const v = assignVariant(id, allocation);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return new Map([...counts].map(([k, c]) => [k, c / N]));
}

describe('bucketOf', () => {
  it('returns an integer in 0–9999', () => {
    for (const id of visitors.slice(0, 1000)) {
      const b = bucketOf(id);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(BUCKET_COUNT);
    }
  });
});

describe('assignVariant', () => {
  const ab: Allocation = {
    experimentKey: 'checkout-cta',
    trafficPct: 100,
    variants: [
      { key: 'control', weight: 50 },
      { key: 'b', weight: 50 },
    ],
  };

  it('gives the same variant for the same visitor and experiment', () => {
    for (const id of visitors.slice(0, 1000)) {
      expect(assignVariant(id, ab)).toBe(assignVariant(id, ab));
    }
  });

  it('splits 100,000 visitors 50/50 within ±1%', () => {
    const s = shares(ab);
    expect(Math.abs((s.get('control') ?? 0) - 0.5)).toBeLessThan(0.01);
    expect(Math.abs((s.get('b') ?? 0) - 0.5)).toBeLessThan(0.01);
    expect(s.has(null)).toBe(false);
  });

  it('splits 100,000 visitors 20/30/50 within ±1%', () => {
    const s = shares({
      experimentKey: 'hero-copy',
      trafficPct: 100,
      variants: [
        { key: 'control', weight: 20 },
        { key: 'b', weight: 30 },
        { key: 'c', weight: 50 },
      ],
    });
    expect(Math.abs((s.get('control') ?? 0) - 0.2)).toBeLessThan(0.01);
    expect(Math.abs((s.get('b') ?? 0) - 0.3)).toBeLessThan(0.01);
    expect(Math.abs((s.get('c') ?? 0) - 0.5)).toBeLessThan(0.01);
  });

  it('treats weights as relative, not as percentages', () => {
    const s = shares({
      ...ab,
      variants: [
        { key: 'control', weight: 1 },
        { key: 'b', weight: 3 },
      ],
    });
    expect(Math.abs((s.get('b') ?? 0) - 0.75)).toBeLessThan(0.01);
  });

  it('excludes the right share of visitors with traffic %', () => {
    const s = shares({ ...ab, trafficPct: 30 });
    expect(Math.abs((s.get(null) ?? 0) - 0.7)).toBeLessThan(0.01);
    // The included 30% is still split evenly.
    expect(Math.abs((s.get('control') ?? 0) - 0.15)).toBeLessThan(0.01);
    expect(Math.abs((s.get('b') ?? 0) - 0.15)).toBeLessThan(0.01);
  });

  it('excludes everyone at 0% traffic and no one at 100%', () => {
    expect(shares({ ...ab, trafficPct: 0 }).get(null)).toBe(1);
    expect(shares({ ...ab, trafficPct: 100 }).has(null)).toBe(false);
  });

  it('keeps included visitors in the same variant when traffic is raised', () => {
    for (const id of visitors.slice(0, 20_000)) {
      const before = assignVariant(id, { ...ab, trafficPct: 20 });
      if (before !== null) expect(assignVariant(id, { ...ab, trafficPct: 60 })).toBe(before);
    }
  });

  it('never serves a zero-weight variant', () => {
    const s = shares({
      ...ab,
      variants: [
        { key: 'control', weight: 50 },
        { key: 'paused', weight: 0 },
        { key: 'b', weight: 50 },
      ],
    });
    expect(s.has('paused')).toBe(false);
  });

  it('returns null when no variant has weight', () => {
    expect(assignVariant('vid_1', { ...ab, variants: [] })).toBeNull();
    expect(assignVariant('vid_1', { ...ab, variants: [{ key: 'b', weight: 0 }] })).toBeNull();
  });

  it('buckets independently across experiments', () => {
    let bothB = 0;
    for (const id of visitors) {
      const first = assignVariant(id, ab);
      const second = assignVariant(id, { ...ab, experimentKey: 'pricing-page' });
      if (first === 'b' && second === 'b') bothB++;
    }
    expect(Math.abs(bothB / N - 0.25)).toBeLessThan(0.01);
  });
});

describe('exclusion groups', () => {
  const alloc = (place: number) => ({
    experimentKey: `exp-${place}`,
    trafficPct: 100,
    variants: [{ key: 'control', weight: 1 }],
    group: ['checkout', place, 3] as [string, number, number],
  });

  it('puts each visitor in exactly one experiment of the group, about evenly', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) {
      const entered = [0, 1, 2].filter((p) => assignVariant(`v${i}`, alloc(p)) !== null);
      expect(entered).toHaveLength(1);
      counts[entered[0]!]!++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });

  it('is stable for a visitor', () => {
    expect(assignVariant('v42', alloc(1))).toBe(assignVariant('v42', alloc(1)));
  });
});
