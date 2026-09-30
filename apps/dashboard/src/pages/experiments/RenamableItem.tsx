import { useId, useState, type ReactNode } from 'react';
import styles from './RenamableItem.module.css';

/**
 * A list entry (the Original or a variation) with a pencil to rename it in place:
 * Enter saves, Escape cancels, an empty name keeps the old one.
 */
export function RenamableItem({
  name,
  label,
  canRename,
  onRename,
  children,
}: {
  name: string;
  /** Accessible label of the name field, e.g. "Variation name". */
  label: string;
  canRename: boolean;
  onRename(name: string): void;
  /** The entry's own button. */
  children: ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
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

  return (
    <div className={styles.row}>
      {children}
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
