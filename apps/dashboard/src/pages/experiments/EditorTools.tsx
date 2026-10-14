import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { EDITOR_THEMES, type EditorTheme } from '../../components/CodeEditor';
import styles from './VariantsPage.module.css';

const THEME_KEY = 'splitcraft_editor_theme';
const SPLIT_KEY = 'splitcraft_editor_split';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

/** The editor theme, remembered in this browser. */
export function useEditorTheme(): [EditorTheme, (t: EditorTheme) => void] {
  const [theme, setTheme] = useState<EditorTheme>(() => {
    const saved = read(THEME_KEY);
    return EDITOR_THEMES.some((t) => t.id === saved) ? (saved as EditorTheme) : 'dark';
  });
  return [
    theme,
    (t) => {
      setTheme(t);
      write(THEME_KEY, t);
    },
  ];
}

/** Theme picker for the editor bar: a small menu of Dark, Grey and Light. */
export function ThemeMenu({
  theme,
  onChange,
}: {
  theme: EditorTheme;
  onChange(t: EditorTheme): void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const current = EDITOR_THEMES.find((t) => t.id === theme)!;

  return (
    <div
      className={styles.themeMenu}
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`Editor theme: ${current.label}`}
        title={`Editor theme: ${current.label}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className={styles.themeList} role="group" aria-label="Editor theme">
          {EDITOR_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === theme}
              className={styles.themeOption}
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <span className={styles.swatch} data-swatch={t.id} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STACKED = '(max-width: 1023px)';

/** Below 1024 px the panes stack, and the bar resizes them up and down. */
function useStacked(): boolean {
  const [stacked, setStacked] = useState(
    () => typeof matchMedia === 'function' && matchMedia(STACKED).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia(STACKED);
    const on = () => setStacked(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return stacked;
}

/**
 * Two panes with a bar between them to drag (or move with the arrow keys) to resize. The
 * share of the first pane is remembered in this browser.
 */
export function SplitPanes({ first, second }: { first: ReactNode; second: ReactNode }) {
  const [share, setShare] = useState(() => {
    const saved = Number(read(SPLIT_KEY));
    return saved >= 20 && saved <= 80 ? saved : 50;
  });
  const box = useRef<HTMLDivElement>(null);
  const stacked = useStacked();
  const set = (n: number) => {
    const next = Math.round(Math.min(80, Math.max(20, n)));
    setShare(next);
    write(SPLIT_KEY, String(next));
  };

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      set(
        stacked
          ? ((ev.clientY - rect.top) / rect.height) * 100
          : ((ev.clientX - rect.left) / rect.width) * 100,
      );
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      document.body.classList.remove(styles.resizing!);
    };
    document.body.classList.add(styles.resizing!);
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  };

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const to =
      e.key === (stacked ? 'ArrowUp' : 'ArrowLeft')
        ? share - step
        : e.key === (stacked ? 'ArrowDown' : 'ArrowRight')
          ? share + step
          : e.key === 'Home'
            ? 20
            : e.key === 'End'
              ? 80
              : null;
    if (to === null) return;
    e.preventDefault();
    set(to);
  };

  return (
    <div
      ref={box}
      className={styles.split}
      data-stacked={stacked || undefined}
      style={{ '--first': `${share}fr`, '--second': `${100 - share}fr` } as CSSProperties}
    >
      {first}
      <div
        className={styles.splitBar}
        role="separator"
        aria-orientation={stacked ? 'horizontal' : 'vertical'}
        aria-label="Resize JS and CSS"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={share}
        aria-valuetext={`JS ${share}%, CSS ${100 - share}%`}
        tabIndex={0}
        title="Drag to resize. Double-click to reset."
        onPointerDown={drag}
        onKeyDown={keys}
        onDoubleClick={() => set(50)}
      />
      {second}
    </div>
  );
}
