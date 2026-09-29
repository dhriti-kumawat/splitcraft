import { useId, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../components/Button';
import { CodeEditor } from '../../components/CodeEditor';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { PageHeader } from '../../components/PageHeader';
import type { Metric } from '../../data/api';
import { useExperimentsQuery, useMetricMutations, useMetricsQuery } from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { URL_OPS } from '../../lib/conditions';
import { syntaxError } from '../../lib/launch';
import {
  BROWSING,
  clickCode,
  EVENT_KEY,
  eventKeyFor,
  MEASURES,
  measuresFor,
  selectorHealth,
  SOURCES,
  trackerChecks,
  VITALS,
  type Health,
} from '../../lib/metrics';
import type { UrlRule } from '../../lib/targeting';
import styles from './MetricEditor.module.css';

const PARAM_SOURCE: Record<string, Metric['source']> = {
  click: 'click',
  pageview: 'pageview',
  'custom-js': 'custom_js',
  datalayer: 'datalayer',
  transaction: 'transaction',
  browsing: 'browsing',
  'web-vitals': 'web_vitals',
};

type Filter = { path: string; op: 'is' | 'is_not' | 'contains' | 'exists'; value: string };
const FILTER_OPS: Array<{ op: Filter['op']; label: string }> = [
  { op: 'is', label: 'is' },
  { op: 'is_not', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'exists', label: 'is set' },
];
const TX_DEFAULTS = {
  event: 'purchase',
  valuePath: 'ecommerce.value',
  idPath: 'ecommerce.transaction_id',
  currencyPath: 'ecommerce.currency',
};
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

const TRACKER_TEMPLATE = (key: string) => `// Fires when a visitor does the thing you want to count.
splitcraft.waitForElement('.your-element', (el) => {
  el.addEventListener('change', () => {
    splitcraft.trackEvent('${key || 'your_event'}', {
      // value: 49.5,   // optional: a number to sum or average
    });
  });
});
`;

/** New or edit metric: click tracker (21), custom JS tracker (22), or pageview. */
export function MetricEditor() {
  const project = useCurrentProject()!;
  const { metricId } = useParams();
  const [params] = useSearchParams();
  const metrics = useMetricsQuery(project.id);
  const existing = metrics.data?.find((m) => m.id === metricId);

  if (metricId && metrics.isPending) return <p aria-busy="true">Loading metric…</p>;
  if (metricId && !existing) return <p>This metric doesn't exist.</p>;
  const source = existing?.source ?? PARAM_SOURCE[params.get('source') ?? 'click'] ?? 'click';
  return (
    <Form
      key={existing?.id ?? source}
      projectId={project.id}
      metric={existing}
      initialSource={source}
    />
  );
}

function Form({
  projectId,
  metric,
  initialSource,
}: {
  projectId: string;
  metric?: Metric;
  initialSource: Metric['source'];
}) {
  const navigate = useNavigate();
  const { create, update, remove } = useMetricMutations(projectId);
  const experiments = useExperimentsQuery(projectId);
  const cfg = metric?.sourceConfig ?? {};
  const [source, setSource] = useState<Metric['source']>(initialSource);
  const [name, setName] = useState(metric?.name ?? '');
  const [eventKey, setEventKey] = useState(metric?.eventKey ?? '');
  const [keyEdited, setKeyEdited] = useState(Boolean(metric));
  const [selector, setSelector] = useState(typeof cfg.selector === 'string' ? cfg.selector : '');
  const [firstPerPage, setFirstPerPage] = useState(cfg.firstPerPage === true);
  const [url, setUrl] = useState<UrlRule>(
    (cfg.url as UrlRule | undefined) ?? { op: 'is', value: '' },
  );
  const [code, setCode] = useState(typeof cfg.code === 'string' ? cfg.code : '');
  const [pages, setPages] = useState<UrlRule[]>(
    Array.isArray(cfg.pages) ? (cfg.pages as UrlRule[]) : [],
  );
  const [dlEvent, setDlEvent] = useState(str(cfg.event));
  const [filters, setFilters] = useState<Filter[]>(
    Array.isArray(cfg.filters) ? (cfg.filters as Filter[]) : [],
  );
  const [valuePath, setValuePath] = useState(
    str(cfg.valuePath, initialSource === 'transaction' ? TX_DEFAULTS.valuePath : ''),
  );
  const [tx, setTx] = useState({
    event: str(cfg.event, TX_DEFAULTS.event),
    idPath: str(cfg.idPath, TX_DEFAULTS.idPath),
    currencyPath: str(cfg.currencyPath, TX_DEFAULTS.currencyPath),
  });
  const [browseKind, setBrowseKind] = useState<(typeof BROWSING)[number]['kind']>(
    (str(cfg.kind) as (typeof BROWSING)[number]['kind']) || 'engaged',
  );
  const [vital, setVital] = useState<(typeof VITALS)[number]['vital']>(
    (str(cfg.vital) as (typeof VITALS)[number]['vital']) || 'lcp',
  );
  const browse = BROWSING.find((b) => b.kind === browseKind)!;
  const vitalInfo = VITALS.find((v) => v.vital === vital)!;
  const [measure, setMeasure] = useState<Metric['measure']>(metric?.measure ?? 'unique');
  const [direction, setDirection] = useState<'increase' | 'decrease'>(
    metric?.measureConfig.direction === 'decrease' || (!metric && initialSource === 'web_vitals')
      ? 'decrease'
      : 'increase',
  );
  const [windowDays, setWindowDays] = useState(String(metric?.measureConfig.windowDays ?? 7));
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = { name: useId(), key: useId(), selector: useId(), url: useId(), window: useId() };

  // Browsing and Web Vitals use the SDK's fixed keys.
  const fixedKey =
    source === 'browsing' ? browse.key : source === 'web_vitals' ? vitalInfo.key : null;
  const key = fixedKey ?? (keyEdited ? eventKey : eventKeyFor(name));
  // Parsing is cheap, so check on every change; save never waits on a stale result.
  const jsError = useMemo(() => syntaxError(code), [code]);

  const allowed: Array<Metric['measure']> =
    source === 'browsing'
      ? [browse.measure]
      : source === 'web_vitals'
        ? ['value_per_conversion']
        : measuresFor(source);
  const measureNow = allowed.includes(measure) ? measure : allowed[0]!;
  const errors = {
    name: name.trim() ? '' : 'Name the metric.',
    key: EVENT_KEY.test(key) ? '' : 'Use letters, numbers, _ . : or - (up to 100).',
    selector:
      source === 'click' && selectorHealth(selector)[0]?.ok === false
        ? selectorHealth(selector)[0]!.text
        : '',
    url: source === 'pageview' && !url.value.trim() ? 'Enter the page URL rule.' : '',
    code:
      source === 'custom_js' && (!code.trim() || jsError)
        ? jsError
          ? `Fix the syntax error: ${jsError}`
          : 'Write the tracker code.'
        : '',
    event:
      (source === 'datalayer' && !dlEvent.trim()) || (source === 'transaction' && !tx.event.trim())
        ? 'Enter the dataLayer event name.'
        : '',
    window: Number(windowDays) >= 1 && Number(windowDays) <= 90 ? '' : 'Between 1 and 90 days.',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => submitted && Boolean(errors[k]);
  const primaryOf = (experiments.data ?? []).filter(
    (e) => metric && e.primaryMetricId === metric.id,
  );

  const sourceConfig =
    source === 'click'
      ? {
          selector: selector.trim(),
          ...(firstPerPage && { firstPerPage: true }),
          // Tell the SDK what the measure needs: element views, or first-click timing.
          ...(measureNow === 'ctr' && { views: true }),
          ...(measureNow === 'time_to_click' && { timing: true }),
        }
      : source === 'pageview'
        ? { url: { op: url.op, value: url.value.trim() } }
        : source === 'datalayer'
          ? {
              event: dlEvent.trim(),
              ...(filters.filter((f) => f.path.trim()).length && {
                filters: filters
                  .filter((f) => f.path.trim())
                  .map((f) => ({
                    path: f.path.trim(),
                    op: f.op,
                    ...(f.op !== 'exists' && { value: f.value }),
                  })),
              }),
              ...(valuePath.trim() && { valuePath: valuePath.trim() }),
            }
          : source === 'browsing'
            ? { kind: browseKind }
            : source === 'web_vitals'
              ? { vital }
              : source === 'transaction'
                ? {
                    event: tx.event.trim(),
                    valuePath: valuePath.trim() || TX_DEFAULTS.valuePath,
                    idPath: tx.idPath.trim() || TX_DEFAULTS.idPath,
                    currencyPath: tx.currencyPath.trim() || TX_DEFAULTS.currencyPath,
                  }
                : {
                    code,
                    ...(pages.filter((p) => p.value.trim()).length && {
                      pages: pages.filter((p) => p.value.trim()),
                    }),
                  };

  const save = () => {
    setSubmitted(true);
    if (hasErrors) return;
    const body = {
      name: name.trim(),
      eventKey: key,
      source,
      sourceConfig,
      measure: measureNow,
      measureConfig: { direction, windowDays: Number(windowDays) },
    };
    if (metric) {
      update.mutate({ id: metric.id, patch: body });
    } else {
      create.mutate(
        { projectId, ...body },
        { onSuccess: (m) => navigate(`/p/${projectId}/metrics/${m.id}`, { replace: true }) },
      );
    }
  };
  const failed = create.error ?? update.error ?? remove.error;

  const health: Health[] =
    source === 'click'
      ? selectorHealth(selector)
      : source === 'custom_js'
        ? trackerChecks(code, key, jsError)
        : [
            {
              ok: Boolean(url.value.trim()),
              text: url.value.trim()
                ? `Counts views of pages where the URL ${URL_OPS.find((o) => o.op === url.op)?.label} ${url.value}`
                : 'Enter the page URL rule.',
            },
          ];

  return (
    <>
      <PageHeader
        title={metric ? metric.name : 'New metric'}
        description="Pick where the event comes from, then how to measure it."
      />
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="source-h">
            <span className={styles.lbl} id="source-h">
              1 · Event source
            </span>
            <div className={styles.sources} role="radiogroup" aria-labelledby="source-h">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={source === s.id}
                  className={styles.source}
                  disabled={!s.available || (Boolean(metric) && s.id !== source)}
                  title={s.available ? undefined : "Coming later: the SDK doesn't collect this yet"}
                  onClick={() => setSource(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor={ids.name} className={styles.label}>
                  Name
                </label>
                <input
                  id={ids.name}
                  className={styles.input}
                  value={name}
                  placeholder={
                    source === 'click'
                      ? 'Book click'
                      : source === 'pageview'
                        ? 'Confirmation page'
                        : source === 'transaction'
                          ? 'Purchase'
                          : source === 'datalayer'
                            ? 'Added to cart'
                            : source === 'browsing'
                              ? browse.label
                              : source === 'web_vitals'
                                ? `${vitalInfo.label} (${vitalInfo.text.split(',')[0]})`
                                : 'Add-on selected'
                  }
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={show('name')}
                  aria-describedby={show('name') ? `${ids.name}-e` : undefined}
                />
                {show('name') && (
                  <span id={`${ids.name}-e`} className={styles.error}>
                    {errors.name}
                  </span>
                )}
              </div>
              <div className={styles.field}>
                <label htmlFor={ids.key} className={styles.label}>
                  Event key{' '}
                  <span className={styles.hint}>
                    ·{' '}
                    {fixedKey
                      ? 'set by the SDK'
                      : source === 'custom_js'
                        ? 'must match your code'
                        : keyEdited
                          ? 'custom'
                          : 'auto'}
                  </span>
                </label>
                <input
                  id={ids.key}
                  className={`${styles.input} ${styles.mono}`}
                  value={key}
                  readOnly={fixedKey !== null}
                  onChange={(e) => {
                    setKeyEdited(true);
                    setEventKey(e.target.value);
                  }}
                  aria-invalid={show('key')}
                  aria-describedby={show('key') ? `${ids.key}-e` : undefined}
                />
                {show('key') && (
                  <span id={`${ids.key}-e`} className={styles.error}>
                    {errors.key}
                  </span>
                )}
              </div>
            </div>

            {source === 'click' && (
              <>
                <div className={styles.field}>
                  <label htmlFor={ids.selector} className={styles.label}>
                    CSS selector <span className={styles.hint}>· comma = any of these</span>
                  </label>
                  <input
                    id={ids.selector}
                    className={`${styles.input} ${styles.mono}`}
                    value={selector}
                    placeholder='.book-now-btn, [data-cta="book"]'
                    onChange={(e) => setSelector(e.target.value)}
                    aria-invalid={show('selector')}
                    aria-describedby={show('selector') ? `${ids.selector}-e` : undefined}
                  />
                  {show('selector') && (
                    <span id={`${ids.selector}-e`} className={styles.error}>
                      {errors.selector}
                    </span>
                  )}
                </div>
                <div className={styles.options}>
                  <span className={styles.label}>Count</span>
                  <div role="radiogroup" aria-label="Count" className={styles.options}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!firstPerPage}
                      className={styles.opt}
                      onClick={() => setFirstPerPage(false)}
                    >
                      Every click
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={firstPerPage}
                      className={styles.opt}
                      onClick={() => setFirstPerPage(true)}
                    >
                      First click per page
                    </button>
                  </div>
                  <span className={styles.label}>Always</span>
                  <span className={styles.fact}>Keyboard Enter</span>
                  <span className={styles.fact}>Elements added later (SPA)</span>
                </div>
              </>
            )}

            {source === 'pageview' && (
              <div className={styles.pageRule}>
                <span className={styles.label}>URL</span>
                <select
                  className={styles.select}
                  aria-label="URL operator"
                  value={url.op}
                  onChange={(e) => setUrl({ ...url, op: e.target.value as UrlRule['op'] })}
                >
                  {URL_OPS.map((o) => (
                    <option key={o.op} value={o.op}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  id={ids.url}
                  className={`${styles.input} ${styles.mono}`}
                  aria-label="URL"
                  placeholder="/checkout/done"
                  value={url.value}
                  onChange={(e) => setUrl({ ...url, value: e.target.value })}
                  aria-invalid={show('url')}
                />
                {show('url') && <span className={styles.error}>{errors.url}</span>}
              </div>
            )}

            {source === 'datalayer' && (
              <>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label htmlFor={`${ids.url}-ev`} className={styles.label}>
                      dataLayer event
                    </label>
                    <input
                      id={`${ids.url}-ev`}
                      className={`${styles.input} ${styles.mono}`}
                      value={dlEvent}
                      placeholder="add_to_cart"
                      onChange={(e) => setDlEvent(e.target.value)}
                      aria-invalid={show('event')}
                      aria-describedby={show('event') ? `${ids.url}-ev-e` : undefined}
                    />
                    {show('event') && (
                      <span id={`${ids.url}-ev-e`} className={styles.error}>
                        {errors.event}
                      </span>
                    )}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`${ids.url}-val`} className={styles.label}>
                      Value path <span className={styles.hint}>· optional</span>
                    </label>
                    <input
                      id={`${ids.url}-val`}
                      className={`${styles.input} ${styles.mono}`}
                      value={valuePath}
                      placeholder="ecommerce.value"
                      onChange={(e) => setValuePath(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>
                    Only when <span className={styles.hint}>· all must match</span>
                  </span>
                  {filters.map((f, i) => {
                    const set = (patch: Partial<Filter>) =>
                      setFilters((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={i} className={styles.pageRule}>
                        <input
                          className={`${styles.input} ${styles.mono}`}
                          aria-label={`Filter ${i + 1} property`}
                          placeholder="ecommerce.currency"
                          value={f.path}
                          onChange={(e) => set({ path: e.target.value })}
                        />
                        <select
                          className={styles.select}
                          aria-label={`Filter ${i + 1} operator`}
                          value={f.op}
                          onChange={(e) => set({ op: e.target.value as Filter['op'] })}
                        >
                          {FILTER_OPS.map((o) => (
                            <option key={o.op} value={o.op}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {f.op !== 'exists' && (
                          <input
                            className={`${styles.input} ${styles.mono}`}
                            aria-label={`Filter ${i + 1} value`}
                            placeholder="INR"
                            value={f.value}
                            onChange={(e) => set({ value: e.target.value })}
                          />
                        )}
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`Remove filter ${i + 1}`}
                          onClick={() => setFilters((all) => all.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <div>
                    <button
                      type="button"
                      className={styles.small}
                      onClick={() =>
                        setFilters((all) => [...all, { path: '', op: 'is', value: '' }])
                      }
                    >
                      + Filter
                    </button>
                  </div>
                </div>
                <p className={styles.note}>
                  Counts{' '}
                  <span className="mono">
                    dataLayer.push(&#123; event: &apos;{dlEvent || 'add_to_cart'}&apos; &#125;)
                  </span>{' '}
                  on any page, including pushes from GTM or your own code.
                </p>
              </>
            )}

            {source === 'transaction' && (
              <>
                <div className={styles.row}>
                  {(
                    [
                      [
                        'event',
                        'Purchase event',
                        tx.event,
                        (v: string) => setTx({ ...tx, event: v }),
                      ],
                      ['value', 'Value path', valuePath, setValuePath],
                      [
                        'id',
                        'Transaction id path',
                        tx.idPath,
                        (v: string) => setTx({ ...tx, idPath: v }),
                      ],
                      [
                        'currency',
                        'Currency path',
                        tx.currencyPath,
                        (v: string) => setTx({ ...tx, currencyPath: v }),
                      ],
                    ] as const
                  ).map(([id, label, value, set]) => (
                    <div key={id} className={styles.field}>
                      <label htmlFor={`${ids.url}-tx-${id}`} className={styles.label}>
                        {label}
                      </label>
                      <input
                        id={`${ids.url}-tx-${id}`}
                        className={`${styles.input} ${styles.mono}`}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        aria-invalid={id === 'event' && show('event')}
                      />
                    </div>
                  ))}
                </div>
                {show('event') && <span className={styles.error}>{errors.event}</span>}
                <p className={styles.note}>
                  Reads the GA4 ecommerce <span className="mono">purchase</span> event by default.
                  Each transaction id counts once, even if the thank-you page reloads.
                </p>
              </>
            )}

            {(source === 'browsing' || source === 'web_vitals') && (
              <div className={styles.field}>
                <span className={styles.label} id="measure-kind">
                  {source === 'browsing' ? 'What to measure' : 'Vital'}
                </span>
                <div className={styles.measures} role="radiogroup" aria-labelledby="measure-kind">
                  {(source === 'browsing'
                    ? BROWSING.map((b) => ({ id: b.kind, label: b.label, text: b.text }))
                    : VITALS.map((v) => ({ id: v.vital, label: v.label, text: v.text }))
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={(source === 'browsing' ? browseKind : vital) === o.id}
                      className={styles.measure}
                      onClick={() =>
                        source === 'browsing'
                          ? setBrowseKind(o.id as typeof browseKind)
                          : setVital(o.id as typeof vital)
                      }
                    >
                      <span className={styles.measureTitle}>{o.label}</span>
                      <span className={styles.measureText}>{o.text}</span>
                    </button>
                  ))}
                </div>
                <p className={styles.note}>
                  {source === 'browsing'
                    ? 'Sent by the SDK on every page while an experiment uses it, so it adds events to your monthly allowance.'
                    : 'Measured in the browser for each page load and sent when the page is hidden. Averaged per visitor; lower is better. Best as a guardrail.'}
                </p>
              </div>
            )}

            {source === 'custom_js' && (
              <>
                <div className={styles.field}>
                  <span className={styles.label}>
                    Runs on pages <span className={styles.hint}>· none = every page</span>
                  </span>
                  {pages.map((p, i) => (
                    <div key={i} className={styles.pageRule}>
                      <select
                        className={styles.select}
                        aria-label={`Page ${i + 1} operator`}
                        value={p.op}
                        onChange={(e) =>
                          setPages((all) =>
                            all.map((x, j) =>
                              j === i ? { ...x, op: e.target.value as UrlRule['op'] } : x,
                            ),
                          )
                        }
                      >
                        {URL_OPS.map((o) => (
                          <option key={o.op} value={o.op}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className={`${styles.input} ${styles.mono}`}
                        aria-label={`Page ${i + 1} URL`}
                        value={p.value}
                        placeholder="/trips/*"
                        onChange={(e) =>
                          setPages((all) =>
                            all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`Remove page ${i + 1}`}
                        onClick={() => setPages((all) => all.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className={styles.small}
                      onClick={() => setPages((all) => [...all, { op: 'matches', value: '' }])}
                    >
                      + Page
                    </button>
                  </div>
                </div>
                <div>
                  <div className={styles.codeHead}>
                    <span>tracker.js</span>
                    <span>
                      Runs once per page · sandboxed try/catch{' '}
                      {!code.trim() && (
                        <button
                          type="button"
                          className={styles.small}
                          onClick={() => setCode(TRACKER_TEMPLATE(key))}
                        >
                          Insert snippet
                        </button>
                      )}
                    </span>
                  </div>
                  <div className={styles.editor}>
                    <CodeEditor
                      language="javascript"
                      label="Tracker code"
                      value={code}
                      onChange={setCode}
                      onSave={save}
                    />
                  </div>
                  {show('code') && <span className={styles.error}>{errors.code}</span>}
                </div>
              </>
            )}
          </section>

          <section className={styles.section} aria-labelledby="measure-h">
            <span className={styles.lbl} id="measure-h">
              2 · Measure as
            </span>
            <div className={styles.measures} role="radiogroup" aria-labelledby="measure-h">
              {allowed.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={measureNow === m}
                  className={styles.measure}
                  onClick={() => {
                    setMeasure(m);
                    // Faster is better for time to first click.
                    if (m === 'time_to_click') setDirection('decrease');
                    else if (measureNow === 'time_to_click') setDirection('increase');
                  }}
                >
                  <span className={styles.measureTitle}>{MEASURES[m].label}</span>
                  <span className={styles.measureText}>{MEASURES[m].text}</span>
                </button>
              ))}
            </div>
            <div className={styles.options}>
              <span className={styles.label}>Winning direction</span>
              <div role="radiogroup" aria-label="Winning direction" className={styles.options}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={direction === 'increase'}
                  className={styles.opt}
                  onClick={() => setDirection('increase')}
                >
                  Increase ↑
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={direction === 'decrease'}
                  className={styles.opt}
                  onClick={() => setDirection('decrease')}
                >
                  Decrease ↓
                </button>
              </div>
              <label htmlFor={ids.window} className={styles.label}>
                Count within
              </label>
              <input
                id={ids.window}
                className={`${styles.input} ${styles.mono}`}
                style={{ width: 70 }}
                type="number"
                min={1}
                max={90}
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                aria-invalid={show('window')}
              />
              <span>days of exposure</span>
              {show('window') && <span className={styles.error}>{errors.window}</span>}
            </div>
          </section>

          <div className={styles.actions}>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {metric ? 'Save metric' : 'Create metric'}
            </Button>
            <span
              role="status"
              className={failed || (submitted && hasErrors) ? styles.error : styles.status}
            >
              {failed
                ? failed.message
                : submitted && hasErrors
                  ? 'Fix the highlighted fields.'
                  : update.isSuccess
                    ? 'Saved.'
                    : ''}
            </span>
            {metric && (
              <button
                type="button"
                className={styles.danger}
                onClick={() => setConfirmDelete(true)}
              >
                Delete metric
              </button>
            )}
          </div>
        </div>

        <aside className={styles.aside} aria-label="Checks">
          <section className={styles.section} aria-labelledby="checks-h">
            <span className={styles.lbl} id="checks-h">
              {source === 'click' ? 'Selector health' : 'Checks'}
            </span>
            <ul className={styles.checks}>
              {health.map((h, i) => (
                <li key={i}>
                  <span className={h.ok ? styles.ok : styles.warn} aria-hidden="true">
                    {h.ok ? '✓' : '!'}
                  </span>
                  <span>
                    {h.text}
                    <span className="visually-hidden">{h.ok ? ' (passes)' : ' (warning)'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {source === 'click' && (
            <section className={styles.section} aria-labelledby="code-h">
              <span className={styles.lbl} id="code-h">
                Code Splitcraft runs · read-only
              </span>
              <pre className={styles.pre}>{clickCode(selector.trim(), firstPerPage, key)}</pre>
            </section>
          )}
        </aside>
      </div>

      {confirmDelete && metric && (
        <Dialog
          title={`Delete “${metric.name}”?`}
          description={
            primaryOf.length
              ? `It is the primary goal of ${primaryOf.map((e) => e.name).join(', ')}. Those experiments will have no primary goal. Collected events stay.`
              : 'Collected events stay; the metric stops being tracked.'
          }
          onClose={() => setConfirmDelete(false)}
        >
          <div className={dialogStyles.foot}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep metric
            </Button>
            <Button
              onClick={() =>
                remove.mutate(metric.id, {
                  onSuccess: () => navigate(`/p/${projectId}/metrics`, { replace: true }),
                })
              }
            >
              Delete metric
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
