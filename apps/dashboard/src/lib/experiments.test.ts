import { EXPERIMENT_STATS, EXPERIMENTS } from '../test/fakeData';
import { percent, summarize, timeAgo } from './experiments';

describe('summarize', () => {
  const sticky = EXPERIMENTS.find((e) => e.id === 'sticky')!;

  it('compares the best variant with control', () => {
    const s = summarize(sticky, EXPERIMENT_STATS);
    expect(s.visitors).toBe(24_860);
    expect(s.best?.variantKey).toBe('b');
    expect(s.best?.uplift).toBeCloseTo(0.097, 3);
    expect(s.srmMismatch).toBe(false);
    expect(s.daysRunning).toBe(14);
  });

  it('estimates days to the planned sample from the last 7 days', () => {
    // Smallest arm 12,380 of 13,500; 6,250 in 7 days ≈ 893/day → 2 days.
    const s = summarize(sticky, EXPERIMENT_STATS);
    expect(s.sampleProgress).toBeCloseTo(12_380 / 13_500, 5);
    expect(s.daysToPlan).toBe(2);
  });

  it('has no comparison without a primary metric or visitors', () => {
    expect(summarize({ ...sticky, primaryMetricId: null }, EXPERIMENT_STATS).best).toBeNull();
    expect(summarize(sticky, []).best).toBeNull();
    expect(summarize(sticky, []).visitors).toBe(0);
  });
});

describe('formatting', () => {
  it('formats uplift with a real minus sign', () => {
    expect(percent(0.097)).toBe('+9.7%');
    expect(percent(-0.023)).toBe('−2.3%');
    expect(percent(0)).toBe('0.0%');
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-09-29T12:00:00Z');
    expect(timeAgo('2026-09-29T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-09-29T11:58:00Z', now)).toBe('2 min ago');
    expect(timeAgo('2026-09-29T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-09-28T12:00:00Z', now)).toBe('yesterday');
  });
});
