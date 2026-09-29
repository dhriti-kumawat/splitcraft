import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Menu.module.css';

export interface MenuItem {
  label: string;
  onSelect(): void;
  /** Why the item can't be used right now; shown under the label. */
  disabledReason?: string;
  danger?: boolean;
}

/**
 * Menu button: arrow keys, Home and End move between items, Escape or a click outside
 * closes the menu and returns focus to the button.
 */
export function Menu({
  label,
  children,
  items,
}: {
  label: string;
  children: ReactNode;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const itemEls = () => [
    ...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];

  useEffect(() => {
    if (!open) return;
    itemEls()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const els = itemEls();
    const i = els.indexOf(document.activeElement as HTMLElement);
    const move: Record<string, number> = {
      ArrowDown: (i + 1) % els.length,
      ArrowUp: (i - 1 + els.length) % els.length,
      Home: 0,
      End: els.length - 1,
    };
    if (e.key in move) {
      e.preventDefault();
      els[move[e.key]!]?.focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.menu}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabledReason ? true : undefined}
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              onClick={() => {
                if (item.disabledReason) return;
                close();
                item.onSelect();
              }}
            >
              {item.label}
              {item.disabledReason && <span className={styles.reason}>{item.disabledReason}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
