import { useEffect, useId, useState, type FormEvent } from 'react';
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
const firstSection = (): MvtFactor => ({ key: 's1', name: 'Section 1', levels: [original()] });
/** Sections without variations change nothing, so they don't count in combinations. */
const inUse = (fs: MvtFactor[]) => fs.filter((f) => f.levels.length > 1);

/**
 * Experiment step 2 for multivariate tests: the page opens ready, with the Original and
 * "+ Add variation". Variations of one part of the page make a section (factor); "+ Add
 * another section" tests a second part, and every combination becomes a variant, as in
 * VWO (sections), Optimizely (sections) and AB Tasty (subtests). Section names only show
 * once there are two or more.
 */
export function MvtVariants() {
  const { experiment } = useExperiment();
  const setMvt = useSetMvt(experiment);
  const [factors, setFactors] = useState<MvtFactor[]>(() =>
    experiment.factors.length ? experiment.factors : [firstSection()],
  );
  const [sel, setSel] = useState<{ f: number; l: number } | null>(() => ({
    f: 0,
    l: Math.min(1, (experiment.factors[0]?.levels.length ?? 1) - 1),
  }));
  const [file, setFile] = useState<'js' | 'css'>('js');
  // A new section's name is focused and selected, so it gets a real name.
  const [focusName, setFocusName] = useState<'section' | null>(null);
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
  const used = inUse(factors);
  const count = combinationCount(used);
  const dirty = JSON.stringify(used) !== JSON.stringify(inUse(experiment.factors));
  const multi = factors.length > 1;
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
    const t = setTimeout(() => updatePreview(previewState(experiment, combinations(used))), 400);
    return () => clearTimeout(t);
  }, [live, tooMany, experiment, used]);

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
        levels: [original()],
      },
    ]);
    setSel({ f: factors.length, l: 0 });
    setFocusName('section');
  };
  const addLevel = (fi: number, name: string) => {
    const f = factors[fi]!;
    const key = LEVEL_KEYS[f.levels.length]!;
    edit(fi, (x) => ({ ...x, levels: [...x.levels, { key, name, js: '', css: '' }] }));
    setSel({ f: fi, l: f.levels.length });
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
    setFactors((fs) => {
      const rest = fs.filter((_, i) => i !== fi);
      return rest.length ? rest : [firstSection()];
    });
    setSel({ f: 0, l: 0 });
  };

  const save = () => {
    if (!dirty || errors.length || tooMany || setMvt.isPending) return;
    setMvt.mutate({ factors: used, variants: combinations(used) });
  };

  const level = sel ? factors[sel.f]?.levels[sel.l] : undefined;
  const factor = sel ? factors[sel.f] : undefined;

  return (
    <div className={styles.layout}>
      <section className={styles.variants} aria-labelledby="sections-label">
        <span className={styles.lbl} id="sections-label">
          {multi ? 'Sections' : 'Variations'}
        </span>
        <ul className={own.sections}>
          {factors.map((f, fi) => (
            <li key={f.key} className={own.section}>
              {multi && (
                <div className={own.sectionHead}>
                  <label htmlFor={`${tabId}-f${fi}`} className="visually-hidden">
                    Section name
                  </label>
                  <input
                    ref={
                      focusName === 'section' && fi === factors.length - 1
                        ? selectOnMount
                        : undefined
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
              )}
              <ul className={styles.variantList}>
                {f.levels.map((l, li) => (
                  <li key={l.key}>
                    <LevelRow
                      level={l}
                      isOriginal={li === 0}
                      selected={sel?.f === fi && sel.l === li}
                      canRename={!readOnly}
                      onSelect={() => setSel({ f: fi, l: li })}
                      onRename={(name) => editLevel(fi, li, { name })}
                    />
                  </li>
                ))}
              </ul>
              {isDraft && f.levels.length < MVT_LIMITS.levels && (
                <AddVariation onAdd={(name) => addLevel(fi, name)} />
              )}
            </li>
          ))}
        </ul>
        {isDraft && factors.length < MVT_LIMITS.factors && (
          <>
            <button type="button" className={styles.add} onClick={addSection}>
              + Add another section
            </button>
            {!multi && (
              <p className={own.empty}>
                To test changes to another part of the page too (say the headline and the button),
                add a section: every combination of their variations is tested.
              </p>
            )}
          </>
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
              Variation name
            </label>
            <input
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
              >
                Remove variation
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
              fill
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
              {factor ? `${factor.name}: original` : 'No variation selected'}
            </strong>
            <span>
              {factor
                ? factor.levels.length > 1
                  ? 'The original is the page as it is. Pick a variation to edit its code.'
                  : 'The original is the page as it is. Add a variation to write its code.'
                : 'Add a variation to write its code.'}
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
            {used.length > 1
              ? `${used.map((f) => f.levels.length).join(' × ')} (original plus variations per section). `
              : ''}
            Traffic is split evenly, so each combination gets about {Math.round(100 / count)}% of
            visitors.
          </p>
          {tooMany && (
            <p role="alert" className={own.bad}>
              At most {MVT_LIMITS.combinations} combinations. Remove a variation or a section.
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

/** One entry in a section: select it to edit its code; variations can be renamed here. */
function LevelRow({
  level,
  isOriginal,
  selected,
  canRename,
  onSelect,
  onRename,
}: {
  level: MvtLevel;
  isOriginal: boolean;
  selected: boolean;
  canRename: boolean;
  onSelect(): void;
  onRename(name: string): void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(level.name);
  const id = useId();

  if (renaming) {
    const done = () => {
      if (name.trim()) onRename(name.trim());
      else setName(level.name);
      setRenaming(false);
    };
    return (
      <div className={own.renameRow}>
        <label htmlFor={id} className="visually-hidden">
          {isOriginal ? 'Original name' : 'Variation name'}
        </label>
        <input
          id={id}
          className={own.renameInput}
          value={name}
          maxLength={40}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setName(e.target.value)}
          onBlur={done}
          onKeyDown={(e) => {
            if (e.key === 'Enter') done();
            if (e.key === 'Escape') {
              setName(level.name);
              setRenaming(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={own.levelRow}>
      <button
        type="button"
        className={styles.variant}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        <span className={styles.variantName}>{level.name}</span>
        <span className={styles.variantMeta}>
          {isOriginal
            ? 'Unchanged'
            : level.js.trim() || level.css.trim()
              ? 'Has code'
              : 'No code yet'}
        </span>
      </button>
      {canRename && (
        <button
          type="button"
          className={own.rename}
          aria-label={`Rename ${level.name}`}
          title="Rename"
          onClick={() => {
            setName(level.name);
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

/** "+ Add variation", asking for its name first. */
function AddVariation({ onAdd }: { onAdd(name: string): void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const id = useId();
  if (!open)
    return (
      <button type="button" className={own.addLevel} onClick={() => setOpen(true)}>
        + Add variation
      </button>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
    setOpen(false);
  };
  return (
    <form className={own.addForm} onSubmit={submit}>
      <label htmlFor={id} className={own.addLabel}>
        New variation name
      </label>
      <input
        id={id}
        className={own.renameInput}
        value={name}
        maxLength={40}
        placeholder="e.g. Shorter headline"
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      <div className={own.addActions}>
        <button type="submit" className={own.addPrimary} disabled={!name.trim()}>
          Add
        </button>
        <button type="button" className={own.addCancel} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
