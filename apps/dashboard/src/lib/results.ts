import type { DailyArm, Experiment, ExperimentGoal, Metric, MetricArm } from '../data/api';
import { controlKey } from './experiments';
import { compareConversion, compareMeans, type Comparison, type SrmResult } from './stats';

export interface ArmResult {
  variantKey: string;
  name: string;
  visitors: number;
  converters: number;
  events: number;
  /** Conversion rate, or the per-visitor / per-conversion mean for value metrics. */
  value: number;
  /** Against control; absent for control itself. */
  comparison?: Comparison;
  /** Chance this arm is the better one, taking the metric's direction into account. */
  chanceBetter?: number;
}

export interface MetricResult {
  metric: Metric;
  lowerIsBetter: boolean;
  arms: ArmResult[];
  /** Best non-control arm by chance to be better. */
  best?: ArmResult;
}

function meanArm(metric: Metric, a: MetricArm) {
  switch (metric.measure) {
    case 'total': {
      const mean = a.visitors ? a.events / a.visitors : 0;
      return {
        n: a.visitors,
        mean,
        variance: Math.max(0, (a.visitors ? a.eventsSumsq / a.visitors : 0) - mean ** 2),
      };
    }
    case 'sum': {
      const mean = a.visitors ? a.valueSum / a.visitors : 0;
      return {
        n: a.visitors,
        mean,
        variance: Math.max(0, (a.visitors ? a.valueSumsq / a.visitors : 0) - mean ** 2),
      };
    }
    default: {
      // value_per_conversion: averaged over the visitors who converted.
      const mean = a.converters ? a.valueSum / a.converters : 0;
      return {
        n: a.converters,
        mean,
        variance: Math.max(0, (a.converters ? a.valueSumsq / a.converters : 0) - mean ** 2),
      };
    }
  }
}

export function metricResult(
  metric: Metric,
  experiment: Experiment,
  rows: MetricArm[],
): MetricResult {
  const control = controlKey(experiment);
  const lowerIsBetter = metric.measureConfig.direction === 'decrease';
  const armOf = (key: string): MetricArm =>
    rows.find((r) => r.metricId === metric.id && r.variantKey === key) ?? {
      metricId: metric.id,
      variantKey: key,
      visitors: 0,
      converters: 0,
      events: 0,
      eventsSumsq: 0,
      valueSum: 0,
      valueSumsq: 0,
    };
  const c = armOf(control);
  const arms = experiment.variants.map((v): ArmResult => {
    const a = armOf(v.key);
    const value =
      metric.measure === 'unique'
        ? a.visitors
          ? a.converters / a.visitors
          : 0
        : meanArm(metric, a).mean;
    const base = {
      variantKey: v.key,
      name: v.name,
      visitors: a.visitors,
      converters: a.converters,
      events: a.events,
      value,
    };
    if (v.key === control || a.visitors === 0 || c.visitors === 0) return base;
    const comparison =
      metric.measure === 'unique'
        ? compareConversion(
            { visitors: c.visitors, conversions: c.converters },
            { visitors: a.visitors, conversions: a.converters },
          )
        : compareMeans(meanArm(metric, c), meanArm(metric, a));
    return {
      ...base,
      comparison,
      chanceBetter: lowerIsBetter ? 1 - comparison.chanceToWin : comparison.chanceToWin,
    };
  });
  const candidates = arms.filter((a) => a.chanceBetter !== undefined);
  const best = candidates.sort((a, b) => b.chanceBetter! - a.chanceBetter!)[0];
  return { metric, lowerIsBetter, arms, best };
}

export type GuardStatus = 'crossed' | 'at-risk' | 'ok' | 'no-data';

/**
 * A guardrail is crossed when the 95% range sits entirely beyond the allowed change in
 * the bad direction, and at risk when only the point estimate is beyond it.
 */
export function guardrailStatus(
  arm: ArmResult,
  goal: ExperimentGoal,
  lowerIsBetter: boolean,
): GuardStatus {
  if (!arm.comparison) return 'no-data';
  const limit = (goal.limit?.maxPct ?? 2) / 100;
  const c = arm.comparison;
  if (lowerIsBetter) {
    if (c.upliftLow > limit) return 'crossed';
    return c.uplift > limit ? 'at-risk' : 'ok';
  }
  if (c.upliftHigh < -limit) return 'crossed';
  return c.uplift < -limit ? 'at-risk' : 'ok';
}

