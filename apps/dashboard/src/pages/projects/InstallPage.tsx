import { PageHeader } from '../../components/PageHeader';
import { useInstallStatus } from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { InstallPanel, InstallStatus } from './InstallPanel';
import styles from '../Pages.module.css';

/** Project › Install: the snippet and whether the SDK has checked in yet. */
export function InstallPage() {
  const project = useCurrentProject()!;
  const status = useInstallStatus(project.installedAt ? undefined : project.id);
  const installed = Boolean(project.installedAt ?? status.data?.installedAt);
  return (
    <>
      <PageHeader
        title="Install"
        description={
          <>
            Add the snippet to every page of <span className="mono">{project.mainDomain}</span>, as
            high in the head as possible.
          </>
        }
      />
      <div className={styles.panel}>
        <InstallPanel project={project} />
        <InstallStatus installed={installed} />
      </div>
    </>
  );
}
