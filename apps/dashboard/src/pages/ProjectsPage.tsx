import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { useWorkspace } from '../data/workspace';
import styles from './Pages.module.css';

// Minimal list so the shell is navigable; the full grid and new-project drawer
// from 10-projects.html arrive in feat/projects.
export function ProjectsPage() {
  const { projects } = useWorkspace();
  return (
    <>
      <PageHeader
        title="Projects"
        description="One project per product. Each has its own snippet, audiences, goals and experiments."
      />
      <ul className={styles.list}>
        {projects.map((p) => (
          <li key={p.id} className={styles.card}>
            <Link to={`/p/${p.id}/experiments`}>{p.name}</Link>
            <span className={`${styles.domain} mono`}>{p.mainDomain}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
