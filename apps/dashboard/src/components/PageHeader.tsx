import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
