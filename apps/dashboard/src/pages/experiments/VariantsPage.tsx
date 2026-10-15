import { useEffect, useId, useRef, useState } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { CodeEditor } from '../../components/CodeEditor';
import { seriesColor } from '../../lib/chartColors';
import {
  BarPopover,
  SplitPanes,
  ThemeMenu,
  useEditorTheme,
  useFillHeight,
  useStacked,
} from './EditorTools';
import type { Experiment, Variant } from '../../data/api';
import {
  useEditVariants,
  useSaveVariantCode,
  useUpdateVariants,
  useVersionsQuery,
} from '../../data/queries';
import { controlKey } from '../../lib/experiments';
import {
  onVisualEdit,
  openWithExtension,
  previewState,
  projectHosts,
  updatePreview,
  useExtension,
  usePreviewSession,
} from '../../lib/previewBridge';
import { testPage } from '../../lib/launch';
import { PreviewDialog } from './PreviewDialog';
import { appendCode, visualCode } from '../../lib/visual';
import { syntaxError } from '../../lib/launch';
import { useExperiment } from './experimentContext';
import { AddVariant } from './AddVariant';
import { MvtVariants } from './MvtVariants';
import { SplitUrlVariants } from './SplitUrlVariants';
import { RenamableItem } from './RenamableItem';
import { TemplatePicker } from './TemplatePicker';
import { TrafficSplit } from './TrafficSplit';
import styles from './VariantsPage.module.css';

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

/** Experiment step 2: what each variant changes, by test type. */
export function VariantsPage() {
  const { experiment } = useExperiment();
  if (experiment.type === 'split_url') return <SplitUrlVariants />;
  if (experiment.type === 'mvt') return <MvtVariants />;
  return <CodeVariants />;
}

