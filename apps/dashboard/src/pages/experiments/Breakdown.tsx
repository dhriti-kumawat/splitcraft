import { useState } from 'react';
import type { BreakdownRow, Experiment } from '../../data/api';
import { useBreakdownQuery } from '../../data/queries';
import { controlKey, percent } from '../../lib/experiments';
import { compareConversion } from '../../lib/stats';
import styles from './ResultsPage.module.css';

const MIN_VISITORS = 100;
const LABELS: Record<string, string> = {
  mobile: 'Mobile',
  desktop: 'Desktop',
  tablet: 'Tablet',
  organic: 'Organic search',
  paid: 'Paid',
  direct: 'Direct',
  social: 'Social',
  email: 'Email',
  referral: 'Referral',
  unknown: 'Unknown',
};
const number = new Intl.NumberFormat('en-US');

/**
 * Primary goal by device or traffic source. For exploring where a change works: with
 * several segments, one of them looks like a winner by chance, so the verdict stays with
 * the overall result.
 */
export function Breakdown({ experiment, goalName }: { experiment: Experiment; goalName: string }) {
  const [dimension, setDimension] = useState<'device' | 'source'>('device');
  const query = useBreakdownQuery(experiment.id, dimension);
  const control = controlKey(experiment);
  const others = experiment.variants.filter((v) => v.key !== control);
  const rows = query.data ?? [];
  const segments = [...new Set(rows.map((r) => r.segment))].sort((a, b) =>
    a === 'unknown' ? 1 : b === 'unknown' ? -1 : total(rows, b) - total(rows, a),
  );
  const arm = (segment: string, key: string) =>
    rows.find((r) => r.segment === segment && r.variantKey === key) ?? {
      visitors: 0,
      converters: 0,
    };

  return (
    <section className={styles.section} aria-labelledby="breakdown-h">
      <div className={styles.breakdownHead}>
        <h2 className={styles.title} id="breakdown-h">
          {goalName} by {dimension === 'device' ? 'device' : 'traffic source'}
        </h2>
        <div className={styles.toggle} role="group" aria-label="Break down by">
          {(['device', 'source'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dimension === d}
              onClick={() => setDimension(d)}
            >
              {d === 'device' ? 'Device' : 'Traffic source'}
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <p className={styles.note} aria-busy="true">
          Loading…
        </p>
      ) : query.isError ? (
        <p className={styles.note} role="alert">
          Couldn't load the breakdown: {query.error.message}
        </p>
      ) : segments.length === 0 ? (
        <p className={styles.note}>No visitors yet.</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                {others.length > 1 && <th scope="col">Variant</th>}
                <th scope="col" className={styles.r}>
                  {experiment.variants.find((v) => v.key === control)?.name ?? 'Control'}
                </th>
                <th scope="col" className={styles.r}>
                  Variant
                </th>
                <th scope="col" className={styles.r}>
                  Uplift
                </th>
                <th scope="col" className={styles.r}>
                  Chance to win
                </th>
              </tr>
            </thead>
            <tbody>
              {segments.flatMap((segment) =>
                others.map((v) => {
                  const c = arm(segment, control);
                  const b = arm(segment, v.key);
                  const enough = c.visitors >= MIN_VISITORS && b.visitors >= MIN_VISITORS;
                  const cmp = enough
                    ? compareConversion(
                        { visitors: c.visitors, conversions: c.converters },
                        { visitors: b.visitors, conversions: b.converters },
                      )
                    : null;
                  return (
                    <tr key={`${segment}-${v.key}`}>
                      <th scope="row">{LABELS[segment] ?? segment}</th>
                      {others.length > 1 && <td>{v.name}</td>}
                      <td className={styles.r}>
                        {rate(c)} <small>{number.format(c.visitors)}</small>
                      </td>
                      <td className={styles.r}>
                        {rate(b)} <small>{number.format(b.visitors)}</small>
                      </td>
                      {cmp ? (
                        <>
                          <td
                            className={`${styles.r} ${cmp.chanceToWin >= 0.95 ? styles.up : cmp.chanceToWin <= 0.05 ? styles.down : ''}`}
                          >
                            {percent(cmp.uplift)}
                            <small>
                              {' '}
                              {percent(cmp.upliftLow)} to {percent(cmp.upliftHigh)}
                            </small>
                          </td>
                          <td className={styles.r}>{Math.round(cmp.chanceToWin * 100)}%</td>
                        </>
                      ) : (
                        <td className={`${styles.r} ${styles.muted}`} colSpan={2}>
                          Too few visitors
                        </td>
                      )}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
          <p className={styles.note}>
            For exploring where the change works. Across several segments one can look like a winner
            by chance, so call the test on the overall result. Segments come from each
            visitor&apos;s first session; at least {MIN_VISITORS} visitors per variant are needed.
          </p>
        </>
      )}
    </section>
  );
}

function rate(a: Pick<BreakdownRow, 'visitors' | 'converters'>): string {
  return a.visitors ? `${((a.converters / a.visitors) * 100).toFixed(2)}%` : '—';
}

function total(rows: BreakdownRow[], segment: string): number {
  return rows.filter((r) => r.segment === segment).reduce((s, r) => s + r.visitors, 0);
}
