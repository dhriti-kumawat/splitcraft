import { useEffect, useId, useState } from 'react';
import { CodeEditor } from '../../components/CodeEditor';
import type { Experiment, Variant } from '../../data/api';
import {
  useEditVariants,
  useSaveVariantCode,
  useUpdateVariants,
  useVersionsQuery,
} from '../../data/queries';
import { controlKey } from '../../lib/experiments';
import { syntaxError } from '../../lib/launch';
import { MAX_VARIANTS } from '../../lib/chartColors';
import { useExperiment } from './experimentContext';
import { TemplatePicker } from './TemplatePicker';
import styles from './VariantsPage.module.css';

const COLORS = ['var(--variant-a)', 'var(--variant-b)', 'var(--highlight)', 'var(--accent)'];

const HELPERS = [
  ['waitForElement(sel, fn)', 'Runs once the element exists'],
  ['trackEvent(name, params)', 'Sends a goal event and a dataLayer push'],
  ['onceInView(el, fn)', 'Fires when the element is first visible'],
  ['onRouteChange(fn)', 'Re-runs on SPA navigation'],
  ['injectStyles(css)', 'Adds CSS, removed on revert'],
];

type Draft = { js: string; css: string };

const lines = (code: string) => (code.trim() ? code.trimEnd().split('\n').length : 0);
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const date = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Experiment step 2: variants and their JS/CSS (13-exp-step2-variant-code.html). */
export function VariantsPage() {
  const { experiment } = useExperiment();
  const control = controlKey(experiment);
  const [selectedId, setSelectedId] = useState(
    () => experiment.variants.find((v) => v.key !== control)?.id ?? experiment.variants[0]!.id,
  );
  // Unsaved edits per variant, kept while switching between variants.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [file, setFile] = useState<'js' | 'css'>('js');
  const selected = experiment.variants.find((v) => v.id === selectedId) ?? experiment.variants[0]!;
  const edits = useEditVariants(experiment);
  const isDraftExp = experiment.status === 'draft';

  const current: Draft = drafts[selected.id] ?? { js: selected.js, css: selected.css };
  const dirty = (v: Variant) => {
    const d = drafts[v.id];
    return Boolean(d && (d.js !== v.js || d.css !== v.css));
  };

  return (
    <div className={styles.layout}>
      <section className={styles.variants} aria-labelledby="variants-label">
        <span className={styles.lbl} id="variants-label">
          Variants
        </span>
        <ul className={styles.variantList}>
          {experiment.variants.map((v, i) => {
            const code = drafts[v.id] ?? v;
            const isControl = v.key === control;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  className={styles.variant}
                  aria-current={v.id === selected.id ? 'true' : undefined}
                  onClick={() => setSelectedId(v.id)}
                >
                  <span className={styles.variantName}>
                    <span
                      className={styles.swatch}
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    {v.name}
                    {dirty(v) && <span className={styles.muted}> · unsaved</span>}
                  </span>
                  <span className={styles.variantMeta}>
                    {isControl
                      ? 'Original page, no code'
                      : `${lines(code.js)} lines JS · ${lines(code.css)} lines CSS`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={styles.add}
          disabled={
            !isDraftExp || experiment.variants.length >= MAX_VARIANTS || edits.add.isPending
          }
          onClick={() => edits.add.mutate(undefined)}
          title={isDraftExp ? undefined : 'Variants can only be added before launch'}
        >
          + Add variant
        </button>
        {edits.add.isError && <span className={styles.note}>{edits.add.error.message}</span>}
      </section>

      <Editor
        key={selected.id}
        experiment={experiment}
        variant={selected}
        isControl={selected.key === control}
        code={current}
        file={file}
        onFile={setFile}
        onChange={(code) => setDrafts((d) => ({ ...d, [selected.id]: code }))}
        onSaved={() =>
          setDrafts((d) => {
            const next = { ...d };
            delete next[selected.id];
            return next;
          })
        }
      />

      <aside className={styles.aside} aria-label="Variant details">
        {selected.key !== control && (
          <VariantSettings
            key={selected.id}
            experiment={experiment}
            variant={selected}
            onDeleted={() =>
              setSelectedId(
                experiment.variants.find((v) => v.key !== control && v.id !== selected.id)?.id ??
                  experiment.variants[0]!.id,
              )
            }
            remove={edits.remove}
          />
        )}
        <section className={styles.card} aria-labelledby="helpers-h">
          <h2 className={styles.cardTitle} id="helpers-h">
            Built-in helpers
          </h2>
          <dl className={styles.helpers}>
            {HELPERS.map(([sig, text]) => (
              <div key={sig}>
                <dt>{sig}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>
        {selected.key !== control && (
          <History
            variant={selected}
            onRestore={(v) => setDrafts((d) => ({ ...d, [selected.id]: { js: v.js, css: v.css } }))}
          />
        )}
      </aside>
    </div>
  );
}

function Editor({
  experiment,
  variant,
  isControl,
  code,
  file,
  onFile,
  onChange,
  onSaved,
}: {
  experiment: Experiment;
  variant: Variant;
  isControl: boolean;
  code: Draft;
  file: 'js' | 'css';
  onFile(f: 'js' | 'css'): void;
  onChange(code: Draft): void;
  onSaved(): void;
}) {
  const save = useSaveVariantCode(experiment);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const tabId = useId();
  const readOnly = experiment.status === 'ended';
  const dirty = code.js !== variant.js || code.css !== variant.css;
  const [error, setError] = useState<string | null>(null);

  // Check the JS a moment after typing stops. Parses only; nothing runs.
  useEffect(() => {
    const t = setTimeout(() => setError(syntaxError(code.js)), 300);
    return () => clearTimeout(t);
  }, [code.js]);

  const doSave = () => {
    if (!dirty || readOnly || save.isPending) return;
    save.mutate(
      { variantId: variant.id, js: code.js, css: code.css },
      {
        onSuccess: () => {
          setSavedAt(new Date());
          onSaved();
        },
      },
    );
  };

  const slug = variant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const bytes = new Blob([code.js, code.css]).size;

  if (isControl) {
    return (
      <section className={styles.editor} aria-label="Control">
        <div className={styles.control}>
          <strong style={{ color: '#fff' }}>Control is the original page</strong>
          <span>
            Visitors in Control see your site unchanged. Pick another variant to edit its code.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.editor} aria-label={`Code for ${variant.name}`}>
      <div className={styles.editorBar}>
        <div className={styles.fileTabs} role="tablist" aria-label="File">
          {(['js', 'css'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              id={`${tabId}-${f}`}
              aria-selected={file === f}
              aria-controls={`${tabId}-panel`}
              className={styles.fileTab}
              onClick={() => onFile(f)}
            >
              {slug}.{f}
            </button>
          ))}
        </div>
        <div className={styles.barActions}>
          {!readOnly && (
            <button
              type="button"
              className={styles.darkButton}
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
            >
              Template
            </button>
          )}
          <button
            type="button"
            className={styles.save}
            onClick={doSave}
            disabled={!dirty || readOnly || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div
        className={styles.code}
        role="tabpanel"
        id={`${tabId}-panel`}
        aria-labelledby={`${tabId}-${file}`}
      >
        <CodeEditor
          key={file}
          language={file === 'js' ? 'javascript' : 'css'}
          label={`${variant.name} ${file.toUpperCase()}`}
          value={file === 'js' ? code.js : code.css}
          onChange={(value) =>
            onChange(file === 'js' ? { ...code, js: value } : { ...code, css: value })
          }
          onSave={doSave}
          readOnly={readOnly}
        />
      </div>
      <div className={styles.status} role="status">
        {error ? (
          <span className={styles.statusBad}>JS error: {error}</span>
        ) : (
          <span className={styles.statusOk}>No errors</span>
        )}
        <span>
          {(bytes / 1024).toFixed(1)} KB ·{' '}
          {save.isError
            ? `Couldn't save: ${save.error.message}`
            : dirty
              ? 'Unsaved changes (Cmd/Ctrl+S)'
              : savedAt
                ? `Saved ${time.format(savedAt)}`
                : readOnly
                  ? 'Read only: experiment ended'
                  : 'Saved'}
        </span>
      </div>
      {experiment.status === 'live' && (
        <p
          className={styles.note}
          style={{ margin: 0, padding: '8px 16px', background: 'var(--ink-2)' }}
        >
          This experiment is live: saved code reaches visitors within about a minute.
        </p>
      )}
      {menuOpen && (
        <TemplatePicker
          hasCode={Boolean(code.js.trim() || code.css.trim())}
          onClose={() => setMenuOpen(false)}
          onPick={(t, mode) => {
            onChange(
              mode === 'append'
                ? {
                    js: [code.js.trimEnd(), t.js].filter(Boolean).join('\n\n'),
                    css: [code.css.trimEnd(), t.css].filter(Boolean).join('\n\n'),
                  }
                : { js: t.js, css: t.css },
            );
            setMenuOpen(false);
          }}
        />
      )}
    </section>
  );
}

function VariantSettings({
  experiment,
  variant,
  onDeleted,
  remove,
}: {
  experiment: Experiment;
  variant: Variant;
  onDeleted(): void;
  remove: ReturnType<typeof useEditVariants>['remove'];
}) {
  const update = useUpdateVariants(experiment);
  const [name, setName] = useState(variant.name);
  const id = useId();
  const nonControl = experiment.variants.filter((v) => v.key !== controlKey(experiment)).length;
  return (
    <section className={styles.card} aria-labelledby={`${id}-h`}>
      <h2 className={styles.cardTitle} id={`${id}-h`}>
        Variant
      </h2>
      <div className={styles.field}>
        <label htmlFor={id} className={styles.fieldLabel}>
          Name
        </label>
        <input
          id={id}
          className={styles.input}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={() =>
            name.trim() &&
            name.trim() !== variant.name &&
            update.mutate([{ id: variant.id, patch: { name: name.trim() } }])
          }
        />
        <span className={`${styles.muted} mono`} style={{ fontSize: 12 }}>
          Key: {variant.key}
        </span>
      </div>
      {experiment.status === 'draft' && nonControl > 1 && (
        <button
          type="button"
          className={styles.danger}
          disabled={remove.isPending}
          onClick={() => remove.mutate(variant.id, { onSuccess: onDeleted })}
        >
          Delete variant
        </button>
      )}
    </section>
  );
}

function History({
  variant,
  onRestore,
}: {
  variant: Variant;
  onRestore(v: { js: string; css: string }): void;
}) {
  const versions = useVersionsQuery(variant.id);
  const older = versions.data ?? [];
  return (
    <section className={styles.card} aria-labelledby="history-h">
      <h2 className={styles.cardTitle} id="history-h">
        Version history
      </h2>
      <ul className={styles.versions}>
        <li>
          <span style={{ fontWeight: 600 }}>v{variant.version} · current</span>
        </li>
        {older.map((v, i) => (
          <li key={v.id}>
            <button
              type="button"
              className={styles.versionLink}
              onClick={() => onRestore(v)}
              aria-label={`Load v${variant.version - 1 - i} into the editor`}
            >
              v{variant.version - 1 - i}
              {v.note ? ` · ${v.note}` : ''}
            </button>
            <span className={styles.muted}>{date.format(new Date(v.createdAt))}</span>
          </li>
        ))}
        {versions.isSuccess && older.length === 0 && (
          <li className={styles.muted}>No earlier versions yet.</li>
        )}
      </ul>
    </section>
  );
}
