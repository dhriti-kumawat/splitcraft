// Condition catalogue for the builder: the v1 ("bold") conditions from PRODUCT_SPEC §4,
// exactly the ones the SDK evaluates. Also turns rules into plain English.
import type {
  Condition,
  ConditionGroup,
  DeviceType,
  NumberOperator,
  SourceType,
  StringOperator,
  UrlRule,
  UtmParam,
} from './targeting';

export type ConditionType = Condition['type'];

export interface FieldDef {
  type: ConditionType;
  label: string;
  category: string;
  create(): Condition;
}

export const FIELDS: FieldDef[] = [
  {
    type: 'visitor_type',
    label: 'New or returning',
    category: 'Navigation',
    create: () => ({ type: 'visitor_type', value: 'returning' }),
  },
  {
    type: 'session_number',
    label: 'Session number',
    category: 'Navigation',
    create: () => ({ type: 'session_number', op: 'gte', value: 2 }),
  },
  {
    type: 'pages_viewed_session',
    label: 'Pages viewed this visit',
    category: 'Navigation',
    create: () => ({ type: 'pages_viewed_session', op: 'gte', value: 2 }),
  },
  {
    type: 'page_views_matching',
    label: 'Pages viewed matching',
    category: 'Behaviour',
    create: () => ({
      type: 'page_views_matching',
      url: { op: 'matches', value: '/trips/*' },
      count: 3,
      days: 7,
    }),
  },
  {
    type: 'device_type',
    label: 'Device type',
    category: 'Technology',
    create: () => ({ type: 'device_type', value: ['mobile'] }),
  },
  {
    type: 'screen_width',
    label: 'Screen width',
    category: 'Technology',
    create: () => ({ type: 'screen_width', op: 'gte', value: 360 }),
  },
  {
    type: 'country',
    label: 'Country',
    category: 'Location',
    create: () => ({ type: 'country', op: 'is', value: '' }),
  },
  {
    type: 'utm',
    label: 'UTM parameter',
    category: 'Traffic',
    create: () => ({ type: 'utm', param: 'campaign', touch: 'last', op: 'contains', value: '' }),
  },
  {
    type: 'source_type',
    label: 'Source type',
    category: 'Traffic',
    create: () => ({ type: 'source_type', value: ['organic'] }),
  },
  {
    type: 'cookie',
    label: 'Cookie',
    category: 'Expert',
    create: () => ({ type: 'cookie', name: '', op: 'is', value: '' }),
  },
  {
    type: 'data_layer',
    label: 'dataLayer value',
    category: 'Expert',
    create: () => ({ type: 'data_layer', key: '', op: 'is', value: '' }),
  },
  {
    type: 'js_variable',
    label: 'JS variable',
    category: 'Expert',
    create: () => ({ type: 'js_variable', path: '', op: 'is', value: '' }),
  },
  {
    type: 'custom_js',
    label: 'Custom JavaScript',
    category: 'Expert',
    create: () => ({ type: 'custom_js', code: 'return true;' }),
  },
];

export const fieldFor = (type: ConditionType) => FIELDS.find((f) => f.type === type)!;

export const STRING_OPS: Array<{ op: StringOperator; label: string }> = [
  { op: 'is', label: 'is' },
  { op: 'is_not', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'not_contains', label: "doesn't contain" },
  { op: 'starts_with', label: 'starts with' },
  { op: 'ends_with', label: 'ends with' },
  { op: 'regex', label: 'matches regex' },
  { op: 'exists', label: 'exists' },
  { op: 'not_exists', label: "doesn't exist" },
];

export const NUMBER_OPS: Array<{ op: NumberOperator; label: string }> = [
  { op: 'eq', label: 'is' },
  { op: 'neq', label: 'is not' },
  { op: 'gt', label: 'is more than' },
  { op: 'gte', label: 'is at least' },
  { op: 'lt', label: 'is less than' },
  { op: 'lte', label: 'is at most' },
];

export const URL_OPS: Array<{ op: UrlRule['op']; label: string }> = [
  { op: 'is', label: 'is' },
  { op: 'contains', label: 'contains' },
  { op: 'matches', label: 'matches pattern' },
  { op: 'regex', label: 'regex' },
];

export const DEVICES: Array<{ value: DeviceType; label: string }> = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

export const SOURCES: Array<{ value: SourceType; label: string }> = [
  { value: 'direct', label: 'Direct' },
  { value: 'organic', label: 'Organic search' },
  { value: 'paid', label: 'Paid' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'Email' },
  { value: 'referral', label: 'Referral' },
];

export const UTM_PARAMS: UtmParam[] = ['source', 'medium', 'campaign', 'term', 'content'];

export const needsValue = (op: StringOperator) => op !== 'exists' && op !== 'not_exists';

// ------------------------------------------------------------------ plain English

