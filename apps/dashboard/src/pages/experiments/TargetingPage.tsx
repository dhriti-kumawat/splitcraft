import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { ConditionBuilder } from '../../components/ConditionBuilder';
import { useExperimentStatsQuery, useSegmentsQuery, useUpdateExperiment } from '../../data/queries';
import { describeGroups, groupsProblemCount, URL_OPS } from '../../lib/conditions';
import { summarize } from '../../lib/experiments';
import type { ConditionGroup, Frequency, StoredTargeting, UrlRule } from '../../lib/targeting';
import { testUrl } from '../../lib/urlTest';
import { useExperiment } from './experimentContext';
import styles from './TargetingPage.module.css';

type PageRule = UrlRule & { kind: 'include' | 'exclude' };
type ElementRule = { selector: string; timeoutMs?: number };

const number = new Intl.NumberFormat('en-US');

function validRegex(value: string): boolean {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

/** Experiment step 3: WHO / WHERE / HOW / WHEN (14-exp-step3-targeting.html). */
export function TargetingPage() {
  const { experiment, project } = useExperiment();
  const update = useUpdateExperiment(experiment);
  const segments = useSegmentsQuery(project.id);
  const stats = useExperimentStatsQuery(project.id);
  const t = experiment.targeting;

  const [whoMode, setWhoMode] = useState<'any' | 'all'>(t.who?.mode ?? 'any');
  const [segmentIds, setSegmentIds] = useState<string[]>(t.who?.segmentIds ?? []);
  const [pages, setPages] = useState<PageRule[]>([
    ...(t.where?.include ?? []).map((r) => ({ ...r, kind: 'include' as const })),
    ...(t.where?.exclude ?? []).map((r) => ({ ...r, kind: 'exclude' as const })),
  ]);
  const [elements, setElements] = useState<ElementRule[]>(t.where?.elements ?? []);
  const [how, setHow] = useState<ConditionGroup[]>(t.how ?? []);
  const [when, setWhen] = useState<Frequency>(t.when ?? { mode: 'every_load' });
  const [submitted, setSubmitted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  const next: StoredTargeting = {
    ...(segmentIds.length ? { who: { mode: whoMode, segmentIds } } : {}),
    ...(pages.length || elements.length
      ? {
          where: {
            ...(pages.some((p) => p.kind === 'include')
              ? {
                  include: pages
                    .filter((p) => p.kind === 'include')
                    .map(({ op, value }) => ({ op, value })),
                }
              : {}),
            ...(pages.some((p) => p.kind === 'exclude')
              ? {
                  exclude: pages
                    .filter((p) => p.kind === 'exclude')
                    .map(({ op, value }) => ({ op, value })),
                }
              : {}),
            ...(elements.length ? { elements } : {}),
          },
        }
      : {}),
    ...(how.some((g) => g.items.length) ? { how: how.filter((g) => g.items.length) } : {}),
    ...(when.mode !== 'every_load' ? { when } : {}),
  };
  const snapshot = JSON.stringify(next);
  const dirty = snapshot !== JSON.stringify(t);
  const pageProblems = pages.filter(
    (p) => !p.value.trim() || (p.op === 'regex' && !validRegex(p.value)),
  ).length;
  const elementProblems = elements.filter((e) => !e.selector.trim()).length;
  const problems =
    pageProblems +
    elementProblems +
    groupsProblemCount(how) +
    (when.mode === 'every_n_days' && !(when.days >= 1) ? 1 : 0);
  const ended = experiment.status === 'ended';

  const save = () => {
    setSubmitted(true);
    if (problems) return;
    update.mutate({ targeting: next }, { onSuccess: () => setSavedSnapshot(snapshot) });
  };

  const segmentName = (id: string) =>
    segments.data?.find((s) => s.id === id)?.name ?? 'Deleted segment';
  const available = (segments.data ?? []).filter((s) => !segmentIds.includes(s.id));
  const summary = stats.data ? summarize(experiment, stats.data) : null;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {/* WHO */}
        <section className={styles.section} aria-labelledby="who-h">
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <span className={styles.key}>WHO</span>
              <h2 className={styles.title} id="who-h">
                Segment
              </h2>
              <span className={styles.sub}>Traits that stay true across visits</span>
            </div>
            <Link to={`/p/${project.id}/audiences/new`} className={styles.link}>
              Create segment
            </Link>
          </div>
          <div className={styles.row}>
            <span>Visitor is in</span>
            <div className={styles.seg} role="group" aria-label="Segment match">
              {(['any', 'all'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={styles.segButton}
                  aria-pressed={whoMode === m}
                  onClick={() => setWhoMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <span>of</span>
            {segmentIds.length === 0 && <span className={styles.sub}>everyone (no segment)</span>}
            {segmentIds.map((id) => (
              <span key={id} className={styles.chip}>
                {segmentName(id)}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`Remove ${segmentName(id)}`}
                  onClick={() => setSegmentIds((ids) => ids.filter((x) => x !== id))}
                >
                  ×
                </button>
              </span>
            ))}
            {available.length > 0 && (
              <select
                className={styles.select}
                aria-label="Add segment"
                value=""
                onChange={(e) => e.target.value && setSegmentIds((ids) => [...ids, e.target.value])}
              >
                <option value="">+ Segment</option>
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {segments.isSuccess && segments.data.length === 0 && (
              <span className={styles.sub}>No saved segments yet.</span>
            )}
          </div>
        </section>

        {/* WHERE */}
        <section className={styles.section} aria-labelledby="where-h">
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <span className={styles.key}>WHERE</span>
              <h2 className={styles.title} id="where-h">
                Pages
              </h2>
              <span className={styles.sub}>
                Include rules OR together, exclude rules always win
              </span>
            </div>
            <div className={styles.buttons}>
              <button
                type="button"
                className={styles.small}
                onClick={() => setElements((e) => [...e, { selector: '' }])}
              >
                + Element rule
              </button>
              <button
                type="button"
                className={styles.small}
                onClick={() =>
                  setPages((p) => [...p, { kind: 'include', op: 'matches', value: '' }])
                }
              >
                + Rule
              </button>
            </div>
          </div>
          {pages.length === 0 && elements.length === 0 && (
            <span className={styles.sub}>Runs on every page of the site.</span>
          )}
          {pages.map((rule, i) => {
            const label = `Page rule ${i + 1}`;
            const bad =
              submitted && (!rule.value.trim() || (rule.op === 'regex' && !validRegex(rule.value)));
            const set = (patch: Partial<PageRule>) =>
              setPages((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <div key={i} className={`${styles.rule} ${bad ? styles.invalid : ''}`}>
                <select
                  className={`${styles.select} ${styles.io}`}
                  aria-label={`${label} include or exclude`}
                  value={rule.kind}
                  onChange={(e) => set({ kind: e.target.value as PageRule['kind'] })}
                >
                  <option value="include">INCLUDE</option>
                  <option value="exclude">EXCLUDE</option>
                </select>
                <span className={styles.sub}>URL</span>
                <select
                  className={styles.select}
                  aria-label={`${label} operator`}
                  value={rule.op}
                  onChange={(e) => set({ op: e.target.value as UrlRule['op'] })}
                >
                  {URL_OPS.map((o) => (
                    <option key={o.op} value={o.op}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  aria-label={`${label} value`}
                  placeholder={rule.op === 'regex' ? '^/deals/(summer|monsoon)' : '/trips/*'}
                  value={rule.value}
                  onChange={(e) => set({ value: e.target.value })}
                  aria-invalid={bad}
                />
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${label}`}
                  onClick={() => setPages((all) => all.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            );
          })}
          {elements.map((el, i) => {
            const label = `Element rule ${i + 1}`;
            const set = (patch: Partial<ElementRule>) =>
              setElements((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <div
                key={`el-${i}`}
                className={`${styles.rule} ${submitted && !el.selector.trim() ? styles.invalid : ''}`}
              >
                <span className={styles.io}>AND</span>
                <span className={styles.sub}>Element on page exists</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  aria-label={`${label} CSS selector`}
                  placeholder=".book-now-btn"
                  value={el.selector}
                  onChange={(e) => set({ selector: e.target.value })}
                />
                <span className={styles.sub}>wait up to</span>
                <input
                  className={`${styles.input} ${styles.number}`}
                  type="number"
                  min={0}
                  max={10}
                  aria-label={`${label} wait in seconds`}
                  value={(el.timeoutMs ?? 3000) / 1000}
                  onChange={(e) => set({ timeoutMs: Math.round(Number(e.target.value) * 1000) })}
                />
                <span className={styles.sub}>s</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${label}`}
                  onClick={() => setElements((all) => all.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            );
          })}
        </section>

        {/* HOW */}
        <section className={styles.section} aria-labelledby="how-h">
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <span className={styles.key}>HOW</span>
              <h2 className={styles.title} id="how-h">
                Triggers
              </h2>
              <span className={styles.sub}>Conditions in this visit, checked on every page</span>
            </div>
          </div>
          <ConditionBuilder groups={how} onChange={setHow} noun="Trigger" />
        </section>

        {/* WHEN */}
        <section className={styles.section} aria-labelledby="when-h">
          <div className={styles.titleRow}>
            <span className={styles.key}>WHEN</span>
            <h2 className={styles.title} id="when-h">
              Frequency
            </h2>
            <span className={styles.sub}>How often a matched visitor sees the variant</span>
          </div>
          <FrequencyPicker value={when} onChange={setWhen} />
        </section>

        <div className={styles.saveBar}>
          <Button onClick={save} disabled={!dirty || update.isPending || ended}>
            Save targeting
          </Button>
          <span
            role="status"
            className={update.isError || (submitted && problems) ? styles.error : styles.status}
          >
            {update.isError
              ? `Couldn't save: ${update.error.message}`
              : submitted && problems
                ? `${problems} ${problems === 1 ? 'rule needs' : 'rules need'} a value.`
                : savedSnapshot === snapshot
                  ? 'Saved.'
                  : dirty
                    ? 'Unsaved changes'
                    : ''}
          </span>
          {experiment.status === 'live' && dirty && (
            <span className={styles.note}>
              Live: new rules apply from each visitor's next page.
            </span>
          )}
        </div>
      </div>

      <aside className={styles.aside} aria-label="Targeting check">
        <section className={styles.section} aria-labelledby="who-see">
          <span className={styles.lbl} id="who-see">
            Who will see this
          </span>
          <span className={styles.who}>{whoSentence(next, segmentName)}</span>
          {summary && experiment.status !== 'draft' && (
            <span className={styles.sub}>
              <span className={styles.big}>
                {number.format(Math.round(summary.visitorsPerDay))}
              </span>{' '}
              visitors a day entered this test in the last 7 days.
            </span>
          )}
        </section>
        <UrlTester targeting={next} domain={project.mainDomain} />
        <section className={styles.section} aria-labelledby="explain-h">
          <span className={styles.lbl} id="explain-h">
            Segment vs trigger
          </span>
          <span className={styles.explain}>
            <b>Segments</b> remember the visitor (cookie, past sessions, first-touch UTMs).{' '}
            <b>Triggers</b> only read the current visit (URL, screen, dataLayer, JS). Mixing both is
            how you target tricky groups.
          </span>
        </section>
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

function whoSentence(t: StoredTargeting, segmentName: (id: string) => string): string {
  const parts: string[] = [];
  const ids = t.who?.segmentIds ?? [];
  parts.push(
    ids.length
      ? ids.map((id) => segmentName(id)).join(t.who?.mode === 'all' ? ' and ' : ' or ')
      : 'Everyone',
  );
  const include = t.where?.include ?? [];
  const exclude = t.where?.exclude ?? [];
  parts.push(
    include.length ? `on pages ${include.map((r) => r.value).join(' or ')}` : 'on every page',
  );
  if (exclude.length) parts.push(`except ${exclude.map((r) => r.value).join(' or ')}`);
  if (t.where?.elements?.length)
    parts.push(`with ${t.where.elements.map((e) => e.selector).join(' and ')} on the page`);
  if (t.how?.length)
    parts.push(
      `when ${describeGroups(t.how)
        .replace(/\.$/, '')
        .replace(/^./, (c) => c.toLowerCase())}`,
    );
  const freq =
    t.when?.mode === 'once'
      ? 'once'
      : t.when?.mode === 'once_per_session'
        ? 'once per session'
        : t.when?.mode === 'every_n_days'
          ? `every ${t.when.days} days`
          : 'on every page load';
  parts.push(freq);
  return `${parts.join(', ')}.`;
}

function UrlTester({ targeting, domain }: { targeting: StoredTargeting; domain: string }) {
  const [url, setUrl] = useState(`${domain}/`);
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
