import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { ExperimentGoal, Metric } from '../../data/api';
import {
  useGoalMutations,
  useGoalsQuery,
  useMetricsQuery,
  useUpdateExperiment,
} from '../../data/queries';
import { MEASURES, metricDetail } from '../../lib/metrics';
import { useExperiment } from './experimentContext';
import styles from './GoalsPage.module.css';

const TYPE: Record<Metric['source'], string> = {
  click: 'Action',
  pageview: 'Pageview',
  custom_js: 'Custom event',
  datalayer: 'dataLayer',
  transaction: 'Transaction',
};

function source(m: Metric): string {
  const cfg = m.sourceConfig;
  if (m.source === 'click') return String(cfg.selector ?? '');
  if (m.source === 'pageview')
    return `URL ${(cfg.url as { value?: string } | undefined)?.value ?? ''}`;
  return m.eventKey;
}

/** Experiment step 4: primary goal, secondary goals and guardrails (15-exp-step4-goals.html). */
export function GoalsPage() {
  const { experiment, project } = useExperiment();
  const metrics = useMetricsQuery(project.id);
  const goals = useGoalsQuery(experiment.id);
  const update = useUpdateExperiment(experiment);
  const { set, remove } = useGoalMutations(experiment.id);
  const primary = metrics.data?.find((m) => m.id === experiment.primaryMetricId);
  const secondary = goals.data?.filter((g) => g.role === 'secondary') ?? [];
  const guardrails = goals.data?.filter((g) => g.role === 'guardrail') ?? [];
  const usedIds = new Set([
    experiment.primaryMetricId,
    ...(goals.data ?? []).map((g) => g.metric.id),
  ]);
  const unused = (metrics.data ?? []).filter((m) => !usedIds.has(m.id));
  const locked = experiment.status !== 'draft';
  const failed = update.error ?? set.error ?? remove.error;
  const ids = { primary: useId(), secondary: useId(), guard: useId() };

  const setPrimary = (metricId: string) => {
    update.mutate({ primaryMetricId: metricId || null });
    // A metric can't be the primary goal and a secondary goal at once.
    if (metricId && usedIds.has(metricId)) remove.mutate(metricId);
  };

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {failed && (
          <p role="alert" className={styles.error}>
            Couldn't save: {failed.message}
          </p>
        )}
        <section className={`${styles.section} ${styles.primary}`} aria-labelledby={ids.primary}>
          <div className={styles.head}>
            <span className={styles.lbl} id={ids.primary}>
              Primary goal
            </span>
            <span className={styles.lock}>
              {locked ? 'Locked since launch' : 'Locks at launch'}
            </span>
          </div>
          {primary ? (
            <>
              <span className={styles.goalName}>
                {primary.name} <span className={styles.type}>{TYPE[primary.source]}</span>
              </span>
              <span className={styles.detail}>{metricDetail(primary)}</span>
            </>
          ) : (
            <span className={styles.detail}>
              No primary goal yet. It decides the winner, so set it before launch.
            </span>
          )}
          {!locked && (
            <div className={styles.primaryRow}>
              <label htmlFor={`${ids.primary}-select`} className={styles.sub}>
                {primary ? 'Change to' : 'Choose'}
              </label>
              <select
                id={`${ids.primary}-select`}
                className={styles.select}
                value={experiment.primaryMetricId ?? ''}
                onChange={(e) => setPrimary(e.target.value)}
              >
                <option value="">Pick a metric…</option>
                {(metrics.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby={ids.secondary}>
          <div className={styles.head}>
            <h2 className={styles.title} id={ids.secondary}>
              Secondary goals <span className={styles.count}>· {secondary.length}</span>
            </h2>
            <span className={styles.sub}>Reported, not used to call the winner</span>
          </div>
          {secondary.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  <th scope="col">Type</th>
                  <th scope="col">Source</th>
                  <th scope="col">Measured as</th>
                  <th scope="col">Better</th>
                  <th scope="col">
                    <span className="visually-hidden">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {secondary.map((g) => (
                  <tr key={g.metric.id}>
                    <td>{g.metric.name}</td>
                    <td>
                      <span className={styles.type}>{TYPE[g.metric.source]}</span>
                    </td>
                    <td className={styles.code}>{source(g.metric)}</td>
                    <td>{MEASURES[g.metric.measure].label}</td>
                    <td
                      aria-label={
                        g.metric.measureConfig.direction === 'decrease' ? 'Lower' : 'Higher'
                      }
                    >
                      {g.metric.measureConfig.direction === 'decrease' ? '↓' : '↑'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => remove.mutate(g.metric.id)}
                        aria-label={`Remove ${g.metric.name}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <AddGoal
            label="Add secondary goal"
            metrics={unused}
            onAdd={(id) => set.mutate({ metricId: id, role: 'secondary', limit: null })}
          />
        </section>

        <section className={styles.section} aria-labelledby={ids.guard}>
          <div className={styles.head}>
            <h2 className={styles.title} id={ids.guard}>
              Guardrails
            </h2>
            <span className={styles.sub}>Metrics a variant must not make worse</span>
          </div>
          {guardrails.map((g) => (
            <Guardrail
              key={g.metric.id}
              goal={g}
              onChange={(maxPct) =>
                set.mutate({ metricId: g.metric.id, role: 'guardrail', limit: { maxPct } })
              }
              onRemove={() => remove.mutate(g.metric.id)}
            />
          ))}
          <AddGoal
            label="Add guardrail"
            metrics={unused}
            onAdd={(id) => set.mutate({ metricId: id, role: 'guardrail', limit: { maxPct: 2 } })}
          />
          <span className={styles.note}>
            Results flag a guardrail when it is crossed with 95% confidence. Automatic pausing needs
            a scheduled job that isn't built yet, so pause by hand.
          </span>
        </section>
      </div>

      <aside className={styles.aside} aria-label="Add a goal">
        <div className={styles.head}>
          <span className={styles.lbl}>Add a goal</span>
          <Link to={`/p/${project.id}/metrics`} className={styles.sub}>
            All metrics
          </Link>
        </div>
        {[
          { source: 'click', name: 'Action', text: 'Click on an element, by CSS selector' },
          {
            source: 'pageview',
            name: 'Pageview',
            text: 'Any URL rule: is, contains, pattern, regex',
          },
          {
            source: 'custom-js',
            name: 'Custom event',
            text: 'Your code calls splitcraft.trackEvent(), with a value if you like',
          },
        ].map((t) => (
          <Link
            key={t.name}
            to={`/p/${project.id}/metrics/new?source=${t.source}`}
            className={styles.goalType}
          >
            <span>
              <span className={styles.gn}>{t.name}</span>
              <span className={styles.gd}>{t.text}</span>
            </span>
          </Link>
        ))}
        {[
          { name: 'Transaction', text: 'Revenue, order value, purchase rate' },
          { name: 'Browsing', text: 'Bounce, pages per session, time on site' },
          { name: 'Web Vitals', text: 'LCP, INP, CLS per variant, as guardrails' },
        ].map((t) => (
          <span key={t.name} className={`${styles.goalType} ${styles.off}`} aria-disabled="true">
            <span>
              <span className={styles.gn}>{t.name}</span>
              <span className={styles.gd}>
                {t.text}. Coming later: the SDK doesn't collect this yet.
              </span>
            </span>
          </span>
        ))}
        <span className={styles.sub}>
          Action and custom-event goals only count from launch. Add them before you launch.
        </span>
      </aside>
    </div>
  );
}

function AddGoal({
  label,
  metrics,
  onAdd,
}: {
  label: string;
  metrics: Metric[];
  onAdd(id: string): void;
}) {
  const id = useId();
  if (metrics.length === 0) return null;
  return (
    <div className={styles.addRow}>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value=""
        onChange={(e) => e.target.value && onAdd(e.target.value)}
      >
        <option value="">+ {label}</option>
        {metrics.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Guardrail({
  goal,
  onChange,
  onRemove,
}: {
  goal: ExperimentGoal;
  onChange(maxPct: number): void;
  onRemove(): void;
}) {
  const [value, setValue] = useState(String(goal.limit?.maxPct ?? 2));
  const id = useId();
  const n = Number(value);
  const bad = !(n > 0 && n <= 100);
  const worse = goal.metric.measureConfig.direction === 'decrease' ? 'rise' : 'drop';
  return (
    <div className={styles.guard}>
      <span className={styles.type}>{TYPE[goal.metric.source]}</span>
      <strong>{goal.metric.name}</strong>
      <label htmlFor={id}>must not {worse} more than</label>
      <input
        id={id}
        className={styles.pct}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !bad && n !== goal.limit?.maxPct && onChange(n)}
        aria-invalid={bad}
      />
      <span>%</span>
      <button
        type="button"
        className={styles.remove}
        style={{ marginLeft: 'auto' }}
        onClick={onRemove}
        aria-label={`Remove guardrail ${goal.metric.name}`}
      >
        Remove
      </button>
    </div>
  );
}