const listText = (items: string[], joiner = 'or') =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`;

const strValue = (v: string | string[] | undefined) =>
  Array.isArray(v) ? listText(v.map((x) => `“${x}”`)) : `“${v ?? ''}”`;

function stringPhrase(
  subject: string,
  op: StringOperator,
  value: string | string[] | undefined,
): string {
  const label = STRING_OPS.find((o) => o.op === op)?.label ?? op;
  return needsValue(op) ? `${subject} ${label} ${strValue(value)}` : `${subject} ${label}`;
}

function numberPhrase(subject: string, op: NumberOperator, value: number, unit = ''): string {
  return `${subject} ${NUMBER_OPS.find((o) => o.op === op)?.label ?? op} ${value}${unit}`;
}

const PAGE_VERB: Record<UrlRule['op'], string> = {
  is: 'at',
  contains: 'containing',
  matches: 'matching',
  regex: 'matching regex',
};

export function describeCondition(c: Condition): string {
  switch (c.type) {
    case 'visitor_type':
      return c.value === 'new' ? 'new visitors' : 'returning visitors';
    case 'session_number':
      return numberPhrase('session number', c.op, c.value);
    case 'pages_viewed_session':
      return numberPhrase('pages viewed this visit', c.op, c.value);
    case 'page_views_matching':
      return `viewed pages ${PAGE_VERB[c.url.op]} ${c.url.value} at least ${c.count} ${c.count === 1 ? 'time' : 'times'} in ${c.days} ${c.days === 1 ? 'day' : 'days'}`;
    case 'device_type':
      return `on ${listText(c.value.map((v) => DEVICES.find((d) => d.value === v)?.label.toLowerCase() ?? v))}`;
    case 'screen_width':
      return numberPhrase('screen width', c.op, c.value, ' px');
    case 'country':
      return stringPhrase('country', c.op, c.value);
    case 'utm':
      return stringPhrase(`${c.touch}-touch utm_${c.param}`, c.op, c.value);
    case 'source_type':
      return `arriving from ${listText(c.value.map((v) => SOURCES.find((s) => s.value === v)?.label.toLowerCase() ?? v))}`;
    case 'cookie':
      return stringPhrase(`cookie ${c.name || '(no name)'}`, c.op, c.value);
    case 'data_layer':
      return stringPhrase(`dataLayer ${c.key || '(no key)'}`, c.op, c.value);
    case 'js_variable':
      return stringPhrase(`window.${c.path || '(no path)'}`, c.op, c.value);
    case 'custom_js':
      return 'custom JavaScript returns true';
  }
}

export function describeGroup(g: ConditionGroup): string {
  const parts = g.items.map((item) =>
    'mode' in item ? `(${describeGroup(item)})` : describeCondition(item),
  );
  if (parts.length === 0) return 'everyone';
  if (g.mode === 'none') return `not ${listText(parts, 'or')}`;
  return listText(parts, g.mode === 'all' ? 'and' : 'or');
}

/** One sentence for a list of top-level groups (ANDed). */
export function describeGroups(groups: ConditionGroup[]): string {
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  if (nonEmpty.length === 0) return 'Everyone.';
  // Later groups with several conditions go in parentheses so their boundaries stay clear.
  const wrap = (g: ConditionGroup, i: number) => {
    const text = describeGroup(g);
    if (i === 0 || g.items.length < 2) return text;
    return g.mode === 'none' ? `not (${text.slice(4)})` : `(${text})`;
  };
  const text = nonEmpty
    .map((g, i) => (i > 0 && g.mode === 'none' ? `but ${wrap(g, i)}` : wrap(g, i)))
    .reduce(
      (acc, part, i) =>
        i === 0 ? part : part.startsWith('but ') ? `${acc} ${part}` : `${acc} and ${part}`,
      '',
    );
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

// ------------------------------------------------------------------ validation

/** Problems that would make a condition match wrongly; empty when it's complete. */
export function conditionProblems(c: Condition): string[] {
  const problems: string[] = [];
  const needs = (ok: boolean, message: string) => !ok && problems.push(message);
  const strOk = (op: StringOperator, v: string | string[] | undefined) =>
    !needsValue(op) || (Array.isArray(v) ? v.length > 0 && v.every(Boolean) : Boolean(v?.trim()));
  switch (c.type) {
    case 'session_number':
    case 'pages_viewed_session':
    case 'screen_width':
      needs(Number.isFinite(c.value), 'Enter a number.');
      break;
    case 'page_views_matching':
      needs(Boolean(c.url.value.trim()), 'Enter a URL rule.');
      needs(c.count >= 1 && c.days >= 1, 'Times and days must be at least 1.');
      break;
    case 'device_type':
    case 'source_type':
      needs(c.value.length > 0, 'Pick at least one.');
      break;
    case 'country':
    case 'utm':
      needs(strOk(c.op, c.value), 'Enter a value.');
      break;
    case 'cookie':
      needs(Boolean(c.name.trim()), 'Enter the cookie name.');
      needs(strOk(c.op, c.value), 'Enter a value.');
      break;
    case 'data_layer':
      needs(Boolean(c.key.trim()), 'Enter the dataLayer key.');
      needs(strOk(c.op, c.value), 'Enter a value.');
      break;
    case 'js_variable':
      needs(Boolean(c.path.trim()), 'Enter the variable path.');
      needs(strOk(c.op, c.value), 'Enter a value.');
      break;
    case 'custom_js':
      needs(Boolean(c.code.trim()), 'Enter the code.');
      break;
  }
  if (c.type !== 'custom_js' && 'op' in c && c.op === 'regex' && typeof c.value === 'string') {
    try {
      new RegExp(c.value);
    } catch {
      problems.push('This regex is not valid.');
    }
  }
  return problems;
}

export function groupsProblemCount(groups: ConditionGroup[]): number {
  const count = (g: ConditionGroup): number =>
    g.items.reduce(
      (n, item) => n + ('mode' in item ? count(item) : conditionProblems(item).length ? 1 : 0),
      0,
    );
  return groups.reduce((n, g) => n + count(g), 0);
}
