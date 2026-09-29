import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { PlusIcon } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { Pill } from '../../components/Pill';
import { Sparkline } from '../../components/Sparkline';
import type { Project, ProjectStats } from '../../data/api';
import { useOverviewQuery } from '../../data/queries';
import { initials, useWorkspace } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import { compactNumber } from '../../lib/format';
import { NewProjectDrawer } from './NewProjectDrawer';
import styles from './ProjectsPage.module.css';

const TONES = [styles.tone0, styles.tone1, styles.tone2];
const LINE = [
  { color: 'var(--accent)', fill: 'var(--accent-soft)' },
  { color: 'var(--variant-a)', fill: 'var(--variant-a-soft)' },
  { color: 'var(--warn-dot)', fill: 'var(--warn-soft)' },
];

/** Workspace › Projects grid with the New project drawer (10-projects.html). */
export function ProjectsPage() {
  const { workspace, projects } = useWorkspace();
  const overview = useOverviewQuery(workspace.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const statsFor = (id: string) => overview.data?.find((s) => s.projectId === id);

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
        <ul className={styles.grid}>
          {projects.map((project, i) => (
            <li key={project.id}>
              <ProjectCard project={project} stats={statsFor(project.id)} tone={i % 3} />
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
      </section>

      {drawerOpen && <NewProjectDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

function ProjectCard({
  project,
  stats,
  tone,
}: {
  project: Project;
  stats?: ProjectStats;
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
            <div className={styles.stat}>
              <dt>No winner yet</dt>
              <dd className={styles.muted}>—</dd>
            </div>
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