/** A/B tests: variants and their JS/CSS (13-exp-step2-variant-code.html). */
function CodeVariants() {
  const { experiment } = useExperiment();
  const control = controlKey(experiment);
  const [selectedId, setSelectedId] = useState(
    () => experiment.variants.find((v) => v.key !== control)?.id ?? experiment.variants[0]!.id,
  );
  // Unsaved edits per variant, kept while switching between variants.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // A variant just added: selected once it shows up in the refreshed experiment.
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [file, setFile] = useState<'js' | 'css'>('js');
  const selected =
    (addedKey && experiment.variants.find((v) => v.key === addedKey)) ||
    experiment.variants.find((v) => v.id === selectedId) ||
    experiment.variants[0]!;
  const edits = useEditVariants(experiment);
  const rename = useUpdateVariants(experiment);
  const preview = usePreviewSession();
  const live = preview?.experimentKey === experiment.key;
  // The editor's variants as they are now, unsaved edits included.
  const withDrafts = () => experiment.variants.map((v) => ({ ...v, ...drafts[v.id] }));
  const select = (id: string) => {
    setAddedKey(null);
    setSelectedId(id);
    // Picking a variant here shows it in the open preview too.
    const key = experiment.variants.find((v) => v.id === id)?.key;
    if (live && key) updatePreview(previewState(experiment, withDrafts(), key), true);
  };

  // Stream unsaved edits to the open preview, a moment after typing stops.
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(
      () =>
        updatePreview(
          previewState(
            experiment,
            experiment.variants.map((v) => ({ ...v, ...drafts[v.id] })),
          ),
        ),
      400,
    );
    return () => clearTimeout(t);
  }, [live, experiment, drafts]);

  // "Edit visually" on the site: add the generated code to that variant's draft.
  const [visualNote, setVisualNote] = useState('');
  useEffect(
    () =>
      onVisualEdit((edit) => {
        if (edit.experimentKey !== experiment.key) return;
        const variant = experiment.variants.find((v) => v.key === edit.variantKey);
        const code = visualCode(edit.changes);
        if (!variant || (!code.js && !code.css)) return;
        setDrafts((d) => {
          const now = d[variant.id] ?? { js: variant.js, css: variant.css };
          return {
            ...d,
            [variant.id]: { js: appendCode(now.js, code.js), css: appendCode(now.css, code.css) },
          };
        });
        setAddedKey(null);
        setSelectedId(variant.id);
        setVisualNote(
          `Added ${edit.changes.length} visual ${edit.changes.length === 1 ? 'change' : 'changes'} to ${variant.name}. Check the code, then save.`,
        );
      }),
    [experiment],
  );

  const current: Draft = drafts[selected.id] ?? { js: selected.js, css: selected.css };
  const layout = useRef<HTMLDivElement>(null);
  useFillHeight(layout);
  // Variations can be deleted in a draft, as long as one is left besides the original.
  const canDelete =
    experiment.status === 'draft' &&
    experiment.variants.filter((v) => v.key !== control).length > 1;
  const dirty = (v: Variant) => {
    const d = drafts[v.id];
    return Boolean(d && (d.js !== v.js || d.css !== v.css));
  };

  return (
    <div className={styles.layout} ref={layout}>
      <section className={styles.variants} aria-labelledby="variants-label">
        <span className={styles.lbl} id="variants-label">
          Variations
        </span>
        {visualNote && (
          <p role="status" className={styles.visualNote}>
            {visualNote}
          </p>
        )}
        <ul className={styles.variantList}>
          {experiment.variants.map((v, i) => {
            const code = drafts[v.id] ?? v;
            const isControl = v.key === control;
            return (
              <li key={v.id}>
                <RenamableItem
                  name={v.name}
                  label={isControl ? 'Original name' : 'Variation name'}
                  canRename={experiment.status !== 'ended'}
                  onRename={(name) => rename.mutate([{ id: v.id, patch: { name } }])}
                  onDelete={
                    canDelete && !isControl
                      ? () =>
                          edits.remove.mutate(v.id, {
                            onSuccess: () =>
                              v.id === selected.id &&
                              select(
                                experiment.variants.find((x) => x.key !== control && x.id !== v.id)
                                  ?.id ?? experiment.variants[0]!.id,
                              ),
                          })
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className={styles.variant}
                    aria-current={v.id === selected.id ? 'true' : undefined}
                    onClick={() => select(v.id)}
                  >
                    <span className={styles.variantName}>
                      <span className={styles.swatch} style={{ background: seriesColor(i) }} />
                      {v.name}
                      {dirty(v) && <span className={styles.muted}> · unsaved</span>}
                    </span>
                    <span className={styles.variantMeta}>
                      {isControl
                        ? 'Original page, no code'
                        : `${lines(code.js)} lines JS · ${lines(code.css)} lines CSS`}
                    </span>
                  </button>
                </RenamableItem>
              </li>
            );
          })}
        </ul>
        {experiment.type === 'personalization' ? (
          <p className={styles.muted}>
            Everyone who matches the targeting sees Personalized. The original stays as is.
          </p>
        ) : (
          <AddVariant
            experiment={experiment}
            buttonClassName={styles.add}
            onAdded={(key) => setAddedKey(key)}
          />
        )}
        {experiment.type !== 'personalization' && (
          <section className={styles.splitCard} aria-label="Traffic split">
            <TrafficSplit experiment={experiment} />
          </section>
        )}
        <p className={styles.visualTip}>
          No code needed for simple changes: click <b>Edit visually</b> above the code to open your
          page with the visual editor. Point at text to rewrite it, recolour it or hide it.
        </p>
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
        onRestore={(v) => setDrafts((d) => ({ ...d, [selected.id]: { js: v.js, css: v.css } }))}
      />
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
  onRestore,
}: {
  experiment: Experiment;
  variant: Variant;
  isControl: boolean;
  code: Draft;
  file: 'js' | 'css';
  onFile(f: 'js' | 'css'): void;
  onChange(code: Draft): void;
  onSaved(): void;
  onRestore(v: Draft): void;
}) {
  const save = useSaveVariantCode(experiment);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { project } = useExperiment();
  const ext = useExtension();
  const session = usePreviewSession();
  const [visualDialog, setVisualDialog] = useState(false);
  const [visualError, setVisualError] = useState('');

  // "Edit visually": open this variant on the site with the visual editor already on.
  const editVisually = () => {
    setVisualError('');
    const state = {
      ...previewState(
        experiment,
        experiment.variants.map((v) => (v.id === variant.id ? { ...v, ...code } : v)),
        variant.key,
      ),
      visual: true,
    };
    if (session?.experimentKey === experiment.key) updatePreview(state, true);
    else if (ext)
      openWithExtension(testPage(experiment, project), projectHosts(project), state).catch(
        (e: unknown) => setVisualError(e instanceof Error ? e.message : String(e)),
      );
    else setVisualDialog(true);
  };
  const tabId = useId();
  // Full screen, like VWO's code editor: JS and CSS side by side across the whole window.
  const [full, setFull] = useState(false);
  const [theme, setTheme] = useEditorTheme();
  // One-column layout: the page scrolls, so the editor hands the wheel back at its ends.
  const passWheel = useStacked() && !full;
  // The loaded Monaco editors, for Format. A plain map: nothing renders from it.
  const [editors] = useState(() => new Map<'js' | 'css', MonacoEditor.IStandaloneCodeEditor>());
  const keep = (f: 'js' | 'css') => (e: MonacoEditor.IStandaloneCodeEditor | null) => {
    if (e) editors.set(f, e);
    else editors.delete(f);
  };
  const format = () => {
    for (const e of editors.values()) void e.getAction('editor.action.formatDocument')?.run();
  };
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape first closes Monaco's own popups (suggestions, find).
      if (
        e.key === 'Escape' &&
        !document.querySelector(
          '.monaco-editor .suggest-widget.visible, .monaco-editor .find-widget.visible',
        )
      )
        setFull(false);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [full]);
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
  const pane = (f: 'js' | 'css') => (
    <div className={styles.pane}>
      <span className={styles.paneHead}>
        {slug}.{f}
      </span>
      <div className={styles.code}>
        <CodeEditor
          fill
          theme={theme}
          language={f === 'js' ? 'javascript' : 'css'}
          label={`${variant.name} ${f.toUpperCase()}`}
          value={code[f]}
          onChange={(value) => onChange({ ...code, [f]: value })}
          onSave={doSave}
          readOnly={readOnly}
          onEditor={keep(f)}
        />
      </div>
    </div>
  );
  const bytes = new Blob([code.js, code.css]).size;

  if (isControl) {
    return (
      <section className={styles.editor} aria-label="Control">
        <div className={styles.control}>
          <strong style={{ color: '#fff' }}>{variant.name} is the page as it is</strong>
          <span>
            Visitors here see your site unchanged, so it has no code. Rename it with the pencil in
            the list, or pick a variation to edit its code.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.editor} ${full ? styles.full : ''}`}
      data-theme={theme}
      aria-label={`Code for ${variant.name}`}
    >
      <div className={styles.editorBar}>
        {full ? (
          <span className={styles.fullTitle}>
            {experiment.name} · {variant.name}
          </span>
        ) : (
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
        )}
        <div className={styles.barActions}>
          <BarPopover label="Built-in helpers" wide icon={<HelpIcon />}>
            {() => (
              <>
                <p className={styles.popTitle}>Built-in helpers</p>
                <dl className={styles.popHelpers}>
                  {HELPERS.map(([sig, text]) => (
                    <div key={sig}>
                      <dt>splitcraft.{sig}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
                <p className={styles.popHint}>
                  Type <span className="mono">splitcraft.</span> in the JS to get them suggested.
                </p>
              </>
            )}
          </BarPopover>
          <BarPopover label="Version history" wide icon={<HistoryIcon />}>
            {(close) => (
              <VersionList
                variant={variant}
                onRestore={(v) => {
                  onRestore(v);
                  close();
                }}
              />
            )}
          </BarPopover>
          <ThemeMenu theme={theme} onChange={setTheme} />
          {!readOnly && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={format}
              aria-label="Format code"
              title="Format code (Shift+Alt+F)"
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
          )}
          <button
            type="button"
            className={styles.iconButton}
            aria-pressed={full}
            aria-label={full ? 'Exit full screen' : 'Full screen'}
            title={full ? 'Exit full screen (Esc)' : 'Full screen: JS and CSS side by side'}
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
          {!readOnly && !isControl && (
            <button type="button" className={styles.darkButton} onClick={editVisually}>
              Edit visually
            </button>
          )}
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
      {visualError && (
        <p role="alert" className={styles.visualError}>
          {visualError}
        </p>
      )}
      {visualDialog && (
        <PreviewDialog
          experiment={experiment}
          project={project}
          visualVariant={variant.key}
          onClose={() => setVisualDialog(false)}
        />
      )}
      {full ? (
        <SplitPanes first={pane('js')} second={pane('css')} />
      ) : (
        <div
          className={styles.code}
          role="tabpanel"
          id={`${tabId}-panel`}
          aria-labelledby={`${tabId}-${file}`}
        >
          <CodeEditor
            fill
            key={file}
            theme={theme}
            passWheel={passWheel}
            language={file === 'js' ? 'javascript' : 'css'}
            label={`${variant.name} ${file.toUpperCase()}`}
            value={file === 'js' ? code.js : code.css}
            onChange={(value) =>
              onChange(file === 'js' ? { ...code, js: value } : { ...code, css: value })
            }
            onSave={doSave}
            readOnly={readOnly}
            onEditor={keep(file)}
          />
        </div>
      )}
      <div className={styles.status} role="status">
        {error ? (
          <span className={styles.statusBad}>JS error: {error}</span>
        ) : (
          <span className={styles.statusOk}>No errors</span>
        )}
        <span>
          Key {variant.key} · {(bytes / 1024).toFixed(1)} KB ·{' '}
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
        <p className={styles.liveNote}>
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

function VersionList({ variant, onRestore }: { variant: Variant; onRestore(v: Draft): void }) {
  const versions = useVersionsQuery(variant.id);
  const older = versions.data ?? [];
  return (
    <>
      <p className={styles.popTitle}>Version history</p>
      <ul className={styles.popVersions}>
        <li>
          <span style={{ fontWeight: 600 }}>v{variant.version} · current</span>
        </li>
        {older.map((v, i) => (
          <li key={v.id}>
            <span>
              v{variant.version - 1 - i}
              {v.note ? ` · ${v.note}` : ''}
              <br />
              <span className={styles.popVersionDate}>{date.format(new Date(v.createdAt))}</span>
            </span>
            <button
              type="button"
              className={styles.restore}
              onClick={() => onRestore(v)}
              aria-label={`Load v${variant.version - 1 - i} into the editor`}
            >
              Load
            </button>
          </li>
        ))}
        {versions.isSuccess && older.length === 0 && <li>No earlier versions yet.</li>}
      </ul>
      <p className={styles.popHint}>Loading a version puts it in the editor. Save to keep it.</p>
    </>
  );
}

function HelpIcon() {
  return (
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
      <circle cx="8" cy="8" r="6.2" />
      <path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.4v.1" />
    </svg>
  );
}

function HistoryIcon() {
  return (
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
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  );
}
