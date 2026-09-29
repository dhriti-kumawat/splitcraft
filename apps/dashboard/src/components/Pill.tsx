import type { ReactNode } from 'react';
import styles from './Pill.module.css';

/** Status pill from design/README.md: Live (green), Draft (grey), Paused (amber), Ended (blue). */
export function Pill({
  tone,
  children,
}: {
  tone: 'live' | 'draft' | 'paused' | 'ended';
  children: ReactNode;
}) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
