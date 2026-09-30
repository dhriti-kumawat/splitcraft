import { useEffect, useId, useState } from 'react';
import { CodeEditor } from '../../components/CodeEditor';
import type { MvtFactor, MvtLevel } from '../../data/api';
import { useSetMvt } from '../../data/queries';
import { syntaxError } from '../../lib/launch';
import { combinationCount, combinations, MVT_LIMITS } from '../../lib/mvt';
import { previewState, updatePreview, usePreviewSession } from '../../lib/previewBridge';
import { useExperiment } from './experimentContext';
import own from './MvtVariants.module.css';
import styles from './VariantsPage.module.css';

const LEVEL_KEYS = 'abcdefgh';
const original = (): MvtLevel => ({ key: 'a', name: 'Original', js: '', css: '' });

/**
 * Experiment step 2 for multivariate tests: sections (factors), each with versions
 * (levels). Saving generates one variant per combination; the first version of each
 * section is the original page.
 */
export function MvtVariants() {
  const { experiment } = useExperiment();
  const setMvt = useSetMvt(experiment);
  const [factors, setFactors] = useState<MvtFactor[]>(experiment.factors);
  const [sel, setSel] = useState<{ f: number; l: number } | null>(
    experiment.factors.length
      ? { f: 0, l: Math.min(1, experiment.factors[0]!.levels.length - 1) }
      : null,
  );
  const [file, setFile] = useState<'js' | 'css'>('js');
  // Name field to focus after adding a section or version, so it gets a real name.
  const [focusName, setFocusName] = useState<'section' | 'version' | null>(null);
  const selectOnMount = (el: HTMLInputElement | null) => {
    if (el && document.activeElement !== el) {
      el.focus();
      el.select();
      setFocusName(null);
    }
  };
  const tabId = useId();
  const isDraft = experiment.status === 'draft';
  const readOnly = experiment.status === 'ended';
  const count = combinationCount(factors);
  const dirty = JSON.stringify(factors) !== JSON.stringify(experiment.factors);
  const errors = factors.flatMap((f) =>
    f.levels.flatMap((l) => {
      const e = syntaxError(l.js);
      return e ? [`${f.name}: ${l.name}: ${e}`] : [];
    }),
  );
  const tooMany = count > MVT_LIMITS.combinations;

  // Stream unsaved section edits to the open preview as combinations.
  const preview = usePreviewSession();
  const live = preview?.experimentKey === experiment.key;
  useEffect(() => {
    if (!live || tooMany) return;
    const t = setTimeout(() => updatePreview(previewState(experiment, combinations(factors))), 400);
    return () => clearTimeout(t);
  }, [live, tooMany, experiment, factors]);

  const edit = (fi: number, fn: (f: MvtFactor) => MvtFactor) =>
    setFactors((fs) => fs.map((f, i) => (i === fi ? fn(f) : f)));
  const editLevel = (fi: number, li: number, patch: Partial<MvtLevel>) =>
    edit(fi, (f) => ({
      ...f,
      levels: f.levels.map((l, i) => (i === li ? { ...l, ...patch } : l)),
    }));

  const addSection = () => {
    const n = factors.length + 1;
    const used = new Set(factors.map((f) => f.key));
    const key = Array.from({ length: 9 }, (_, i) => `s${i + 1}`).find((k) => !used.has(k))!;
    setFactors((fs) => [
      ...fs,
      {
        key,
        name: `Section ${n}`,
        levels: [original(), { key: 'b', name: 'Version B', js: '', css: '' }],
      },
    ]);
    setSel({ f: factors.length, l: 1 });
    setFocusName('section');
  };
  const addLevel = (fi: number) => {
    const f = factors[fi]!;
    const key = LEVEL_KEYS[f.levels.length]!;
    edit(fi, (x) => ({
      ...x,
      levels: [...x.levels, { key, name: `Version ${key.toUpperCase()}`, js: '', css: '' }],
    }));
    setSel({ f: fi, l: f.levels.length });
    setFocusName('version');
  };
  const removeLevel = (fi: number, li: number) => {
    edit(fi, (x) => ({
      ...x,
      // Re-key so combination keys stay one digit per section.
      levels: x.levels.filter((_, i) => i !== li).map((l, i) => ({ ...l, key: LEVEL_KEYS[i]! })),
    }));
    setSel({ f: fi, l: 0 });
  };
  const removeSection = (fi: number) => {
    setFactors((fs) => fs.filter((_, i) => i !== fi));
    setSel(null);
  };

  const save = () => {
    if (!dirty || errors.length || tooMany || setMvt.isPending) return;
    setMvt.mutate({ factors, variants: combinations(factors) });
  };

  const level = sel ? factors[sel.f]?.levels[sel.l] : undefined;
  const factor = sel ? factors[sel.f] : undefined;

  return (
    <div className={styles.layout}>
      <section className={styles.variants} aria-labelledby="sections-label">
        <span className={styles.lbl} id="sections-label">
          Sections
        </span>
        {factors.length === 0 && (
          <p className={own.empty}>
            Add a section for each part of the page you want to change, such as the headline or the
            main button. Give each section one or more new versions.
          </p>
        )}
        <ul className={own.sections}>
          {factors.map((f, fi) => (
            <li key={f.key} className={own.section}>
              <div className={own.sectionHead}>
                <label htmlFor={`${tabId}-f${fi}`} className="visually-hidden">
                  Section name
                </label>
                <input
                  ref={
                    focusName === 'section' && fi === factors.length - 1 ? selectOnMount : undefined
                  }
                  id={`${tabId}-f${fi}`}
                  className={own.sectionName}
                  value={f.name}
                  maxLength={40}
                  readOnly={!isDraft}
                  onChange={(e) => edit(fi, (x) => ({ ...x, name: e.target.value }))}
                />
                {isDraft && (
                  <button
                    type="button"
                    className={own.remove}
                    aria-label={`Remove section ${f.name}`}
                    onClick={() => removeSection(fi)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <ul className={styles.variantList}>
                {f.levels.map((l, li) => (
                  <li key={l.key}>
                    <button
                      type="button"
                      className={styles.variant}
                      aria-current={sel?.f === fi && sel.l === li ? 'true' : undefined}
                      onClick={() => setSel({ f: fi, l: li })}
                    >
                      <span className={styles.variantName}>{l.name}</span>
                      <span className={styles.variantMeta}>
                        {li === 0
                          ? 'Unchanged'
                          : l.js.trim() || l.css.trim()
                            ? 'Has code'
                            : 'No code yet'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {isDraft && f.levels.length < MVT_LIMITS.levels && (
                <button type="button" className={own.addLevel} onClick={() => addLevel(fi)}>
                  + Add version
                </button>
              )}
            </li>
          ))}
        </ul>
        {isDraft && factors.length < MVT_LIMITS.factors && (
          <button type="button" className={styles.add} onClick={addSection}>
            + Add section
          </button>
        )}
      </section>

      {factor && level && sel && sel.l > 0 ? (
        <section className={styles.editor} aria-label={`Code for ${factor.name}: ${level.name}`}>
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
                  onClick={() => setFile(f)}
                >
                  {factor.key}-{level.key}.{f}
                </button>
              ))}
            </div>
          </div>
          <div className={own.levelBar}>
            <label htmlFor={`${tabId}-lname`} className={own.levelLabel}>
              Version name
            </label>
            <input
              ref={focusName === 'version' ? selectOnMount : undefined}
              id={`${tabId}-lname`}
              className={own.levelName}
              value={level.name}
              maxLength={40}
              readOnly={readOnly}
              onChange={(e) => editLevel(sel.f, sel.l, { name: e.target.value })}
            />
            {isDraft && (
              <button
                type="button"
                className={own.levelRemove}
                onClick={() => removeLevel(sel.f, sel.l)}
                disabled={factor.levels.length <= 2}
              >
                Remove version
              </button>
            )}
          </div>
          <div
            className={styles.code}
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-${file}`}
          >
            <CodeEditor
              key={`${factor.key}-${level.key}-${file}`}
              language={file === 'js' ? 'javascript' : 'css'}
              label={`${factor.name} ${level.name} ${file.toUpperCase()}`}
              value={file === 'js' ? level.js : level.css}
              onChange={(value) => editLevel(sel.f, sel.l, { [file]: value })}
              onSave={save}
              readOnly={readOnly}
            />
          </div>
        </section>
      ) : (
        <section className={styles.editor} aria-label="Original">
          <div className={styles.control}>
            <strong style={{ color: '#fff' }}>
              {factor ? `${factor.name}: original` : 'No version selected'}
            </strong>
            <span>
              {factor
                ? 'The first version of each section is the page as it is. Pick a new version to edit its code.'
                : 'Add a section, then write the code for each new version.'}
            </span>
          </div>
        </section>
      )}

      <aside className={styles.aside} aria-label="Combinations">
        <section className={styles.card} aria-labelledby="combos-h">
          <h2 className={styles.cardTitle} id="combos-h">
            {count} combination{count === 1 ? '' : 's'}
          </h2>
          <p className={own.hint}>
            {factors.map((f) => f.levels.length).join(' × ') || '0'} versions. Traffic is split
            evenly, so each combination gets about {Math.round(100 / count)}% of visitors.
          </p>
          {tooMany && (
            <p role="alert" className={own.bad}>
              At most {MVT_LIMITS.combinations} combinations. Remove a version or a section.
            </p>
          )}
          {errors.map((e) => (
            <p key={e} role="alert" className={own.bad}>
              JS error in {e}
            </p>
          ))}
          <button
            type="button"
            className={own.saveButton}
            onClick={save}
            disabled={!dirty || errors.length > 0 || tooMany || setMvt.isPending || readOnly}
          >
            {setMvt.isPending ? 'Saving…' : dirty ? 'Save and build combinations' : 'Saved'}
          </button>
          {setMvt.isError && (
            <p role="alert" className={own.bad}>
              Couldn't save: {setMvt.error.message}
            </p>
          )}
          {experiment.status === 'live' && (
            <p className={own.hint}>Live: saved code reaches visitors within about a minute.</p>
          )}
          <ol className={own.combos}>
            {experiment.variants.map((v) => (
              <li key={v.id}>
                <span className="mono">{v.key}</span> {v.name}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
