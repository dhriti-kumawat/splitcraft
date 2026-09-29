import type { DailyArm, Metric, MetricArm } from '../data/api';
import { EXPERIMENTS, METRICS } from '../test/fakeData';
import { cumulativeSeries, guardrailStatus, metricResult, splitShares, verdict } from './results';
import { srm } from './stats';

const sticky = EXPERIMENTS.find((e) => e.id === 'sticky')!;
const book = METRICS.find((m) => m.id === 'm-book')!;
const arm = (metricId: string, variantKey: string, p: Partial<MetricArm>): MetricArm => ({
  metricId,
  variantKey,
  visitors: 0,
  converters: 0,
  viewers: 0,
  events: 0,
  eventsSumsq: 0,
  valueSum: 0,
  valueSumsq: 0,
  ...p,
});

// PRODUCT_SPEC §6 worked example.
const worked = [
  arm('m-book', 'control', { visitors: 12_480, converters: 622 }),
  arm('m-book', 'b', { visitors: 12_380, converters: 677 }),
];

describe('metricResult', () => {
  it('reproduces the worked example for a conversion metric', () => {
    const r = metricResult(book, sticky, worked);
    const b = r.arms.find((a) => a.variantKey === 'b')!;
    expect(b.value * 100).toBeCloseTo(5.47, 2);
    expect(b.comparison!.uplift * 100).toBeCloseTo(9.7, 1);
    expect(b.chanceBetter).toBeGreaterThan(0.955);
    expect(r.best?.variantKey).toBe('b');
    expect(r.arms.find((a) => a.variantKey === 'control')!.comparison).toBeUndefined();
  });

  it('flips the chance for lower-is-better metrics', () => {
    const bounce: Metric = { ...book, id: 'm-bounce', measureConfig: { direction: 'decrease' } };
    const r = metricResult(
      bounce,
      sticky,
      worked.map((a) => ({ ...a, metricId: 'm-bounce' })),
    );
    expect(r.best!.chanceBetter).toBeLessThan(0.05);
  });

  it('compares per-visitor sums for value metrics', () => {
    const revenue: Metric = { ...book, id: 'm-rev', measure: 'sum' };
    const r = metricResult(revenue, sticky, [
      arm('m-rev', 'control', { visitors: 1000, valueSum: 10_000, valueSumsq: 1000 * (400 + 100) }),
      arm('m-rev', 'b', { visitors: 1000, valueSum: 11_500, valueSumsq: 1000 * (484 + 132.25) }),
    ]);
    const b = r.arms.find((a) => a.variantKey === 'b')!;
    expect(b.value).toBeCloseTo(11.5, 6);
    expect(b.comparison!.uplift).toBeCloseTo(0.15, 6);
  });

  it('averages over converters for value per conversion', () => {
    const aov: Metric = { ...book, id: 'm-aov', measure: 'value_per_conversion' };
    const r = metricResult(aov, sticky, [
      arm('m-aov', 'control', {
        visitors: 100,
        converters: 10,
        valueSum: 1000,
        valueSumsq: 10 * 100 * 100,
      }),
      arm('m-aov', 'b', {
        visitors: 100,
        converters: 20,
        valueSum: 2400,
        valueSumsq: 20 * 120 * 120,
      }),
    ]);
    expect(r.arms.map((a) => a.value)).toEqual([100, 120]);
  });
});

describe('guardrailStatus', () => {
  const r = (lo: number, mid: number, hi: number) => ({
    variantKey: 'b',
    name: 'B',
    visitors: 1,
    converters: 1,
    events: 1,
    value: 1,
    comparison: { upliftLow: lo, uplift: mid, upliftHigh: hi } as never,
  });
  const goal = { role: 'guardrail' as const, limit: { maxPct: 2 }, metric: book };

  it('is crossed only when the whole range is past the limit', () => {
    expect(guardrailStatus(r(-0.08, -0.05, -0.03), goal, false)).toBe('crossed');
    expect(guardrailStatus(r(-0.08, -0.03, 0.01), goal, false)).toBe('at-risk');
    expect(guardrailStatus(r(-0.03, 0.01, 0.05), goal, false)).toBe('ok');
    expect(guardrailStatus(r(0.03, 0.05, 0.08), goal, true)).toBe('crossed');
    expect(guardrailStatus({ ...r(0, 0, 0), comparison: undefined }, goal, false)).toBe('no-data');
  });
});

