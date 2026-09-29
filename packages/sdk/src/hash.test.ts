import { hash32 } from './hash';

describe('hash32', () => {
  it('is deterministic', () => {
    expect(hash32('visitor-1checkout-cta')).toBe(hash32('visitor-1checkout-cta'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const s of ['', 'a', 'splitly', 'x'.repeat(1000), 'ünïcödé']) {
      const h = hash32(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('gives different values for different inputs', () => {
    expect(hash32('a')).not.toBe(hash32('b'));
    expect(hash32('ab')).not.toBe(hash32('ba'));
  });

  it('spreads short similar keys evenly over 10 buckets', () => {
    const counts = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const bucket = hash32(`v${i}exp`) % 10;
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    for (const c of counts) {
      expect(Math.abs(c / n - 0.1)).toBeLessThan(0.005);
    }
  });
});
