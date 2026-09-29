import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { useExperimentsQuery, useMetricsQuery } from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import { MEASURES, SOURCES } from '../../lib/metrics';
import styles from './MetricsPage.module.css';

const SOURCE_PARAM: Record<string, string> = {
  click: 'click',
  pageview: 'pageview',
  custom_js: 'custom-js',
  datalayer: 'datalayer',
  transaction: 'transaction',
};

/** Project › Metrics: every metric, and where it's used. */
export function MetricsPage() {
  const project = useCurrentProject()!;
  const metrics = useMetricsQuery(project.id);
  const experiments = useExperimentsQuery(project.id);
  const base = `/p/${project.id}/metrics`;
  const usedAsPrimary = (id: string) =>
    (experiments.data ?? []).filter((e) => e.primaryMetricId === id).length;

  return (
    <>
      <TopBarActions>
        <NewMetricMenu base={base} />
      </TopBarActions>
      <PageHeader
        title="Metrics"
        description="What you measure: an event source (a click, a page, your own code) and how to count it."
      />
      <div className={styles.tableWrap}>
        {metrics.isPending ? (
          <p className={styles.empty} aria-busy="true">
            Loading metrics…
          </p>
        ) : metrics.isError ? (
          <p className={styles.empty} role="alert">
            Couldn't load metrics: {metrics.error.message}
          </p>
        ) : metrics.data.length === 0 ? (
          <p className={styles.empty}>
            No metrics yet. Start with a click on your main call to action.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Source</th>
                <th scope="col">Event key</th>
                <th scope="col">Measured as</th>
                <th scope="col">Primary goal of</th>
              </tr>
            </thead>
            <tbody>
              {metrics.data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link to={`${base}/${m.id}`} className={styles.name}>
                      {m.name}
                    </Link>
                  </td>
                  <td>{SOURCES.find((s) => s.id === m.source)?.label}</td>
                  <td className={styles.key}>{m.eventKey}</td>
                  <td>{MEASURES[m.measure].label}</td>
                  <td>
                    {usedAsPrimary(m.id)
                      ? `${usedAsPrimary(m.id)} ${usedAsPrimary(m.id) === 1 ? 'experiment' : 'experiments'}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function NewMetricMenu({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className={styles.menu} ref={ref}>
      <Button aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        + New metric
      </Button>
      {open && (
        <ul className={styles.menuList} aria-label="Event source">
          {SOURCES.map((s) => (
            <li key={s.id}>
              {s.available ? (
                <Link
                  className={styles.menuItem}
                  to={`${base}/new?source=${SOURCE_PARAM[s.id]}`}
                  onClick={() => setOpen(false)}
                >
                  {s.label}
                </Link>
              ) : (
                <span className={styles.disabled} aria-disabled="true">
                  {s.label}
                  <small>Coming later: the SDK doesn't collect this yet</small>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
