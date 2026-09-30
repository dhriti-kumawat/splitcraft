import type { ExperimentType } from '../../data/api';
import { EXPERIMENT_TYPES } from './experimentTypes';
import styles from './TypeTag.module.css';

/** Small label for the test type: A/B, Split URL or MVT. */
export function TypeTag({ type }: { type: ExperimentType }) {
  return (
    <span className={`${styles.tag} ${styles[type]}`} title={EXPERIMENT_TYPES[type].label}>
      {EXPERIMENT_TYPES[type].short}
    </span>
  );
}
