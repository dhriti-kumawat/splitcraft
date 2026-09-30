import { useId, useState } from 'react';
import type { Experiment } from '../../data/api';
import { useUpdateVariants } from '../../data/queries';
import { evenWeights } from '../../lib/experiments';
import styles from './TrafficSplit.module.css';

/**
 * The share of the experiment's traffic each variant gets, as percentages adding up to
 * 100. Editable until launch; "Split evenly" resets it.
 */
export function TrafficSplit({ experiment }: { experiment: Experiment }) {
  // Start again from the saved weights whenever variants are added, removed or saved.
  const version = experiment.variants.map((v) => `${v.id}:${v.weight}`).join();
  return <SplitForm key={version} experiment={experiment} />;
}

function SplitForm({ experiment }: { experiment: Experiment }) {
  const update = useUpdateVariants(experiment);
  const total = experiment.variants.reduce((s, v) => s + v.weight, 0) || 1;
  const [weights, setWeights] = useState(() =>
    experiment.variants.map((v) => String(Math.round((v.weight / total) * 10000) / 100)),
  );
  const id = useId();
  const locked = experiment.status !== 'draft';

  const nums = weights.map(Number);
  const sum = nums.reduce((a, b) => a + b, 0);
  const error =
    nums.some((w) => !Number.isFinite(w) || w < 0) || Math.abs(sum - 100) > 0.011
      ? `The split must add up to 100% (now ${Math.round(sum * 100) / 100}%).`
      : '';

  const save = (next: number[]) => {
    if (locked) return;
    const changed = experiment.variants
      .map((v, i) => ({ id: v.id, weight: next[i]!, old: (v.weight / total) * 100 }))
      .filter((v) => Math.abs(v.weight - v.old) > 0.001);
    if (changed.length)
      update.mutate(changed.map((c) => ({ id: c.id, patch: { weight: c.weight } })));
  };
  const even = evenWeights(experiment.variants.length);
  const isEven = nums.every((w, i) => Math.abs(w - even[i]!) < 0.011);

  return (
    <fieldset className={styles.fieldset} aria-describedby={`${id}-note`}>
      <legend className={styles.legend}>Traffic split</legend>
      <div className={styles.rows}>
        {experiment.variants.map((v, i) => (
          <label key={v.id} className={styles.row}>
            <span className={styles.name}>{v.name}</span>
            <span className={styles.inputWrap}>
              <input
                className={styles.input}
                inputMode="decimal"
                value={weights[i]}
                disabled={locked}
                onChange={(e) => setWeights((w) => w.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={() => !error && save(nums)}
                aria-invalid={Boolean(error)}
                aria-label={`${v.name} %`}
              />
              %
            </span>
          </label>
        ))}
      </div>
      {!locked && !isEven && (
        <button
          type="button"
          className={styles.even}
          onClick={() => {
            setWeights(even.map(String));
            save(even);
          }}
        >
          Split evenly
        </button>
      )}
      <span id={`${id}-note`} className={error ? styles.error : styles.hint}>
        {error ||
          (update.isError
            ? `Couldn't save: ${update.error.message}`
            : locked
              ? 'The split is locked once an experiment has started: changing it would move visitors between variants.'
              : 'Adding or removing a variant splits traffic evenly again.')}
      </span>
    </fieldset>
  );
}
