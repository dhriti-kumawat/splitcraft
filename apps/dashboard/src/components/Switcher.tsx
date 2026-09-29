import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CheckIcon, ChevronUpDownIcon } from './icons';
import styles from './Switcher.module.css';

export interface SwitcherItem {
  id: string;
  to: string;
  label: string;
  hint?: string;
}

interface Props {
  /** Accessible name for the button, e.g. "Switch project". */
  label: string;
  badge: ReactNode;
  title: string;
  subtitle: ReactNode;
  items: SwitcherItem[];
  currentId?: string;
  footer?: ReactNode;
}

/**
 * Sidebar switcher (workspace / project) from the design. A disclosure button that
 * reveals a list of links: Escape or a click outside closes it and returns focus.
 */
export function Switcher({ label, badge, title, subtitle, items, currentId, footer }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={`${label}: ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {badge}
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </span>
        <ChevronUpDownIcon className={styles.chevron} />
      </button>
      {open && (
        <ul id={panelId} className={styles.panel}>
          {items.map((item) => {
            const current = item.id === currentId;
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className={styles.item}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.text}>
                    <span className={styles.title}>{item.label}</span>
                    {item.hint && <span className={`${styles.subtitle} mono`}>{item.hint}</span>}
                  </span>
                  {current && <CheckIcon className={styles.check} />}
                </Link>
              </li>
            );
          })}
          {footer && <li>{footer}</li>}
        </ul>
      )}
    </div>
  );
}
