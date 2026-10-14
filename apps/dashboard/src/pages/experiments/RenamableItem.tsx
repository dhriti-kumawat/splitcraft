import { useId, useState, type ReactNode } from 'react';
import styles from './RenamableItem.module.css';

/**
 * A list entry (the Original or a variation) with a pencil to rename it in place:
 * Enter saves, Escape cancels, an empty name keeps the old one. With `onDelete`, a bin
 * button asks to confirm, then deletes.
 */
export function RenamableItem({
  name,
  label,
  canRename,
  onRename,
  onDelete,
  children,
}: {
  name: string;
  /** Accessible label of the name field, e.g. "Variation name". */
  label: string;
  canRename: boolean;
  onRename(name: string): void;
  onDelete?(): void;
  /** The entry's own button. */
  children: ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState(name);
  const id = useId();

  if (renaming) {
    const done = () => {
      const next = draft.trim();
      if (next && next !== name) onRename(next);
      setRenaming(false);
    };
    return (
      <div className={styles.renameRow}>
        <label htmlFor={id} className="visually-hidden">
          {label}
        </label>
        <input
          id={id}
          className={styles.input}
          value={draft}
          maxLength={60}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={done}
          onKeyDown={(e) => {
            if (e.key === 'Enter') done();
            if (e.key === 'Escape') setRenaming(false);
          }}
        />
      </div>
    );
  }

  if (deleting) {
    return (
      <div className={styles.renameRow} role="group" aria-label={`Delete ${name}?`}>
        <p className={styles.confirm}>
          Delete <b>{name}</b> and its code?
        </p>
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.delete}
            onClick={() => {
              setDeleting(false);
              onDelete?.();
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className={styles.keep}
            autoFocus
            onClick={() => setDeleting(false)}
          >
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.row} ${onDelete ? styles.two : ''}`}>
      {children}
      {onDelete && (
        <button
          type="button"
          className={`${styles.rename} ${styles.bin}`}
          aria-label={`Delete ${name}`}
          title="Delete"
          onClick={() => setDeleting(true)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
          </svg>
        </button>
      )}
      {canRename && (
        <button
          type="button"
          className={styles.rename}
          aria-label={`Rename ${name}`}
          title="Rename"
          onClick={() => {
            setDraft(name);
            setRenaming(true);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13.5 3.5l3 3L7 16H4v-3z" />
          </svg>
        </button>
      )}
    </div>
  );
}
