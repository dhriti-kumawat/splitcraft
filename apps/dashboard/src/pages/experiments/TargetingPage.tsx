import { Menu } from '../../components/Menu';
import { useId, useState } from 'react';
import { CodeField } from '../../components/CodeField';
import { ConditionBuilder } from '../../components/ConditionBuilder';
import { PageRulesEditor } from '../../components/PageRulesEditor';
import { SaveAsDialog } from '../../components/SavedPicker';
import { Link } from 'react-router';
import type { SavedKind } from '../../data/api';
import {
  useExperimentStatsQuery,
  useSavedMutations,
  useSavedQuery,
  useSegmentsQuery,
  useSessionSampleQuery,
  useUpdateExperiment,
} from '../../data/queries';
import { groupsProblemCount } from '../../lib/conditions';
import {
  describePageRules,
  fromWhere,
  pageRuleProblems,
  toWhere,
  type PageRules,
} from '../../lib/pageRules';
import { fromGroups, toGroups } from '../../lib/segments';
import { summarize } from '../../lib/experiments';
import { evaluateGroup, share } from '../../lib/reach';
import type { ConditionGroup, Frequency, StoredTargeting } from '../../lib/targeting';
import { testUrl } from '../../lib/urlTest';
import { useExperiment } from './experimentContext';
import { number, ReachEstimate, SaveBar, whoSentence } from './targetingShared';
import styles from './TargetingPage.module.css';

/**
 * Experiment step: where and when the test runs (14-exp-step3-targeting.html): pages,
 * optional triggers in the visit, and frequency, with activation and evaluation under
 * Advanced. Who can see it is the Audience step.
 */
