import type { Experiment, VariantStats } from '../data/api';
import { compareConversion, srm, type Comparison } from './stats';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExperimentSummary {
  visitors: number;
  /** Best non-control variant against control; null until both have visitors. */
  best: (Comparison & { variantKey: string }) | null;
  srmMismatch: boolean;
  /** Smallest variant's share of the planned sample (0–1), if a plan exists. */
  sampleProgress: number | null;
  /** Days until the planned sample at the last 7 days' pace; null if unknown. */
  daysToPlan: number | null;
  daysRunning: number | null;
  visitorsPerDay: number;
}

export function controlKey(exp: Experiment): string {
  return exp.variants.find((v) => v.key === 'control')?.key ?? exp.variants[0]?.key ?? 'control';
}

export function summarize(
  exp: Experiment,
  stats: VariantStats[],
  now = Date.now(),
): ExperimentSummary {
  const rows = exp.variants.map(
    (v) =>
      stats.find((s) => s.experimentId === exp.id && s.variantKey === v.key) ?? {
        experimentId: exp.id,
        variantKey: v.key,
        visitors: 0,
        conversions: 0,
        visitors7d: 0,
      },
  );
  const visitors = rows.reduce((sum, r) => sum + r.visitors, 0);
  const control = rows.find((r) => r.variantKey === controlKey(exp));

  let best: ExperimentSummary['best'] = null;
  if (control && control.visitors > 0 && exp.primaryMetricId) {
    for (const r of rows) {
      if (r === control || r.visitors === 0) continue;
      const c = compareConversion(control, r);
      if (!best || c.chanceToWin > best.chanceToWin) best = { ...c, variantKey: r.variantKey };
    }
  }

  const minVisitors = rows.length ? Math.min(...rows.map((r) => r.visitors)) : 0;
  const minPerDay = rows.length ? Math.min(...rows.map((r) => r.visitors7d)) / 7 : 0;
  const plan = exp.plannedSample;
  const sampleProgress = plan ? Math.min(1, minVisitors / plan) : null;
  const daysToPlan =
    plan && minVisitors < plan && minPerDay > 0
      ? Math.ceil((plan - minVisitors) / minPerDay)
      : null;

  const end = exp.endedAt ? Date.parse(exp.endedAt) : now;
  return {
    visitors,
    best,
    srmMismatch: srm(
      rows.map((r) => r.visitors),
      exp.variants.map((v) => v.weight),
    ).mismatch,
    sampleProgress,
    daysToPlan,
    daysRunning: exp.startedAt
      ? Math.max(0, Math.floor((end - Date.parse(exp.startedAt)) / DAY_MS))
      : null,
    visitorsPerDay: rows.reduce((sum, r) => sum + r.visitors7d, 0) / 7,
  };
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "2 min ago", "3 hours ago", "yesterday". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600)
    return relative
      .format(Math.round(seconds / 60), 'minute')
      .replace('minutes', 'min')
      .replace('minute', 'min');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}

export function percent(x: number, digits = 1): string {
  const sign = x > 0 ? '+' : x < 0 ? '−' : '';
  return `${sign}${Math.abs(x * 100).toFixed(digits)}%`;
}
