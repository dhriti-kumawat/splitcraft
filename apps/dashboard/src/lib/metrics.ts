import type { Metric } from '../data/api';

export const EVENT_KEY = /^[A-Za-z0-9_.:-]{1,100}$/;

/** "Book click" → "book_click". */
export function eventKeyFor(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export const SOURCES: Array<{ id: Metric['source']; label: string; available: boolean }> = [
  { id: 'click', label: 'Click · selector', available: true },
  { id: 'pageview', label: 'Pageview · URL', available: true },
  { id: 'custom_js', label: 'Custom JS', available: true },
  { id: 'datalayer', label: 'dataLayer', available: true },
  { id: 'transaction', label: 'Transaction', available: true },
  { id: 'browsing', label: 'Browsing', available: true },
  { id: 'web_vitals', label: 'Web Vitals', available: true },
];

export const MEASURES: Record<Metric['measure'], { label: string; text: string }> = {
  unique: { label: 'Unique conversions', text: 'Visitors who fired it at least once' },
  total: { label: 'Total conversions', text: 'Events per visitor, every fire counts' },
  sum: { label: 'Sum of value', text: 'Adds value per visitor, capped at p99' },
  value_per_conversion: { label: 'Value per conversion', text: 'Average value when it fires' },
  ctr: { label: 'Click-through rate', text: 'Clicks ÷ visitors who saw it' },
  time_to_click: {
    label: 'Time to first click',
    text: 'Seconds from page load, average per visitor',
  },
};

/** Click trackers only count clicks; value-based measures need events with a value. */
export function measuresFor(source: Metric['source']): Array<Metric['measure']> {
  if (source === 'click') return ['unique', 'total', 'ctr', 'time_to_click'];
  return source === 'pageview'
    ? ['unique', 'total']
    : ['unique', 'total', 'sum', 'value_per_conversion'];
}

export interface Health {
  ok: boolean;
  text: string;
}

/**
 * Static checks for a click selector: parses, and avoids patterns that break when the
 * site redeploys (position selectors, generated class names).
 */
export function selectorHealth(selector: string): Health[] {
  const list = selector
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return [{ ok: false, text: 'Enter at least one CSS selector.' }];
  const checks: Health[] = [];
  try {
    document.createDocumentFragment().querySelector(selector);
    checks.push({ ok: true, text: 'Valid CSS selector' });
  } catch {
    return [{ ok: false, text: 'This is not a valid CSS selector.' }];
  }
  const positional = list.filter((s) =>
    /:(nth-(child|of-type|last-child|last-of-type))|:(first|last)-child/.test(s),
  );
  const generated = list.filter((s) =>
    /\.(css|sc|jsx|emotion)-[a-z0-9]{4,}|\.[a-z]+_[a-z0-9]{5,}__|\.[A-Za-z]+-[a-f0-9]{6,}\b/.test(
      s,
    ),
  );
  const stable = list.filter((s) => /[#.][a-z]|\[data-/i.test(s));
  checks.push(
    positional.length
      ? {
          ok: false,
          text: `Avoid position selectors like :nth-child (${positional.join(', ')}). They break when the layout changes.`,
        }
      : { ok: true, text: 'Does not depend on element position' },
  );
  checks.push(
    generated.length
      ? {
          ok: false,
          text: `Avoid generated class names (${generated.join(', ')}). They change on every deploy.`,
        }
      : { ok: true, text: 'No generated class names' },
  );
  if (stable.length < list.length) {
    checks.push({ ok: false, text: 'Prefer a class, id or data attribute over a bare tag name.' });
  }
  return checks;
}

/** Checks for custom JS tracker code. */
export function trackerChecks(
  code: string,
  eventKey: string,
  syntaxError: string | null,
): Health[] {
  return [
    syntaxError
      ? { ok: false, text: `Syntax error: ${syntaxError}` }
      : { ok: true, text: 'No syntax errors' },
    eventKey && code.includes(eventKey)
      ? { ok: true, text: `Event key ${eventKey} found in the code` }
      : {
          ok: false,
          text: `The code never mentions ${eventKey || 'the event key'}; call splitcraft.trackEvent('${eventKey || 'your_key'}').`,
        },
    /splitcraft\.trackEvent\s*\(/.test(code)
      ? { ok: true, text: 'Calls splitcraft.trackEvent' }
      : { ok: false, text: 'Call splitcraft.trackEvent(key, props) when the action happens.' },
  ];
}

/** The listener Splitcraft runs for a click metric, shown read-only. */
export function clickCode(selector: string, firstPerPage: boolean, key: string): string {
  return [
    '// one listener, works for SPA re-renders',
    "document.addEventListener('click', (e) => {",
    `  if (e.target.closest(${JSON.stringify(selector || '…')})) {`,
    firstPerPage ? '    // counted once per page' : '    // every click counts',
    `    splitcraft.trackEvent(${JSON.stringify(key || '…')});`,
    '  }',
    '}, true);',
  ].join('\n');
}

/** One line describing where a metric comes from and how it is counted. */
export function metricDetail(m: Metric): string {
  const cfg = m.sourceConfig;
  const better = m.measureConfig.direction === 'decrease' ? 'lower is better' : 'higher is better';
  const how = MEASURES[m.measure].label.toLowerCase();
  if (m.source === 'click') return `Click on ${String(cfg.selector ?? '')} · ${how} · ${better}`;
  if (m.source === 'pageview') {
    const url = cfg.url as { op?: string; value?: string } | undefined;
    return `URL ${url?.op ?? ''} ${url?.value ?? ''} · ${how} · ${better}`;
  }
  return `splitcraft.trackEvent('${m.eventKey}') · ${how} · ${better}`;
}

/** Browsing measures: the SDK sends each under a fixed key; each has one natural measure. */
export const BROWSING: Array<{
  kind: 'engaged' | 'pages' | 'time' | 'return';
  label: string;
  text: string;
  key: string;
  measure: Metric['measure'];
}> = [
  {
    kind: 'engaged',
    label: 'Engaged visitors',
    text: "Didn't bounce: a 2nd page, or 10 s on a page",
    key: 'browse.engaged',
    measure: 'unique',
  },
  {
    kind: 'pages',
    label: 'Pages per visitor',
    text: 'Every page view counts',
    key: 'browse.page',
    measure: 'total',
  },
  {
    kind: 'time',
    label: 'Time on site',
    text: 'Seconds pages were visible, per visitor',
    key: 'browse.time',
    measure: 'sum',
  },
  {
    kind: 'return',
    label: 'Returning visitors',
    text: 'Came back for another session',
    key: 'browse.return',
    measure: 'unique',
  },
];

/** Core Web Vitals: average per visitor, lower is better. Usually guardrails. */
export const VITALS: Array<{
  vital: 'lcp' | 'inp' | 'cls';
  label: string;
  text: string;
  key: string;
}> = [
  { vital: 'lcp', label: 'LCP', text: 'Largest Contentful Paint, ms', key: 'vitals.lcp' },
  { vital: 'inp', label: 'INP', text: 'Slowest interaction on the page, ms', key: 'vitals.inp' },
  { vital: 'cls', label: 'CLS', text: 'Cumulative Layout Shift', key: 'vitals.cls' },
];

const up = { direction: 'increase', windowDays: 7 };

/** Common metrics that need no setup form: one click adds them as a goal. */
export const READY_METRICS: Array<{ text: string; metric: Omit<Metric, 'id' | 'projectId'> }> = [
  {
    text: 'Purchase rate, from the purchase event in the dataLayer',
    metric: {
      name: 'Purchase',
      eventKey: 'purchase',
      source: 'transaction',
      sourceConfig: {
        event: 'purchase',
        valuePath: 'ecommerce.value',
        idPath: 'ecommerce.transaction_id',
        currencyPath: 'ecommerce.currency',
      },
      measure: 'unique',
      measureConfig: up,
    },
  },
  {
    text: "Your site calls splitcraft.trackEvent('add_to_cart')",
    metric: {
      name: 'Add to cart',
      eventKey: 'add_to_cart',
      source: 'custom_js',
      sourceConfig: {},
      measure: 'unique',
      measureConfig: up,
    },
  },
  {
    text: "Your site calls splitcraft.trackEvent('sign_up')",
    metric: {
      name: 'Sign-up',
      eventKey: 'sign_up',
      source: 'custom_js',
      sourceConfig: {},
      measure: 'unique',
      measureConfig: up,
    },
  },
  ...BROWSING.filter((b) => b.kind !== 'time').map((b) => ({
    text: b.text,
    metric: {
      name: b.label,
      eventKey: b.key,
      source: 'browsing' as const,
      sourceConfig: { kind: b.kind },
      measure: b.measure,
      measureConfig: up,
    },
  })),
];
