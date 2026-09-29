import { NavLink, type NavLinkProps } from 'react-router';
import {
  AudiencesIcon,
  ExperimentsIcon,
  InstallIcon,
  Logo,
  MetricsIcon,
  ProjectsIcon,
  SettingsIcon,
  TeamIcon,
} from '../components/icons';
import { Switcher } from '../components/Switcher';
import { initials, useCurrentProject, useWorkspace } from '../data/workspace';
import styles from './Sidebar.module.css';

const numberFormat = new Intl.NumberFormat('en-US');

function Item(props: NavLinkProps) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
    />
  );
}

/** 240 px dark sidebar from design/README.md "App shell". */
export function Sidebar() {
  const { user, workspace, projects } = useWorkspace();
  const project = useCurrentProject();
  const usage = workspace.eventsThisMonth / workspace.eventsLimit;
  const base = project ? `/p/${project.id}` : '';

  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      <NavLink to="/projects" className={styles.brand}>
        <Logo />
        Splitly
      </NavLink>

      <Switcher
        label="Switch workspace"
        badge={
          <span className={`${styles.badge} ${styles.workspaceBadge}`} aria-hidden="true">
            {initials(workspace.name)}
          </span>
        }
        title={workspace.name}
        subtitle={`${workspace.plan === 'free' ? 'Free' : 'Pro'} plan · ${projects.length} projects`}
        items={[{ id: workspace.id, to: '/projects', label: workspace.name }]}
        currentId={workspace.id}
      />

      <nav className={styles.nav} aria-label="Workspace">
        <Item to="/projects" end>
          <ProjectsIcon />
          Projects
        </Item>
        <Item to="/team">
          <TeamIcon />
          Team
        </Item>
      </nav>

      {project && (
        <div className={styles.group}>
          <span className={styles.label} id="current-project-label">
            Current project
          </span>
          <Switcher
            label="Switch project"
            badge={
              <span className={`${styles.badge} ${styles.projectBadge}`} aria-hidden="true">
                {initials(project.name)}
              </span>
            }
            title={project.name}
            subtitle={<span className="mono">{project.mainDomain}</span>}
            items={projects.map((p) => ({
              id: p.id,
              to: `/p/${p.id}/experiments`,
              label: p.name,
              hint: p.mainDomain,
            }))}
            currentId={project.id}
          />
          <nav className={styles.nav} aria-labelledby="current-project-label">
            <Item to={`${base}/experiments`}>
              <ExperimentsIcon />
              Experiments
            </Item>
            <Item to={`${base}/audiences`}>
              <AudiencesIcon />
              Audiences
            </Item>
            <Item to={`${base}/metrics`}>
              <MetricsIcon />
              Metrics
            </Item>
            <Item to={`${base}/install`}>
              <InstallIcon />
              Install
            </Item>
            <Item to={`${base}/settings`}>
              <SettingsIcon />
              Settings
            </Item>
          </nav>
        </div>
      )}

      <div className={styles.usage}>
        <span className={styles.usageLabel} id="events-usage-label">
          Events this month
        </span>
        <span className={`${styles.usageValue} mono`}>
          {numberFormat.format(workspace.eventsThisMonth)}{' '}
          <span className={styles.usageLimit}>/ {numberFormat.format(workspace.eventsLimit)}</span>
        </span>
        <div
          className={styles.meter}
          role="meter"
          aria-labelledby="events-usage-label"
          aria-valuemin={0}
          aria-valuemax={workspace.eventsLimit}
          aria-valuenow={workspace.eventsThisMonth}
        >
          <div
            className={`${styles.meterFill} ${usage >= 0.9 ? styles.high : ''}`}
            style={{ width: `${Math.min(100, usage * 100)}%` }}
          />
        </div>
      </div>

      <div className={styles.user}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className={styles.userText}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{user.role}</span>
        </span>
      </div>
    </aside>
  );
}