export function TargetingPage() {
  const { experiment, project } = useExperiment();
  const update = useUpdateExperiment(experiment);
  const segments = useSegmentsQuery(project.id);
  const sample = useSessionSampleQuery(project.id);
  const pageSets = useSavedQuery('page_sets', project.id);
  const triggers = useSavedQuery('triggers', project.id);
  const saveTrigger = useSavedMutations('triggers', project.id);
  const savePageSet = useSavedMutations('page_sets', project.id);
  const [savingAs, setSavingAs] = useState<SavedKind | null>(null);
  const [savedAs, setSavedAs] = useState('');
  const stats = useExperimentStatsQuery(project.id);
  const t = experiment.targeting;

  const [where, setWhere] = useState<PageRules>(() => fromWhere(t.where));
  const { pages, elements } = where;
  const [how, setHow] = useState<ConditionGroup[]>(t.how ?? []);
  const [when, setWhen] = useState<Frequency>(t.when ?? { mode: 'every_load' });
  const [stay, setStay] = useState(t.stay === true);
  const [waitMs, setWaitMs] = useState(String(t.waitForDataLayerMs ?? 0));
  const [activation, setActivation] = useState<ActivationDraft>(() => fromActivation(t.activation));
  const [submitted, setSubmitted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  // WHO is the Audience step's; it is kept as saved there.
  const next: StoredTargeting = {
    ...(t.who ? { who: t.who } : {}),
    ...(toWhere(where) ? { where: toWhere(where) } : {}),
    ...(how.some((g) => g.items.length) ? { how: how.filter((g) => g.items.length) } : {}),
    ...(when.mode !== 'every_load' ? { when } : {}),
    ...(stay ? { stay: true } : {}),
    ...(Number(waitMs) > 0 ? { waitForDataLayerMs: Math.round(Number(waitMs)) } : {}),
    ...(toActivation(activation) ? { activation: toActivation(activation) } : {}),
  };
  const waitId = useId();
  const waitProblem = !(Number(waitMs) >= 0 && Number(waitMs) <= 5000);
  const snapshot = JSON.stringify(next);
  const dirty = snapshot !== JSON.stringify(t);
  const problems =
    pageRuleProblems(where) +
    groupsProblemCount(how) +
    (when.mode === 'every_n_days' && !(when.days >= 1) ? 1 : 0) +
    (waitProblem ? 1 : 0) +
    (activationProblem(activation) ? 1 : 0);
  const ended = experiment.status === 'ended';
  // Open Advanced when something in it is set, or needs fixing.
  const advancedSet = activation.mode !== 'immediate' || stay || Number(waitMs) > 0 || waitProblem;

  const save = () => {
    setSubmitted(true);
    if (problems) return;
    update.mutate({ targeting: next }, { onSuccess: () => setSavedSnapshot(snapshot) });
  };

  const segmentName = (id: string) =>
    segments.data?.find((s) => s.id === id)?.name ?? 'Deleted audience';
  const summary = stats.data ? summarize(experiment, stats.data) : null;
  const base = `/p/${project.id}/experiments/${experiment.id}`;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {/* Pages */}
        <section className={styles.section} aria-labelledby="where-h">
          <div className={styles.titleBlock}>
            <h2 className={styles.title} id="where-h">
              Pages
            </h2>
            <span className={styles.sub}>
              Where the test runs. Any include rule can match; exclude rules always win.
            </span>
          </div>
          {pages.length === 0 && elements.length === 0 && (
            <p className={styles.empty}>Runs on every page of the site.</p>
          )}
          <PageRulesEditor value={where} onChange={setWhere} submitted={submitted} />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.small}
              onClick={() =>
                setWhere({
                  pages: [...pages, { kind: 'include', op: 'matches', value: '' }],
                  elements,
                })
              }
            >
              + URL rule
            </button>
            <button
              type="button"
              className={styles.small}
              onClick={() => setWhere({ pages, elements: [...elements, { selector: '' }] })}
            >
              + Element rule
            </button>
            {(pageSets.data ?? []).length > 0 && (
              <Menu
                text
                label="Use saved page set"
                items={pageSets.data!.map((p) => ({
                  label: `${p.name} · ${describePageRules(p.rules)}`,
                  onSelect: () => {
                    const set = fromWhere(p.rules);
                    setWhere({
                      pages: [...pages, ...set.pages],
                      elements: [...elements, ...set.elements],
                    });
                  },
                }))}
              >
                Use saved page set
              </Menu>
            )}
            {toWhere(where) && pageRuleProblems(where) === 0 && (
              <button
                type="button"
                className={styles.saveAs}
                onClick={() => setSavingAs('page_sets')}
              >
                Save as page set
              </button>
            )}
          </div>
        </section>

        {/* Triggers */}
        <section className={styles.section} aria-labelledby="how-h">
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <h2 className={styles.title} id="how-h">
                Triggers
              </h2>
              <span className={styles.optional}>Optional</span>
            </div>
            <span className={styles.sub}>
              Only start the test when something is true in this visit: screen size, pages viewed,
              time on page, a dataLayer value or your own JS.
            </span>
          </div>
          <ConditionBuilder
            groups={how}
            onChange={setHow}
            noun="Trigger"
            estimate={
              sample.data ? (g) => share(sample.data.sample, (s) => evaluateGroup(g, s)) : undefined
            }
          />
          {((triggers.data ?? []).length > 0 ||
            (how.some((g) => g.items.length) && groupsProblemCount(how) === 0)) && (
            <div className={styles.actions}>
              {(triggers.data ?? []).length > 0 && (
                <Menu
                  text
                  label="Use saved trigger"
                  items={triggers.data!.map((tr) => ({
                    label: tr.name,
                    onSelect: () => setHow([...how, ...toGroups(tr.rules)]),
                  }))}
                >
                  Use saved trigger
                </Menu>
              )}
              {how.some((g) => g.items.length) && groupsProblemCount(how) === 0 && (
                <button
                  type="button"
                  className={styles.saveAs}
                  onClick={() => setSavingAs('triggers')}
                >
                  Save as trigger
                </button>
              )}
            </div>
          )}
        </section>

        {/* Frequency */}
        <section className={styles.section} aria-labelledby="when-h">
          <div className={styles.titleBlock}>
            <h2 className={styles.title} id="when-h">
              Frequency
            </h2>
            <span className={styles.sub}>How often a matched visitor sees the variant.</span>
          </div>
          <FrequencyPicker value={when} onChange={setWhen} />
        </section>

        {/* Advanced */}
        <details className={styles.advanced} open={advancedSet || undefined}>
          <summary>
            <span className={styles.title}>Advanced</span>
            <span className={styles.sub}>
              {advancedSet
                ? 'Activation or evaluation changed'
                : 'Activation and evaluation: defaults suit most tests'}
            </span>
          </summary>
          <div className={styles.advancedBody}>
            <ActivationPicker
              value={activation}
              onChange={setActivation}
              experimentKey={experiment.key}
              showErrors={submitted}
            />
            <div className={styles.subsection} aria-labelledby="eval-h">
              <h3 className={styles.subTitle} id="eval-h">
                Evaluation
              </h3>
              <label className={styles.check}>
                <input type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)} />
                <span>
                  <b>Once matched, stay in the test.</b>{' '}
                  <span className={styles.sub}>
                    After a visitor sees it, the audience and triggers aren&apos;t checked again;
                    pages and frequency still are.
                  </span>
                </span>
              </label>
              <div className={styles.row}>
                <label htmlFor={waitId}>Wait for dataLayer up to</label>
                <input
                  id={waitId}
                  type="number"
                  min={0}
                  max={5000}
                  step={100}
                  className={`${styles.input} ${styles.number}`}
                  value={waitMs}
                  onChange={(e) => setWaitMs(e.target.value)}
                  aria-describedby={`${waitId}-hint`}
                  aria-invalid={waitProblem}
                />
                <span>ms</span>
              </div>
              <span id={`${waitId}-hint`} className={waitProblem ? styles.error : styles.sub}>
                {waitProblem
                  ? 'Between 0 and 5,000 ms.'
                  : 'For dataLayer conditions pushed after the page loads. 0 decides at once.'}
              </span>
            </div>
          </div>
        </details>

        <SaveBar
          label="Save targeting"
          onSave={save}
          disabled={!dirty || update.isPending || ended}
          error={update.isError || (submitted && problems > 0)}
          status={
            update.isError
              ? `Couldn't save: ${update.error.message}`
              : submitted && problems
                ? `${problems} ${problems === 1 ? 'rule needs' : 'rules need'} a value.`
                : savedSnapshot === snapshot
                  ? 'Saved.'
                  : dirty
                    ? 'Unsaved changes'
                    : ''
          }
          note={
            experiment.status === 'live' && dirty
              ? "Live: new rules apply from each visitor's next page."
              : undefined
          }
        />
        {savedAs && (
          <p role="status" className={styles.status}>
            {savedAs}
          </p>
        )}
        {savingAs && (
          <SaveAsDialog
            title={savingAs === 'triggers' ? 'Save as trigger' : 'Save as page set'}
            description={
              savingAs === 'triggers'
                ? 'Reuse these conditions in other experiments with Use saved trigger.'
                : 'Reuse these page rules in other experiments with Use saved page set.'
            }
            placeholder={savingAs === 'triggers' ? 'Engaged mobile visit' : 'Trip and deal pages'}
            pending={saveTrigger.create.isPending || savePageSet.create.isPending}
            error={(saveTrigger.create.error ?? savePageSet.create.error)?.message}
            onClose={() => setSavingAs(null)}
            onSave={(name) => {
              const done = () => {
                setSavingAs(null);
                setSavedAs(`Saved “${name}” to Audiences.`);
              };
              if (savingAs === 'triggers') {
                saveTrigger.create.mutate(
                  { name, rules: fromGroups(how.filter((g) => g.items.length)) },
                  { onSuccess: done },
                );
              } else {
                savePageSet.create.mutate({ name, rules: toWhere(where)! }, { onSuccess: done });
              }
            }}
          />
        )}
      </div>

      <aside className={styles.aside} aria-label="Targeting check">
        <section className={styles.section} aria-labelledby="who-see">
          <span className={styles.lbl} id="who-see">
            Who will see this
          </span>
          <span className={styles.who}>{whoSentence(next, segmentName)}</span>
          <Link to={`${base}/audience`} className={styles.link}>
            {t.who ? 'Edit audience' : 'Narrow down who sees it in Audience'}
          </Link>
          <ReachEstimate
            projectId={project.id}
            targeting={next}
            segments={segments.data ?? []}
            trafficPct={experiment.trafficPct}
            plannedSample={experiment.plannedSample}
            arms={experiment.variants.length}
          />
          {summary && experiment.status !== 'draft' && (
            <span className={styles.sub}>
              <span className={styles.big}>
                {number.format(Math.round(summary.visitorsPerDay))}
              </span>{' '}
              visitors a day entered this test in the last 7 days.
            </span>
          )}
        </section>
        <UrlTester targeting={next} domain={project.mainDomain} testPage={experiment.previewUrl} />
      </aside>
    </div>
  );
}

