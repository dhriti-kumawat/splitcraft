import { PageHeader } from '../components/PageHeader';
import styles from './Pages.module.css';

/** Stand-in for screens built in later Phase 3 steps (see docs/BUILD_PLAN.md). */
export function Placeholder({ title, step }: { title: string; step: string }) {
  return (
    <>
      <PageHeader title={title} />
      <p className={styles.note}>This screen is built in {step}.</p>
    </>
  );
}
