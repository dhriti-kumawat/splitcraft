import { Link, useMatches, useNavigate } from 'react-router';
import { MenuIcon, SearchIcon } from '../components/icons';
import { useCurrentProject, useWorkspace } from '../data/workspace';
import type { Crumb, RouteHandle } from './crumbs';
import styles from './TopBar.module.css';

/**
 * White 64 px top bar with the breadcrumb and a slot pages fill with `<TopBarActions>`.
 * On small screens it also holds the button that opens the sidebar.
 */
export function TopBar({
  actionsRef,
  navOpen,
  onOpenNav,
  onOpenSearch,
}: {
  actionsRef: (el: HTMLDivElement | null) => void;
  navOpen: boolean;
  onOpenNav(): void;
  onOpenSearch(): void;
}) {
  const { workspace } = useWorkspace();
  const project = useCurrentProject();
  const crumbs: Crumb[] = [{ label: workspace.name, to: '/projects' }];
  const levels: Array<{ path: string; label: Crumb['label'] }> = [];
  for (const match of useMatches()) {
    const handle = match.handle as RouteHandle | undefined;
    if (!handle?.crumbs) continue;
    const own = handle.crumbs({ workspace, project, params: match.params });
    crumbs.push(...own);
    if (own.length) levels.push({ path: match.pathname, label: own[own.length - 1]!.label });
  }
  const navigate = useNavigate();
  // Pages below a project section (an experiment, a metric, a saved audience) get a Back
  // button to that section.
  const parent = levels.length >= 3 ? levels[levels.length - 2] : undefined;
  const backLabel = typeof parent?.label === 'string' ? `Go back to ${parent.label}` : 'Go back';

  return (
    <header className={styles.topbar}>
      <div className={styles.lead}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation"
          aria-controls="app-sidebar"
          aria-expanded={navOpen}
          onClick={onOpenNav}
        >
          <MenuIcon />
        </button>
        {parent && (
          <button
            type="button"
            className={styles.back}
            aria-label={backLabel}
            title={backLabel}
            onClick={() => navigate(parent.path)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M12 4.5L6.5 10l5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol className={styles.crumbs}>
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={i} className={`${styles.crumb} ${last ? '' : styles.parent}`}>
                  {last ? (
                    <span className={styles.current} aria-current="page">
                      {crumb.label}
                    </span>
                  ) : crumb.to ? (
                    <Link to={crumb.to}>{crumb.label}</Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <div className={styles.tools}>
        <button
          type="button"
          className={styles.search}
          aria-label="Search"
          aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
          onClick={onOpenSearch}
        >
          <SearchIcon />
          <span className={styles.searchText}>Search projects, tests…</span>
          <kbd className={styles.kbd}>{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <div className={styles.actions} ref={actionsRef} />
      </div>
    </header>
  );
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}
