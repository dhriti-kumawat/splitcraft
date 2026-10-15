import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { NewWorkspaceDialog } from '../../components/NewWorkspaceDialog';
import { isNamed, markNamed } from '../../lib/workspaceNames';
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
  const { workspace, workspaces, projects, user } = useWorkspace();
  const overview = useOverviewQuery(workspace.id);
  const hasOwn = projects.some((p) => !p.demo);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Real numbers from project_overview; a project without activity counts as zero, and
  // a failed load shows dashes instead of waiting forever.
  const statsFor = (id: string): ProjectStats | null | undefined =>
    overview.isError
      ? null
      : overview.data
        ? (overview.data.find((s) => s.projectId === id) ?? {
            projectId: id,
            liveTests: 0,
            visitors30d: 0,
            dailyVisitors: [],
          })
        : undefined;
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
        {/* No project yet: the full guide leads. With projects, they come first and the
            guide shrinks to one row under them. */}
        {!hasOwn && <Onboarding onNewProject={() => setDrawerOpen(true)} />}
        {user.role === 'owner' && isDefaultName(workspace.name) && !isNamed(workspace.id) && (
          <NameWorkspace key={workspace.id} />
        )}
        {!workspaces.some((w) => w.role === 'owner') && <OwnWorkspace />}
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
        {hasOwn && <Onboarding onNewProject={() => setDrawerOpen(true)} />}
        <RecentActivity workspaceId={workspace.id} />
      </section>

      {drawerOpen && <NewProjectDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

/**
 * The name a workspace gets when someone skips naming it ("My workspace"). Only that one
 * asks for a better name: "Jo's Workspace" may well be what someone chose.
 */
function isDefaultName(name: string): boolean {
  return /^my workspace$/i.test(name.trim());
}

const OWN_HINT_KEY = 'splitcraft_own_workspace_hint';

/**
 * Someone who joined by invite and runs no workspace of their own: offer one, so their own
 * projects don't end up in a workspace someone else owns (like Notion's and Linear's nudge).
 */
function OwnWorkspace() {
  const { workspace, user, selectWorkspace } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(OWN_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const id = useId();
  if (dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(OWN_HINT_KEY, '1');
    } catch {
      // Storage blocked: hidden until the next visit.
    }
  };

  return (
    <section className={styles.nameCard} aria-labelledby={`${id}-h`}>
      <div className={styles.nameText}>
        <h2 id={`${id}-h`} className={styles.nameTitle}>
          Want a workspace for your own projects?
        </h2>
        <p className={styles.nameHint}>
          You're in {workspace.name} as {workspace.role === 'admin' ? 'an admin' : 'a member'}, so
          projects here belong to {workspace.name}. A workspace of your own is separate: only you
          see it unless you invite people.
        </p>
      </div>
      <div className={styles.nameForm}>
        <Button onClick={() => setCreating(true)}>Create my workspace</Button>
        <button type="button" className={styles.later} onClick={dismiss}>
          Not now
        </button>
      </div>
      {creating && (
        <NewWorkspaceDialog
          userId={user.id}
          onCreated={selectWorkspace}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
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
    if (name.trim())
      rename.mutate(
        { id: workspace.id, name: name.trim() },
        { onSuccess: () => markNamed(workspace.id) },
      );
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
        <button
          type="button"
          className={styles.later}
          onClick={() => {
            // Remembered: the card doesn't come back for this workspace.
            markNamed(workspace.id);
            setDismissed(true);
          }}
        >
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
  /** Undefined while loading, null when loading failed. */
  stats?: ProjectStats | null;
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
        {project.demo ? (
          <Pill tone="ended">Demo</Pill>
        ) : installed ? (
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
              <dd>{stats ? stats.liveTests : stats === null ? '—' : '…'}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Visitors, 30d</dt>
              <dd>{stats ? compactNumber(stats.visitors30d) : stats === null ? '—' : '…'}</dd>
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
          {stats && stats.dailyVisitors.length > 0 && (
            <Sparkline values={stats.dailyVisitors} {...LINE[tone]!} />
          )}
          {stats === null && (
            <p className={styles.muted} role="alert">
              Couldn't load this project's numbers.
            </p>
          )}
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
