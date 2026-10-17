import type { editor as MonacoEditor } from 'monaco-editor';
import { useEffect, useState, type ReactNode } from 'react';
import { ThemeMenu, useEditorTheme } from '../pages/experiments/EditorTools';
import { CodeEditor } from './CodeEditor';
import styles from './CodeField.module.css';

/**
 * A small code editor for JS snippets in forms (a metric's tracker, a custom JS condition,
 * an activation condition), with the main variant editor's tools: the same Monaco editor,
 * theme menu, Format, full screen, wrapped lines and a status line.
 */
export function CodeField({
  label,
  filename,
  value,
  onChange,
  onSave,
  height = 200,
  status,
  error,
  actions,
  placeholder,
  invalid,
}: {
  /** Accessible name of the editor. */
  label: string;
  /** Shown in the bar, e.g. tracker.js. */
  filename: string;
  value: string;
  onChange(value: string): void;
  onSave?(): void;
  height?: number;
  /** Shown in the status line, e.g. "Runs once per page". */
  status?: ReactNode;
  /** A problem with the code, shown in the status line instead. */
  error?: string | null;
  /** Extra buttons for the bar, e.g. Insert snippet. */
  actions?: ReactNode;
  /** Shown above an empty editor, as an example. */
  placeholder?: string;
  invalid?: boolean;
}) {
  const [theme, setTheme] = useEditorTheme();
  const [full, setFull] = useState(false);
  const [editor, setEditor] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !document.querySelector(
          '.monaco-editor .suggest-widget.visible, .monaco-editor .find-widget.visible',
        )
      )
        setFull(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full]);

  return (
    <div
      className={`${styles.field} ${full ? styles.full : ''} ${invalid ? styles.invalid : ''}`}
      data-theme={theme}
      style={full ? undefined : { height }}
    >
      <div className={styles.bar}>
        <span className={styles.filename}>{filename}</span>
        <div className={styles.tools}>
          {actions}
          <ThemeMenu theme={theme} onChange={setTheme} />
          <button
            type="button"
            className={styles.icon}
            aria-label="Format code"
            title="Format code (Shift+Alt+F)"
            onClick={() => void editor?.getAction('editor.action.formatDocument')?.run()}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M2 3.5h12M5 6.5h9M5 9.5h9M2 12.5h12" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-pressed={full}
            aria-label={full ? 'Exit full screen' : 'Full screen'}
            title={full ? 'Exit full screen (Esc)' : 'Full screen'}
            onClick={() => setFull((f) => !f)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {full ? (
                <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
              ) : (
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>
      <div className={styles.code}>
        {!value && placeholder && (
          <span className={styles.placeholder} aria-hidden="true">
            {placeholder}
          </span>
        )}
        <CodeEditor
          fill
          theme={theme}
          passWheel={!full}
          language="javascript"
          label={label}
          value={value}
          onChange={onChange}
          onSave={onSave}
          onEditor={setEditor}
        />
      </div>
      {(error || status) && (
        <div className={error ? styles.statusBad : styles.status} role="status">
          {error ? `JS error: ${error}` : status}
        </div>
      )}
    </div>
  );
}
