import { Link, useMatches } from 'react-router';
import { MenuIcon } from '../components/icons';
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
}: {
  actionsRef: (el: HTMLDivElement | null) => void;
  navOpen: boolean;
  onOpenNav(): void;
}) {
  const { workspace } = useWorkspace();
  const project = useCurrentProject();
  const crumbs: Crumb[] = [{ label: workspace.name, to: '/projects' }];
  for (const match of useMatches()) {
    const handle = match.handle as RouteHandle | undefined;
    if (handle?.crumbs) crumbs.push(...handle.crumbs({ workspace, project, params: match.params }));
  }

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
      <div className={styles.actions} ref={actionsRef} />
    </header>
  );
}
