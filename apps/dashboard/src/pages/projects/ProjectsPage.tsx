import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { PlusIcon } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { Pill } from '../../components/Pill';
import { Sparkline } from '../../components/Sparkline';
import type { ActivityItem, Experiment, Project, ProjectStats, VariantStats } from '../../data/api';
import {
  useActivityQuery,
  useExperimentsByProject,
  useOverviewQuery,
  useWorkspaceMutations,
} from '../../data/queries';
import { initials, useWorkspace } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import { percent, summarize, timeAgo } from '../../lib/experiments';
import { compactNumber } from '../../lib/format';
import { NewProjectDrawer } from './NewProjectDrawer';
import { Onboarding } from './Onboarding';
import styles from './ProjectsPage.module.css';

const TONES = [styles.tone0, styles.tone1, styles.tone2];
const LINE = [
  { color: 'var(--accent)', fill: 'var(--accent-soft)' },
  { color: 'var(--variant-a)', fill: 'var(--variant-a-soft)' },
  { color: 'var(--warn-dot)', fill: 'var(--warn-soft)' },
];

/** Workspace › Projects grid with the New project drawer (10-projects.html). */
export function ProjectsPage() {
  const { workspace, projects, user } = useWorkspace();
  const overview = useOverviewQuery(workspace.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const statsFor = (id: string) => overview.data?.find((s) => s.projectId === id);
  const byProject = useExperimentsByProject(
    projects.filter((p) => p.installedAt).map((p) => p.id),
    { stats: true },
  );

  return (
    <div className={styles.layout}>
      <TopBarActions>
        <Button onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen}>
          <PlusIcon />
          New project
        </Button>
      </TopBarActions>

      <section className={styles.main}>
        <PageHeader
          title="Projects"
          description="One project per product. Each has its own snippet, audiences, goals and experiments."
        />
        <Onboarding onNewProject={() => setDrawerOpen(true)} />
        {user.role === 'owner' && isDefaultName(workspace.name) && (
          <NameWorkspace key={workspace.id} />
        )}
        <ul className={styles.grid}>
          {projects.map((project, i) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                stats={statsFor(project.id)}
                bestUplift={bestUplift(byProject[project.id])}
                tone={i % 3}
              />
            </li>
          ))}
          <li>
            <button type="button" className={styles.add} onClick={() => setDrawerOpen(true)}>
              <span className={styles.addIcon} aria-hidden="true">
                <PlusIcon />
              </span>
              <span className={styles.addTitle}>New project</span>
              <span className={styles.addHint}>Website, web app or staging copy</span>
            </button>
          </li>
        </ul>
        <RecentActivity workspaceId={workspace.id} />
      </section>

      {drawerOpen && <NewProjectDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

/**
 * Names new accounts used to get ("Jo's Workspace") or get now ("My workspace"). A real
 * team name reads better in the switcher, invites and breadcrumbs, so ask for one.
 */
function isDefaultName(name: string): boolean {
  return /^my workspace$/i.test(name.trim()) || /['’]s workspace$/i.test(name.trim());
}

function NameWorkspace() {
  const { workspace, user } = useWorkspace();
  const { rename } = useWorkspaceMutations(user.id);
  const [name, setName] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const id = useId();
  if (dismissed) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) rename.mutate({ id: workspace.id, name: name.trim() });
  };

  return (
    <section className={styles.nameCard} aria-labelledby={`${id}-h`}>
      <div className={styles.nameText}>
        <h2 id={`${id}-h`} className={styles.nameTitle}>
          Give your workspace a name
        </h2>
        <p className={styles.nameHint}>
          Teammates see it in invites and the workspace switcher. Use your company, team or client
          name.
        </p>
      </div>
      <form className={styles.nameForm} onSubmit={submit}>
        <label htmlFor={id} className="visually-hidden">
          Workspace name
        </label>
        <input
          id={id}
          className={styles.nameInput}
          value={name}
          maxLength={100}
          placeholder="e.g. Acme Inc."
          autoComplete="organization"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={!name.trim() || rename.isPending}>
          Save name
        </Button>
        <button type="button" className={styles.later} onClick={() => setDismissed(true)}>
          Later
        </button>
      </form>
      {rename.isError && (
        <p role="alert" className={styles.nameError}>
          Couldn't save: {rename.error.message}
        </p>
      )}
    </section>
  );
}

/**
 * The biggest positive uplift among the project's live tests that have a clear winner
 * (at least a 95% chance to beat control). Undefined while loading, null when none.
 */
function bestUplift(
  data: { experiments?: Experiment[]; stats?: VariantStats[] } | undefined,
): number | null | undefined {
  if (!data?.experiments || !data.stats) return undefined;
  const uplifts = data.experiments
    .filter((e) => e.status === 'live')
    .map((e) => summarize(e, data.stats!).best)
    .filter((b) => b && b.chanceToWin >= 0.95 && b.uplift > 0)
    .map((b) => b!.uplift);
  return uplifts.length ? Math.max(...uplifts) : null;
}

const ACTIVITY_TEXT: Record<ActivityItem['kind'], (subject: string) => string> = {
  project_created: (s) => `Project “${s}” created`,
  project_installed: (s) => `${s} snippet sent its first event`,
  experiment_created: (s) => `Experiment “${s}” created`,
  experiment_launched: (s) => `“${s}” launched`,
  experiment_ended: (s) => `“${s}” ended`,
  experiment_archived: (s) => `“${s}” archived`,
  segment_created: (s) => `Audience “${s}” created`,
  segment_updated: (s) => `Audience “${s}” edited`,
  metric_created: (s) => `Metric “${s}” created`,
};

function activityLink(item: ActivityItem): string {
  const base = `/p/${item.projectId}`;
  if (item.kind.startsWith('experiment_')) return `${base}/experiments/${item.subjectId}`;
  if (item.kind.startsWith('segment_')) return `${base}/audiences/${item.subjectId}`;
  if (item.kind === 'metric_created') return `${base}/metrics/${item.subjectId}`;
  return item.kind === 'project_installed' ? `${base}/experiments` : `${base}/install`;
}

function RecentActivity({ workspaceId }: { workspaceId: string }) {
  const [limit, setLimit] = useState(5);
  const activity = useActivityQuery(workspaceId, limit);
  const items = activity.data ?? [];
  return (
    <section className={styles.activity} aria-labelledby="activity-h">
      <div className={styles.activityHead}>
        <h2 id="activity-h" className={styles.activityTitle}>
          Recent activity
        </h2>
        {items.length === limit && limit < 30 && (
          <button type="button" className={styles.more} onClick={() => setLimit(30)}>
            Show more
          </button>
        )}
      </div>
      {activity.isError ? (
        <p className={styles.activityEmpty} role="alert">
          Couldn't load activity: {activity.error.message}
        </p>
      ) : activity.isPending ? (
        <p className={styles.activityEmpty} aria-busy="true">
          Loading activity…
        </p>
      ) : items.length === 0 ? (
        <p className={styles.activityEmpty}>
          Nothing yet. Create a project, then experiments and audiences show up here.
        </p>
      ) : (
        <ul className={styles.activityList}>
          {items.map((item) => (
            <li key={`${item.kind}-${item.subjectId}`} className={styles.activityItem}>
              <span className={`${styles.activityDot} ${styles[item.kind.split('_')[0]!]}`} />
              <Link to={activityLink(item)} className={styles.activityText}>
                {ACTIVITY_TEXT[item.kind](item.subject)}
              </Link>
              <span className={styles.activityMeta}>
                {item.projectName} · {timeAgo(item.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectCard({
  project,
  stats,
  bestUplift,
  tone,
}: {
  project: Project;
  stats?: ProjectStats;
  bestUplift?: number | null;
  tone: number;
}) {
  const installed = Boolean(project.installedAt);
  const domains = [project.mainDomain, ...project.allowedDomains];
  return (
    <article className={styles.card} aria-labelledby={`project-${project.id}`}>
      <div className={styles.cardHead}>
        <span className={`${styles.badge} ${TONES[tone]}`} aria-hidden="true">
          {initials(project.name)}
        </span>
        <span className={styles.names}>
          <Link
            id={`project-${project.id}`}
            to={`/p/${project.id}/experiments`}
            className={styles.name}
          >
            {project.name}
          </Link>
          <span className={`${styles.domain} mono`}>{project.mainDomain}</span>
        </span>
        {installed ? (
          <Pill tone="live">Snippet live</Pill>
        ) : (
          <Pill tone="paused">Not installed</Pill>
        )}
      </div>

      {installed ? (
        <>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>{stats?.liveTests === 1 ? 'Live test' : 'Live tests'}</dt>
              <dd>{stats ? stats.liveTests : '…'}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Visitors, 30d</dt>
              <dd>{stats ? compactNumber(stats.visitors30d) : '…'}</dd>
            </div>
            {bestUplift ? (
              <div className={styles.stat}>
                <dt>Best uplift</dt>
                <dd className={styles.up}>{percent(bestUplift)}</dd>
              </div>
            ) : (
              <div className={styles.stat}>
                <dt>No winner yet</dt>
                <dd className={styles.muted}>{bestUplift === undefined ? '…' : '—'}</dd>
              </div>
            )}
          </dl>
          {stats && <Sparkline values={stats.dailyVisitors} {...LINE[tone]!} />}
          <div className={styles.chips}>
            {domains.map((d) => (
              <span key={d} className={styles.chip}>
                {d}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className={styles.waiting}>
            <strong>Waiting for the first ping</strong>
            <span>Add the snippet to your site's head and open any page.</span>
          </div>
          <Link to={`/p/${project.id}/install`} className={styles.installLink}>
            View install steps
          </Link>
        </>
      )}
    </article>
  );
}