function FrequencyPicker({ value, onChange }: { value: Frequency; onChange(f: Frequency): void }) {
  const id = useId();
  const options: Array<{ mode: Frequency['mode']; label: string }> = [
    { mode: 'every_load', label: 'Every page load' },
    { mode: 'once', label: 'Once' },
    { mode: 'once_per_session', label: 'Once per session' },
    { mode: 'every_n_days', label: 'Every N days' },
  ];
  return (
    <div className={styles.row}>
      <div className={styles.seg} role="radiogroup" aria-label="Frequency">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={value.mode === o.mode}
            className={styles.segButton}
            onClick={() =>
              onChange(
                o.mode === 'every_n_days'
                  ? { mode: 'every_n_days', days: value.mode === 'every_n_days' ? value.days : 7 }
                  : ({ mode: o.mode } as Frequency),
              )
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.mode === 'every_n_days' && (
        <>
          <label htmlFor={id}>Days</label>
          <input
            id={id}
            className={`${styles.input} ${styles.number}`}
            type="number"
            min={1}
            value={Number.isFinite(value.days) ? value.days : ''}
            onChange={(e) => onChange({ mode: 'every_n_days', days: Number(e.target.value) })}
          />
        </>
      )}
    </div>
  );
}

function UrlTester({
  targeting,
  domain,
  testPage,
}: {
  targeting: StoredTargeting;
  domain: string;
  testPage: string | null;
}) {
  // Start with the experiment's test page (without the scheme), or the home page.
  const [url, setUrl] = useState(testPage ? testPage.replace(/^https?:\/\//, '') : `${domain}/`);
  const id = useId();
  const result = testUrl(url, targeting);
  return (
    <section className={styles.section} aria-labelledby={`${id}-h`}>
      <span className={styles.lbl} id={`${id}-h`}>
        Test a URL
      </span>
      <label htmlFor={id} className="visually-hidden">
        URL to test
      </label>
      <input
        id={id}
        className={`${styles.input} ${styles.mono}`}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        spellCheck={false}
      />
      {result.valid ? (
        <>
          <ul className={styles.checks}>
            {result.lines.map((l, i) => (
              <li key={i}>
                <span
                  className={l.ok === null ? styles.info : l.ok ? styles.ok : styles.bad}
                  aria-hidden="true"
                >
                  {l.ok === null ? '·' : l.ok ? '✓' : '✗'}
                </span>
                <span>
                  {l.text}
                  <span className="visually-hidden">
                    {l.ok === null ? '' : l.ok ? ' (passes)' : ' (fails)'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <span className={styles.sub} role="status">
            {result.matches
              ? 'This page is in the test if the visitor matches the rest.'
              : 'Visitors on this page never see the test.'}
          </span>
        </>
      ) : (
        <span className={styles.error}>Enter a full URL, like {domain}/trips/norway.</span>
      )}
    </section>
  );
}

interface ActivationDraft {
  mode: 'immediate' | 'element' | 'js' | 'manual';
  selector: string;
  code: string;
  seconds: string;
}

function fromActivation(a: StoredTargeting['activation']): ActivationDraft {
  return {
    mode: a?.mode ?? 'immediate',
    selector: a?.mode === 'element' ? a.selector : '',
    code: a?.mode === 'js' ? a.code : '',
    seconds: String(a && a.mode !== 'manual' && a.timeoutMs ? a.timeoutMs / 1000 : 10),
  };
}

function toActivation(d: ActivationDraft): StoredTargeting['activation'] {
  const timeoutMs = Math.round(Number(d.seconds) * 1000);
  if (d.mode === 'manual') return { mode: 'manual' };
  if (d.mode === 'element') return { mode: 'element', selector: d.selector.trim(), timeoutMs };
  if (d.mode === 'js') return { mode: 'js', code: d.code, timeoutMs };
  return undefined;
}

/** What's wrong with the activation, or ''. */
function activationProblem(d: ActivationDraft): string {
  if (d.mode === 'immediate' || d.mode === 'manual') return '';
  const s = Number(d.seconds);
  if (!(s >= 0.1 && s <= 60)) return 'Wait between 0.1 and 60 seconds.';
  if (d.mode === 'js')
    return d.code.trim() ? '' : 'Write the condition, e.g. return window.cartLoaded;';
  if (!d.selector.trim()) return 'Enter a CSS selector, e.g. .cart-drawer.';
  try {
    document.createDocumentFragment().querySelector(d.selector);
    return '';
  } catch {
    return 'That isn’t a valid CSS selector.';
  }
}

const ACTIVATION_MODES: Array<{ id: ActivationDraft['mode']; label: string; text: string }> = [
  { id: 'immediate', label: 'Immediately', text: 'When the page loads or the route changes.' },
  {
    id: 'element',
    label: 'When an element appears',
    text: 'For content that loads late, like a cart drawer or a modal.',
  },
  {
    id: 'js',
    label: 'When a JS condition is true',
    text: 'Checked every 100 ms until it returns true.',
  },
  { id: 'manual', label: 'Manually', text: 'Your code activates it, e.g. after an AJAX call.' },
];

/** Activation: when the experiment starts on a matching page (like Optimizely's). */
function ActivationPicker({
  value,
  onChange,
  experimentKey,
  showErrors,
}: {
  value: ActivationDraft;
  onChange(d: ActivationDraft): void;
  experimentKey: string;
  showErrors: boolean;
}) {
  const id = useId();
  const problem = activationProblem(value);
  const set = (patch: Partial<ActivationDraft>) => onChange({ ...value, ...patch });
  return (
    <div className={styles.subsection} aria-labelledby={`${id}-h`}>
      <h3 className={styles.subTitle} id={`${id}-h`}>
        Activation <span className={styles.sub}>When the test starts on a matching page</span>
      </h3>
      <div role="radiogroup" aria-labelledby={`${id}-h`} className={styles.activationModes}>
        {ACTIVATION_MODES.map((m) => (
          <label key={m.id} className={styles.check}>
            <input
              type="radio"
              name={`${id}-mode`}
              checked={value.mode === m.id}
              onChange={() => set({ mode: m.id })}
            />
            <span>
              <b>{m.label}.</b> <span className={styles.sub}>{m.text}</span>
            </span>
          </label>
        ))}
      </div>
      {value.mode === 'element' && (
        <div className={styles.row}>
          <label htmlFor={`${id}-sel`}>CSS selector</label>
          <input
            id={`${id}-sel`}
            className={`${styles.input} mono`}
            value={value.selector}
            placeholder=".cart-drawer"
            onChange={(e) => set({ selector: e.target.value })}
            aria-invalid={showErrors && Boolean(problem)}
          />
        </div>
      )}
      {value.mode === 'js' && (
        <div className={styles.activationCode}>
          <span>Condition (return true to activate)</span>
          <CodeField
            label="Condition (return true to activate)"
            filename="activation.js"
            value={value.code}
            onChange={(code) => set({ code })}
            height={170}
            placeholder="return window.cartLoaded === true;"
            invalid={showErrors && Boolean(problem)}
          />
        </div>
      )}
      {(value.mode === 'element' || value.mode === 'js') && (
        <div className={styles.row}>
          <label htmlFor={`${id}-sec`}>Stop waiting after</label>
          <input
            id={`${id}-sec`}
            type="number"
            min={0.1}
            max={60}
            step={0.5}
            className={`${styles.input} ${styles.number}`}
            value={value.seconds}
            onChange={(e) => set({ seconds: e.target.value })}
          />
          <span>seconds</span>
        </div>
      )}
      {value.mode === 'manual' && (
        <p className={styles.sub}>
          Add this where the test should start:{' '}
          <code className="mono">{`splitcraft.activate('${experimentKey}')`}</code>. It works for
          the current page; a route change needs a new call.
        </p>
      )}
      {showErrors && problem && (
        <span className={styles.error} role="alert">
          {problem}
        </span>
      )}
      {value.mode !== 'immediate' && (
        <span className={styles.sub}>The page shows at once while the test waits.</span>
      )}
    </div>
  );
}
