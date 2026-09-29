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
  { id: 'datalayer', label: 'dataLayer', available: false },
  { id: 'transaction', label: 'Transaction', available: false },
];

export const MEASURES: Record<Metric['measure'], { label: string; text: string }> = {
  unique: { label: 'Unique conversions', text: 'Visitors who fired it at least once' },
  total: { label: 'Total conversions', text: 'Events per visitor, every fire counts' },
  sum: { label: 'Sum of value', text: 'Adds value per visitor, capped at p99' },
  value_per_conversion: { label: 'Value per conversion', text: 'Average value when it fires' },
};

/** Click trackers only count clicks; value-based measures need events with a value. */
export function measuresFor(source: Metric['source']): Array<Metric['measure']> {
  return source === 'click' || source === 'pageview'
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
          text: `The code never mentions ${eventKey || 'the event key'}; call splitly.trackEvent('${eventKey || 'your_key'}').`,
        },
    /splitly\.trackEvent\s*\(/.test(code)
      ? { ok: true, text: 'Calls splitly.trackEvent' }
      : { ok: false, text: 'Call splitly.trackEvent(key, props) when the action happens.' },
  ];
}

/** The listener Splitly runs for a click metric, shown read-only. */
export function clickCode(selector: string, firstPerPage: boolean, key: string): string {
  return [
    '// one listener, works for SPA re-renders',
    "document.addEventListener('click', (e) => {",
    `  if (e.target.closest(${JSON.stringify(selector || '…')})) {`,
    firstPerPage ? '    // counted once per page' : '    // every click counts',
    `    splitly.trackEvent(${JSON.stringify(key || '…')});`,
    '  }',
    '}, true);',
  ].join('\n');
}
