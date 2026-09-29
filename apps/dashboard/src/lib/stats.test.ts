import {
  chanceToBeat,
  chiSquarePValue,
  compareConversion,
  normalCdf,
  normalQuantile,
  sampleSizePerVariant,
  srm,
} from './stats';

// Worked example from PRODUCT_SPEC §6, used across the designs.
const control = { visitors: 12_480, conversions: 622 };
const variantB = { visitors: 12_380, conversions: 677 };

describe('worked example (PRODUCT_SPEC §6)', () => {
  const r = compareConversion(control, variantB);

  it('has the conversion rates 4.98% and 5.47%', () => {
    expect(r.controlRate * 100).toBeCloseTo(4.98, 2);
    expect(r.variantRate * 100).toBeCloseTo(5.47, 2);
  });

  it('has an uplift of +9.7% with a 95% range of −1.4% to +20.8%', () => {
    expect(r.uplift * 100).toBeCloseTo(9.7, 1);
    expect(r.upliftLow * 100).toBeCloseTo(-1.4, 1);
    expect(r.upliftHigh * 100).toBeCloseTo(20.8, 1);
  });

  it('gives about a 96% chance to beat control', () => {
    expect(r.chanceToWin).toBeGreaterThan(0.955);
    expect(r.chanceToWin).toBeLessThan(0.965);
  });

  it('is not significant yet on the z-test (the range crosses 0)', () => {
    expect(r.z).toBeCloseTo(1.72, 2);
    expect(r.pValue).toBeGreaterThan(0.05);
  });

  it('shows no sample ratio mismatch: 50.2/49.8, p ≈ 0.53', () => {
    const result = srm([control.visitors, variantB.visitors], [50, 50]);
    expect(result.pValue).toBeCloseTo(0.53, 2);
    expect(result.mismatch).toBe(false);
  });
});

describe('normal distribution', () => {
  it('matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 6);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 6);
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 6);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232, 5);
  });
});

describe('chanceToBeat', () => {
  it('is 50% for identical arms', () => {
    expect(
      chanceToBeat({ visitors: 1000, conversions: 50 }, { visitors: 1000, conversions: 50 }),
    ).toBeCloseTo(0.5, 2);
  });

  it('is symmetric', () => {
    const a = { visitors: 800, conversions: 40 };
    const b = { visitors: 820, conversions: 55 };
    expect(chanceToBeat(a, b) + chanceToBeat(b, a)).toBeCloseTo(1, 6);
  });

  it('uses the normal approximation for very large counts and stays consistent', () => {
    const big = chanceToBeat(
      { visitors: 2_000_000, conversions: 100_000 },
      { visitors: 2_000_000, conversions: 100_600 },
    );
    expect(big).toBeGreaterThan(0.9);
    expect(big).toBeLessThan(1);
  });
});

describe('srm', () => {
  it('flags a clearly broken split', () => {
    const result = srm([10_000, 9_000], [50, 50]);
    expect(result.mismatch).toBe(true);
    expect(result.pValue).toBeLessThan(0.001);
  });

  it('respects unequal planned weights', () => {
    expect(srm([2_000, 8_000], [20, 80]).mismatch).toBe(false);
  });

  it('handles empty data', () => {
    expect(srm([0, 0], [50, 50])).toEqual({ chiSquare: 0, pValue: 1, mismatch: false });
  });
});

describe('chiSquarePValue', () => {
  it('matches tables', () => {
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(6.635, 1)).toBeCloseTo(0.01, 3);
    expect(chiSquarePValue(5.991, 2)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(20, 3)).toBeCloseTo(0.00017, 4);
  });
});

describe('sampleSizePerVariant', () => {
  it('matches the standard formula for 5% baseline and 10% relative lift', () => {
    // Reference: 31,234 per variant (two-sided 95%, 80% power).
    expect(sampleSizePerVariant(0.05, 0.1)).toBeGreaterThan(31_000);
    expect(sampleSizePerVariant(0.05, 0.1)).toBeLessThan(31_300);
  });

  it('needs fewer visitors for bigger lifts', () => {
    expect(sampleSizePerVariant(0.05, 0.2)).toBeLessThan(sampleSizePerVariant(0.05, 0.1));
  });

  it('is infinite for impossible inputs', () => {
    expect(sampleSizePerVariant(0, 0.1)).toBe(Infinity);
    expect(sampleSizePerVariant(0.05, 0)).toBe(Infinity);
  });
});

describe('compareMeans', () => {
  it('matches a hand-computed Welch comparison', async () => {
    const { compareMeans } = await import('./stats');
    // Revenue per visitor: control 10.0 (sd 20, n 1000), variant 11.5 (sd 22, n 1000).
    const r = compareMeans(
      { n: 1000, mean: 10, variance: 400 },
      { n: 1000, mean: 11.5, variance: 484 },
    );
    const se = Math.sqrt(400 / 1000 + 484 / 1000);
    expect(r.uplift).toBeCloseTo(0.15, 6);
    expect(r.upliftLow).toBeCloseTo((1.5 - 1.959964 * se) / 10, 4);
    expect(r.z).toBeCloseTo(1.5 / se, 6);
    expect(r.chanceToWin).toBeGreaterThan(0.94);
  });

  it('handles zero variance', async () => {
    const { compareMeans } = await import('./stats');
    expect(
      compareMeans({ n: 5, mean: 1, variance: 0 }, { n: 5, mean: 2, variance: 0 }).chanceToWin,
    ).toBe(1);
    expect(
      compareMeans({ n: 5, mean: 1, variance: 0 }, { n: 5, mean: 1, variance: 0 }).chanceToWin,
    ).toBe(0.5);
  });
});