describe('verdict', () => {
  const result = metricResult(book, sticky, worked);
  const ok = srm([12_480, 12_380], [50, 50]);

  it('says B is ahead but the sample is not reached, as in the design', () => {
    expect(
      verdict({ result, srm: ok, plannedPerVariant: 13_500, daysToPlan: 1, ended: false }),
    ).toEqual({
      tone: 'neutral',
      title: 'B is ahead, with a 96% chance to beat Control',
      text: '92% of the planned sample reached. Keep it running about 1 more day before you call it.',
    });
  });

  it('calls a winner once the plan is reached', () => {
    expect(
      verdict({ result, srm: ok, plannedPerVariant: 12_000, daysToPlan: null, ended: false }).title,
    ).toBe('B wins, with a 96% chance to beat Control');
  });

  it('puts a sample ratio mismatch first', () => {
    const v = verdict({
      result,
      srm: srm([12_480, 11_000], [50, 50]),
      plannedPerVariant: null,
      daysToPlan: null,
      ended: false,
    });
    expect(v.tone).toBe('warn');
    expect(v.title).toMatch(/Sample ratio mismatch/);
  });

  it('waits for visitors', () => {
    const empty = metricResult(book, sticky, []);
    expect(
      verdict({
        result: empty,
        srm: srm([0, 0], [50, 50]),
        plannedPerVariant: null,
        daysToPlan: null,
        ended: false,
      }).tone,
    ).toBe('wait');
  });
});

describe('cumulativeSeries and splitShares', () => {
  it('builds cumulative conversion rates by day', () => {
    const daily: DailyArm[] = [
      { day: '2026-09-01', variantKey: 'control', visitors: 100, converters: 5 },
      { day: '2026-09-01', variantKey: 'b', visitors: 100, converters: 4 },
      { day: '2026-09-02', variantKey: 'control', visitors: 100, converters: 5 },
      { day: '2026-09-02', variantKey: 'b', visitors: 100, converters: 8 },
    ];
    expect(cumulativeSeries(daily, ['b', 'control'])).toEqual([
      { day: 'Day 1', date: '2026-09-01', b: 4, control: 5 },
      { day: 'Day 2', date: '2026-09-02', b: 6, control: 5 },
    ]);
  });

  it('formats the split like the design', () => {
    const result = metricResult(book, sticky, worked);
    expect(splitShares(result.arms)).toBe('50.2 / 49.8');
  });
});

describe('click measures', () => {
  it('computes click-through rate over visitors who saw the element', () => {
    const ctr = { ...book, measure: 'ctr' as const };
    const r = metricResult(ctr, sticky, [
      arm(book.id, 'control', { visitors: 1000, viewers: 400, converters: 40 }),
      arm(book.id, 'b', { visitors: 1000, viewers: 500, converters: 75 }),
    ]);
    expect(r.arms.map((a) => a.value)).toEqual([0.1, 0.15]);
    expect(r.best?.comparison?.uplift).toBeCloseTo(0.5, 5);
  });

  it('treats a lower time to first click as better', () => {
    const timing = {
      ...book,
      measure: 'time_to_click' as const,
      measureConfig: { ...book.measureConfig, direction: 'decrease' as const },
    };
    const r = metricResult(timing, sticky, [
      arm(book.id, 'control', {
        visitors: 1000,
        converters: 200,
        valueSum: 1000,
        valueSumsq: 6000,
      }),
      arm(book.id, 'b', { visitors: 1000, converters: 200, valueSum: 800, valueSumsq: 3800 }),
    ]);
    expect(r.arms.map((a) => a.value)).toEqual([5, 4]);
    expect(r.lowerIsBetter).toBe(true);
    expect(r.best!.chanceBetter!).toBeGreaterThan(0.95);
  });
});