export interface Verdict {
  tone: 'win' | 'lose' | 'neutral' | 'warn' | 'wait';
  title: string;
  text: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function verdict(args: {
  result: MetricResult;
  srm: SrmResult;
  plannedPerVariant: number | null;
  daysToPlan: number | null;
  ended: boolean;
}): Verdict {
  const { result, srm: ratio, plannedPerVariant, daysToPlan, ended } = args;
  const total = result.arms.reduce((s, a) => s + a.visitors, 0);
  if (total === 0) {
    return {
      tone: 'wait',
      title: 'Waiting for visitors',
      text: 'Results appear here as soon as visitors see the experiment.',
    };
  }
  if (ratio.mismatch) {
    return {
      tone: 'warn',
      title: "Sample ratio mismatch: don't trust these numbers yet",
      text: `The split between variants is off by more than chance explains (χ² p = ${ratio.pValue.toFixed(4)}). Check targeting, redirects and caching before reading the results.`,
    };
  }
  const minArm = Math.min(...result.arms.map((a) => a.visitors));
  const progress = plannedPerVariant ? Math.min(1, minArm / plannedPerVariant) : null;
  const sample =
    progress === null
      ? 'No planned sample is set, so decide on a stopping point before calling it.'
      : progress >= 1
        ? 'The planned sample is reached.'
        : `${pct(progress)} of the planned sample reached.${
            ended
              ? ''
              : daysToPlan
                ? ` Keep it running about ${daysToPlan} more ${daysToPlan === 1 ? 'day' : 'days'} before you call it.`
                : ' Keep it running until it reaches the plan.'
          }`;
  const best = result.best;
  if (!best) return { tone: 'wait', title: 'Not enough data to compare yet', text: sample };
  const controlName = result.arms.find((a) => a.comparison === undefined)?.name ?? 'Control';
  if (best.chanceBetter! >= 0.95) {
    const done = progress === null || progress >= 1;
    return {
      tone: done ? 'win' : 'neutral',
      title: done
        ? `${best.name} wins, with a ${pct(best.chanceBetter!)} chance to beat ${controlName}`
        : `${best.name} is ahead, with a ${pct(best.chanceBetter!)} chance to beat ${controlName}`,
      text: sample,
    };
  }
  if (best.chanceBetter! <= 0.05) {
    return {
      tone: 'lose',
      title: `${controlName} is ahead: no variant is likely to beat it`,
      text: `The best variant has a ${pct(best.chanceBetter!)} chance to beat ${controlName}. ${sample}`,
    };
  }
  return {
    tone: 'neutral',
    title: 'No clear winner yet',
    text: `${best.name} has a ${pct(best.chanceBetter!)} chance to beat ${controlName}. ${sample}`,
  };
}

/** Cumulative primary-goal conversion rate per variant, one row per day (for the chart). */
export function cumulativeSeries(daily: DailyArm[], variantKeys: string[]) {
  const days = [...new Set(daily.map((d) => d.day))].sort();
  const totals = Object.fromEntries(variantKeys.map((k) => [k, { visitors: 0, converters: 0 }]));
  return days.map((day, i) => {
    const row: Record<string, number | string | null> = { day: `Day ${i + 1}`, date: day };
    for (const key of variantKeys) {
      const d = daily.find((x) => x.day === day && x.variantKey === key);
      totals[key]!.visitors += d?.visitors ?? 0;
      totals[key]!.converters += d?.converters ?? 0;
      row[key] = totals[key]!.visitors
        ? (totals[key]!.converters / totals[key]!.visitors) * 100
        : null;
    }
    return row;
  });
}

export function splitShares(arms: ArmResult[]): string {
  const total = arms.reduce((s, a) => s + a.visitors, 0) || 1;
  return arms.map((a) => ((a.visitors / total) * 100).toFixed(1)).join(' / ');
}
