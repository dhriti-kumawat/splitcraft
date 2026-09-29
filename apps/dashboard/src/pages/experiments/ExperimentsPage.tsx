import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { PlusIcon } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { Pill } from '../../components/Pill';
import type { Experiment, ExperimentStatus } from '../../data/api';
import {
  useExperimentsQuery,
  useExperimentStatsQuery,
  useLastEventQuery,
} from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import { percent, summarize, timeAgo, type ExperimentSummary } from '../../lib/experiments';
import { targetingSummary } from '../../lib/targeting';
import { NewExperimentDialog } from './NewExperimentDialog';
import styles from './ExperimentsPage.module.css';

const FILTERS: Array<{ id: 'all' | ExperimentStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'draft', label: 'Draft' },
  { id: 'paused', label: 'Paused' },
  { id: 'ended', label: 'Ended' },
];

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  live: 'Live',
  draft: 'Draft',
  paused: 'Paused',
  ended: 'Ended',
};

const number = new Intl.NumberFormat('en-US');

/** Project › Experiments (11-experiments-list.html). */
export function ExperimentsPage() {
  const project = useCurrentProject()!;
  const experiments = useExperimentsQuery(project.id);
  const stats = useExperimentStatsQuery(project.id);
  const lastEvent = useLastEventQuery(project.id);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      (experiments.data ?? []).map((exp) => ({ exp, summary: summarize(exp, stats.data ?? []) })),
    [experiments.data, stats.data],
  );
  const count = (id: (typeof FILTERS)[number]['id']) =>
    id === 'all' ? rows.length : rows.filter((r) => r.exp.status === id).length;
  const query = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (filter === 'all' || r.exp.status === filter) &&
      (!query || r.exp.name.toLowerCase().includes(query) || r.exp.key.includes(query)),
  );
  const live = rows.filter((r) => r.exp.status === 'live');

  return (
    <>
      <TopBarActions>
        <label htmlFor="experiment-search" className="visually-hidden">
          Search experiments
        </label>
        <input
          id="experiment-search"
          type="search"
          className={styles.search}
          placeholder="Search experiments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => setCreating(true)}>
          <PlusIcon />
          New experiment
        </Button>
      </TopBarActions>

      <div className={styles.header}>
        <div>
          <PageHeader
            title="Experiments"
            description={`${rows.length} ${rows.length === 1 ? 'experiment' : 'experiments'} on ${project.mainDomain} · ${live.length} running now`}
          />
        </div>
        <div className={styles.filters} role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={styles.filter}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className={styles.count}>{count(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        {experiments.isPending ? (
          <p className={styles.empty} aria-busy="true">
            Loading experiments…
          </p>
        ) : experiments.isError ? (
          <p className={styles.empty} role="alert">
            Couldn't load experiments: {experiments.error.message}
          </p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>
            {rows.length === 0
              ? 'No experiments yet. Create one to start testing.'
              : 'No experiments match this filter.'}
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Experiment</th>
                <th scope="col">Status</th>
                <th scope="col">Split</th>
                <th scope="col" className={styles.r}>
                  Visitors
                </th>
                <th scope="col">Primary goal</th>
                <th scope="col" className={styles.r}>
                  Uplift
                </th>
                <th scope="col" className={styles.r}>
                  Chance to win
                </th>
                <th scope="col" className={styles.r}>
                  Running
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ exp, summary }) => (
                <Row key={exp.id} exp={exp} summary={summary} projectId={project.id} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.label}>Live traffic in tests</span>
          <span className={styles.big}>
            {number.format(Math.round(live.reduce((s, r) => s + r.summary.visitorsPerDay, 0)))}{' '}
            <span className={styles.unit}>visitors / day</span>
          </span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Ready to call</span>
          <span className={styles.text}>{readyToCall(live)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Health</span>
          <span className={styles.text}>
            <Health live={live} lastEventAt={lastEvent.data} />
          </span>
        </div>
      </div>

      {creating && (
        <NewExperimentDialog projectId={project.id} onClose={() => setCreating(false)} />
      )}
    </>
  );
}

function Row({
  exp,
  summary,
  projectId,
}: {
  exp: Experiment;
  summary: ExperimentSummary;
  projectId: string;
}) {
  const started = exp.status !== 'draft';
  const colors = ['var(--variant-a)', 'var(--variant-b)', 'var(--highlight)', 'var(--accent)'];
  const total = exp.variants.reduce((s, v) => s + v.weight, 0) || 1;
  const best = summary.best;
  // Colour only when the direction is fairly clear (≥ 90% either way); the results page
  // makes the actual call.
  const step = started ? 'results' : 'basics';
  return (
    <tr>
      <td>
        <div className={styles.nameCell}>
          <Link to={`/p/${projectId}/experiments/${exp.id}/${step}`} className={styles.name}>
            {exp.name}
          </Link>
          <span className={`${styles.where} mono`}>{targetingSummary(exp.targeting)}</span>
        </div>
      </td>
      <td>
        <Pill tone={exp.status}>{STATUS_LABEL[exp.status]}</Pill>
      </td>
      <td>
        <div
          className={styles.split}
          role="img"
          aria-label={exp.variants
            .map((v) => `${v.name} ${Math.round((v.weight / total) * 100)}%`)
            .join(', ')}
        >
          {exp.variants.map((v, i) => (
            <div
              key={v.key}
              style={{
                width: `${(v.weight / total) * 100}%`,
                background: started ? colors[i % colors.length] : i % 2 ? '#DDE1DA' : '#C8CEC6',
              }}
            />
          ))}
        </div>
      </td>
      <td className={`${styles.r} ${summary.visitors ? '' : styles.none}`}>
        {summary.visitors ? number.format(summary.visitors) : '—'}
      </td>
      <td>{exp.primaryMetricName ?? <span className={styles.none}>Not set</span>}</td>
      <td
        className={`${styles.r} ${
          !best
            ? styles.none
            : best.chanceToWin >= 0.9
              ? styles.up
              : best.chanceToWin <= 0.1
                ? styles.down
                : ''
        }`}
      >
        {best ? percent(best.uplift) : '—'}
      </td>
      <td className={`${styles.r} ${best ? '' : styles.none}`}>
        {best ? `${Math.round(best.chanceToWin * 100)}%` : '—'}
      </td>
      <td className={`${styles.r} ${summary.daysRunning === null ? styles.none : styles.muted}`}>
        {summary.daysRunning === null
          ? 'Not started'
          : `${summary.daysRunning} ${summary.daysRunning === 1 ? 'day' : 'days'}`}
      </td>
    </tr>
  );
}

function readyToCall(live: Array<{ exp: Experiment; summary: ExperimentSummary }>): string {
  const done = live.find((r) => r.summary.sampleProgress === 1);
  if (done) return `${done.exp.name} reached its planned sample. Time to read the results.`;
  const next = live
    .filter((r) => r.summary.daysToPlan !== null)
    .sort((a, b) => a.summary.daysToPlan! - b.summary.daysToPlan!)[0];
  if (next) {
    const d = next.summary.daysToPlan!;
    return `${next.exp.name} reaches its planned sample in about ${d} ${d === 1 ? 'day' : 'days'}.`;
  }
  return live.length ? 'No live test has a planned sample yet.' : 'Nothing is running right now.';
}

function Health({
  live,
  lastEventAt,
}: {
  live: Array<{ exp: Experiment; summary: ExperimentSummary }>;
  lastEventAt: string | null | undefined;
}) {
  const mismatched = live.filter((r) => r.summary.srmMismatch);
  return (
    <>
      {mismatched.length ? (
        <span className={styles.warn}>
          Sample ratio mismatch in {mismatched.map((r) => r.exp.name).join(', ')}. Check targeting
          and redirects.
        </span>
      ) : live.length ? (
        'No sample ratio mismatch in live tests.'
      ) : (
        'No live tests to check.'
      )}{' '}
      {lastEventAt === undefined
        ? ''
        : lastEventAt
          ? `Snippet pinged ${timeAgo(lastEventAt)}.`
          : 'No events from the snippet yet.'}
    </>
  );
}
