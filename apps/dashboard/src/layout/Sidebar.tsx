import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, type NavLinkProps } from 'react-router';
import { NewWorkspaceDialog } from '../components/NewWorkspaceDialog';
import { useAuth } from '../auth/context';
import {
  AudiencesIcon,
  CloseIcon,
  ExperimentsIcon,
  InstallIcon,
  Logo,
  MetricsIcon,
  ProjectsIcon,
  SettingsIcon,
  TeamIcon,
} from '../components/icons';
import { Switcher } from '../components/Switcher';
import { EVENT_LIMIT } from '../data/api';
import { useEventsThisMonthQuery } from '../data/queries';
import { initials, useCurrentProject, useWorkspace } from '../data/workspace';
import styles from './Sidebar.module.css';

const numberFormat = new Intl.NumberFormat('en-US');

/** "1 Oct": when the monthly event count resets (UTC). */
function nextMonth(): string {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(first);
}

function Item(props: NavLinkProps) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
    />
  );
}

/**
 * 240 px dark sidebar from design/README.md "App shell". Below 1024 px it is a drawer
 * that the top bar's menu button opens.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose(): void }) {
  const { user, workspace, workspaces, projects, selectWorkspace } = useWorkspace();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  const events = useEventsThisMonthQuery(workspace.id);
  const limit = EVENT_LIMIT[workspace.plan];
  const { api } = useAuth();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const project = useCurrentProject();
  const base = project ? `/p/${project.id}` : '';

  return (
    <aside
      id="app-sidebar"
      className={`${styles.sidebar} ${open ? styles.open : ''}`}
      aria-label="Sidebar"
    >
      <div className={styles.head}>
        <NavLink to="/projects" className={styles.brand}>
          <Logo />
          Splitcraft
        </NavLink>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          aria-label="Close navigation"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <Switcher
        label="Switch workspace"
        badge={
          <span className={`${styles.badge} ${styles.workspaceBadge}`} aria-hidden="true">
            {initials(workspace.name)}
          </span>
        }
        title={workspace.name}
        subtitle={`${workspace.plan === 'free' ? 'Free' : 'Pro'} plan · ${projects.length} ${
          projects.length === 1 ? 'project' : 'projects'
        }`}
        items={workspaces.map((w) => ({
          id: w.id,
          to: '/projects',
          label: w.name,
          onSelect: () => selectWorkspace(w.id),
        }))}
        footer={
          <button type="button" className={styles.newWorkspace} onClick={() => setCreating(true)}>
            + New workspace
          </button>
        }
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
        <Item to="/workspace">
          <SettingsIcon />
          Workspace settings
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

      {events.data !== undefined && (
        <div className={styles.usage}>
          <span className={styles.usageLabel} id="events-usage-label">
            Events this month
          </span>
          <span className={`${styles.usageValue} mono`}>
            {numberFormat.format(events.data)}
            {limit !== null && (
              <span className={styles.usageLimit}> / {numberFormat.format(limit)}</span>
            )}
          </span>
          {limit !== null && events.data >= limit && (
            <span className={styles.limitNote} role="status">
              Limit reached. Experiments are paused and events aren't stored until {nextMonth()}.
            </span>
          )}
          {limit !== null && (
            <div
              className={styles.meter}
              role="meter"
              aria-labelledby="events-usage-label"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={events.data}
            >
              <div
                className={`${styles.meterFill} ${events.data / limit >= 0.9 ? styles.high : ''}`}
                style={{ width: `${Math.min(100, (events.data / limit) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className={styles.user}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className={styles.userText}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{user.role}</span>
        </span>
        <button
          type="button"
          className={styles.logout}
          onClick={async () => {
            await api.signOut();
            navigate('/login');
          }}
        >
          Log out
        </button>
      </div>
      {creating && (
        <NewWorkspaceDialog
          userId={user.id}
          onCreated={selectWorkspace}
          onClose={() => setCreating(false)}
        />
      )}
    </aside>
  );
}
