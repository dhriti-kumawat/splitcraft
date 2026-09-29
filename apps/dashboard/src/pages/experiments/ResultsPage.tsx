import { useState } from 'react';
import { CumulativeChart } from '../../components/CumulativeChart';
import { Breakdown } from './Breakdown';
import type { ExperimentGoal, Metric } from '../../data/api';
import { useDailyQuery, useGoalsQuery, useMetricsQuery, useResultsQuery } from '../../data/queries';
import { SERIES } from '../../lib/chartColors';
import { controlKey, percent } from '../../lib/experiments';
import { MEASURES } from '../../lib/metrics';
import {
  cumulativeSeries,
  guardrailStatus,
  metricResult,
  splitShares,
  verdict,
  type ArmResult,
  type GuardStatus,
  type MetricResult,
} from '../../lib/results';
import { srm } from '../../lib/stats';
import { targetingSummary } from '../../lib/targeting';
import { useExperiment } from './experimentContext';
import styles from './ResultsPage.module.css';

const number = new Intl.NumberFormat('en-US');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Experiment step 5: verdict, KPIs, variant table and cumulative chart (16-exp-step5-results.html). */
export function ResultsPage() {
  const { experiment, project } = useExperiment();
  const metrics = useMetricsQuery(project.id);
  const goals = useGoalsQuery(experiment.id);
  const results = useResultsQuery(experiment.id);
  const daily = useDailyQuery(experiment.id);
  // Fixed at mount so render stays pure; the pace estimate doesn't need to tick.
  const [now] = useState(() => Date.now());

  if (results.isPending || metrics.isPending || goals.isPending)
    return <p aria-busy="true">Loading results…</p>;
  if (results.isError) return <p role="alert">Couldn't load results: {results.error.message}</p>;

  const primaryMetric = metrics.data?.find((m) => m.id === experiment.primaryMetricId);
  if (!primaryMetric) {
    return <p className={styles.empty}>Set a primary goal in step 4 to see results.</p>;
  }
  const primary = metricResult(primaryMetric, experiment, results.data);
  const total = primary.arms.reduce((s, a) => s + a.visitors, 0);
  if (experiment.status === 'draft' && total === 0) {
    return <p className={styles.empty}>Results appear here after launch.</p>;
  }

  const ratio = srm(
    primary.arms.map((a) => a.visitors),
    experiment.variants.map((v) => v.weight),
  );
  const guardrails = (goals.data ?? []).filter((g) => g.role === 'guardrail');
  const secondary = (goals.data ?? []).filter((g) => g.role === 'secondary');
  const guardResults = guardrails.map((g) => ({
    goal: g,
    result: metricResult(g.metric, experiment, results.data),
  }));

  // Pace from the last 7 days of first exposures, for "about N more days".
  const recent = (daily.data ?? []).filter((d) => Date.parse(d.day) >= now - 7 * DAY_MS);
  const slowest = Math.min(
    ...experiment.variants.map(
      (v) => recent.filter((d) => d.variantKey === v.key).reduce((s, d) => s + d.visitors, 0) / 7,
    ),
  );
  const minArm = Math.min(...primary.arms.map((a) => a.visitors));
  const plan = experiment.plannedSample;
  const daysToPlan =
    plan && minArm < plan && slowest > 0 ? Math.ceil((plan - minArm) / slowest) : null;
  const v = verdict({
    result: primary,
    srm: ratio,
    plannedPerVariant: plan,
    daysToPlan,
    ended: experiment.status === 'ended',
  });

  const best = primary.best;
  const control = primary.arms.find((a) => a.variantKey === controlKey(experiment))!;
  const orderedArms = [control, ...primary.arms.filter((a) => a !== control)];
  const series = orderedArms.map((a) => ({ key: a.variantKey, name: a.name }));
  const chart = cumulativeSeries(
    daily.data ?? [],
    series.map((s) => s.key),
  );
  const unique = primaryMetric.measure === 'unique';
  const proportion = unique || primaryMetric.measure === 'ctr';
  const fmt = (x: number) => formatValue(primaryMetric.measure, x);
  const plannedTotal = plan ? plan * experiment.variants.length : null;

  return (
    <div className={styles.page}>
      <div className={`${styles.banner} ${styles[v.tone] ?? ''}`} role="status">
        <div className={styles.bannerText}>
          <span className={styles.bannerTitle}>{v.title}</span>
          <span className={styles.bannerSub}>{v.text}</span>
        </div>
        {plannedTotal && (
          <div className={styles.progress}>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="Planned sample"
              aria-valuemin={0}
              aria-valuemax={plannedTotal}
              aria-valuenow={Math.min(total, plannedTotal)}
            >
              <div
                className={styles.fill}
                style={{ width: `${Math.min(100, (total / plannedTotal) * 100)}%` }}
              />
            </div>
            <span>
              {number.format(total)} of {number.format(plannedTotal)} visitors
            </span>
          </div>
        )}
      </div>

      <dl className={styles.kpis}>
        <div className={styles.kpi}>
          <dt>Visitors</dt>
          <dd className={styles.kpiValue}>{number.format(total)}</dd>
          <dd className={styles.kpiNote} style={{ margin: 0 }}>
            {targetingSummary(experiment.targeting)}
          </dd>
        </div>
        <div className={styles.kpi}>
          <dt>Uplift{best ? `, ${best.name} vs ${control.name}` : ''}</dt>
          <dd className={styles.kpiValue}>
            {best?.comparison ? percent(best.comparison.uplift) : '—'}
          </dd>
          <dd className={styles.kpiNote} style={{ margin: 0 }}>
            {best?.comparison
              ? `95% range ${percent(best.comparison.upliftLow)} to ${percent(best.comparison.upliftHigh)}`
              : 'Needs visitors in every variant'}
          </dd>
        </div>
        <div className={styles.kpi}>
          <dt>Chance to beat {control.name}</dt>
          <dd className={styles.kpiValue}>
            {best?.chanceBetter !== undefined ? `${Math.round(best.chanceBetter * 100)}%` : '—'}
          </dd>
          <dd className={styles.kpiNote} style={{ margin: 0 }}>
            {proportion ? 'Bayesian, flat prior' : 'Normal approximation'}
            {primary.lowerIsBetter ? ' · lower is better' : ''}
          </dd>
        </div>
        <div className={styles.kpi}>
          <dt>Sample ratio check</dt>
          <dd className={styles.kpiValue}>
            {splitShares(orderedArms)}
            <span className={ratio.mismatch ? styles.fail : styles.pass}>
              {ratio.mismatch ? 'Fail' : 'Pass'}
            </span>
          </dd>
          <dd className={styles.kpiNote} style={{ margin: 0 }}>
            χ² p = {ratio.pValue.toFixed(2)}, {ratio.mismatch ? 'split is off' : 'split is healthy'}
          </dd>
        </div>
      </dl>

      <section className={styles.section} aria-labelledby="variants-h">
        <h2 className={styles.title} id="variants-h">
          {primaryMetric.name} by variant
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col" className={styles.r}>
                Visitors
              </th>
              <th scope="col" className={styles.r}>
                {unique ? `${primaryMetric.name}s` : 'Converters'}
              </th>
              <th scope="col" className={styles.r}>
                {unique ? 'Conv. rate' : MEASURES[primaryMetric.measure].label}
              </th>
              <th scope="col" className={styles.r}>
                Uplift
              </th>
              <th scope="col" className={styles.r}>
                Chance to win
              </th>
              {guardResults.map((g) => (
                <th scope="col" key={g.goal.metric.id}>
                  Guardrail: {g.goal.metric.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedArms.map((a, i) => (
              <tr key={a.variantKey}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>
                  <span className={styles.variant}>
                    <span
                      className={styles.swatch}
                      style={{ background: SERIES[i] }}
                      aria-hidden="true"
                    />
                    {a.name}
                  </span>
                </th>
                <td className={styles.r}>{number.format(a.visitors)}</td>
                <td className={styles.r}>{number.format(a.converters)}</td>
                <td className={styles.r}>{a.visitors ? fmt(a.value) : '—'}</td>
                <td className={styles.r}>
                  <Uplift arm={a} />
                </td>
                <td className={styles.r}>
                  {a.chanceBetter !== undefined
                    ? `${Math.round(a.chanceBetter * 100)}%`
                    : best?.chanceBetter !== undefined && a === control
                      ? `${Math.round((1 - best.chanceBetter) * 100)}%`
                      : '—'}
                </td>
                {guardResults.map((g) => (
                  <td key={g.goal.metric.id}>
                    <GuardCell
                      arm={g.result.arms.find((x) => x.variantKey === a.variantKey)!}
                      goal={g.goal}
                      result={g.result}
                      isControl={a === control}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {chart.length > 0 && unique && (
        <section className={styles.section} aria-labelledby="chart-h">
          <h2 className={styles.title} id="chart-h">
            Cumulative conversion rate
          </h2>
          <CumulativeChart
            data={chart}
            series={series}
            summary={`Cumulative ${primaryMetric.name} conversion rate over ${chart.length} ${chart.length === 1 ? 'day' : 'days'}. ${orderedArms
              .map((a) => `${a.name} ${fmt(a.value)}`)
              .join(', ')}. The table above has the exact numbers.`}
          />
        </section>
      )}

      {unique && <Breakdown experiment={experiment} goalName={primaryMetric.name} />}

      {secondary.length > 0 && (
        <section className={styles.section} aria-labelledby="secondary-h">
          <h2 className={styles.title} id="secondary-h">
            Secondary goals
          </h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Goal</th>
                {orderedArms.slice(1).map((a) => (
                  <th scope="col" className={styles.r} key={a.variantKey}>
                    {a.name} vs {control.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secondary.map((g) => {
                const r = metricResult(g.metric, experiment, results.data);
                return (
                  <tr key={g.metric.id}>
                    <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>
                      {g.metric.name}
                      <span className={styles.range}>
                        {MEASURES[g.metric.measure].label}
                        {r.lowerIsBetter ? ' · lower is better' : ''}
                      </span>
                    </th>
                    {orderedArms.slice(1).map((a) => (
                      <td className={styles.r} key={a.variantKey}>
                        <Uplift arm={r.arms.find((x) => x.variantKey === a.variantKey)!} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Uplift({ arm }: { arm: ArmResult }) {
  if (!arm.comparison) return <span className={styles.none}>—</span>;
  const c = arm.comparison;
  const better = arm.chanceBetter ?? 0.5;
  const cls = better >= 0.95 ? styles.up : better <= 0.05 ? styles.down : '';
  return (
    <>
      <span className={cls}>{percent(c.uplift)}</span>
      <span className={styles.range}>
        {percent(c.upliftLow)} to {percent(c.upliftHigh)}
      </span>
    </>
  );
}

const GUARD_TEXT: Record<GuardStatus, string> = {
  ok: 'no drop past the limit',
  'at-risk': 'at risk',
  crossed: 'crossed',
  'no-data': 'no data yet',
};

function GuardCell({
  arm,
  goal,
  result,
  isControl,
}: {
  arm: ArmResult;
  goal: ExperimentGoal;
  result: MetricResult;
  isControl: boolean;
}) {
  const value = formatValue(result.metric.measure, arm.value);
  if (isControl) return <span className={styles.range}>Baseline {arm.visitors ? value : '—'}</span>;
  const status = guardrailStatus(arm, goal, result.lowerIsBetter);
  const cls =
    status === 'ok'
      ? styles.ok
      : status === 'crossed'
        ? styles.crossed
        : status === 'at-risk'
          ? styles.risk
          : '';
  return (
    <span className={`${styles.guard} ${cls}`}>
      {arm.visitors ? `${value}, ` : ''}
      {GUARD_TEXT[status]}
    </span>
  );
}

function formatValue(measure: Metric['measure'], x: number): string {
  if (measure === 'unique' || measure === 'ctr') return `${(x * 100).toFixed(2)}%`;
  if (measure === 'time_to_click') return `${x.toFixed(1)} s`;
  return x.toFixed(2);
}
