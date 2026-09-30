import { useId, useState, type FormEvent } from 'react';
import type { Experiment } from '../../data/api';
import { useEditVariants } from '../../data/queries';
import { MAX_VARIANTS } from '../../lib/chartColors';
import styles from './AddVariant.module.css';

/**
 * "+ Add variant" that asks for the variant's name first. The traffic split is then
 * divided evenly again; it can be changed under Traffic split.
 */
export function AddVariant({
  experiment,
  buttonClassName,
  label = '+ Add variant',
  placeholder = 'e.g. Sticky Book bar',
  onAdded,
}: {
  experiment: Experiment;
  buttonClassName?: string;
  label?: string;
  placeholder?: string;
  onAdded?(key: string): void;
}) {
  const { add } = useEditVariants(experiment);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const id = useId();
  const isDraft = experiment.status === 'draft';
  const full = experiment.variants.length >= MAX_VARIANTS;

  if (!open) {
    return (
      <>
        <button
          type="button"
          className={buttonClassName}
          disabled={!isDraft || full}
          onClick={() => setOpen(true)}
          title={
            !isDraft
              ? 'Variants can only be added before launch'
              : full
                ? `At most ${MAX_VARIANTS} variants`
                : undefined
          }
        >
          {label}
        </button>
        {add.isError && (
          <p role="alert" className={styles.error}>
            {add.error.message}
          </p>
        )}
      </>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || add.isPending) return;
    add.mutate(name.trim(), {
      onSuccess: (key) => {
        setName('');
        setOpen(false);
        onAdded?.(key);
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={id} className={styles.label}>
        New variant name
      </label>
      <input
        id={id}
        className={styles.input}
        value={name}
        maxLength={60}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={!name.trim() || add.isPending}>
          {add.isPending ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <span className={styles.hint}>The traffic split is divided evenly again.</span>
      {add.isError && (
        <p role="alert" className={styles.error}>
          {add.error.message}
        </p>
      )}
    </form>
  );
}
