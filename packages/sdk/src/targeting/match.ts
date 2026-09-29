import type { NumberMatch, StringMatch, UrlRule } from './types';

export function matchString(actual: string | undefined, m: StringMatch): boolean {
  const present = actual !== undefined && actual !== '';
  if (m.op === 'exists') return present;
  if (m.op === 'not_exists') return !present;

  const values = m.value === undefined ? [] : Array.isArray(m.value) ? m.value : [m.value];
  const negative = m.op === 'is_not' || m.op === 'not_contains';
  if (actual === undefined) return negative;

  if (m.op === 'regex') return values.some((v) => safeRegex(v)?.test(actual) ?? false);

  const a = actual.toLowerCase();
  const test = (v: string): boolean => {
    const b = v.toLowerCase();
    switch (m.op) {
      case 'is':
      case 'is_not':
        return a === b;
      case 'contains':
      case 'not_contains':
        return a.includes(b);
      case 'starts_with':
        return a.startsWith(b);
      case 'ends_with':
        return a.endsWith(b);
      default:
        return false;
    }
  };
  return negative ? !values.some(test) : values.some(test);
}

export function matchNumber(actual: number | undefined, m: NumberMatch): boolean {
  if (actual === undefined || !Number.isFinite(actual) || !Number.isFinite(m.value)) return false;
  switch (m.op) {
    case 'eq':
      return actual === m.value;
    case 'neq':
      return actual !== m.value;
    case 'gt':
      return actual > m.value;
    case 'gte':
      return actual >= m.value;
    case 'lt':
      return actual < m.value;
    case 'lte':
      return actual <= m.value;
    default:
      return false;
  }
}

export function matchUrl(url: string, rule: UrlRule): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const full = u.origin + u.pathname + u.search;

  if (rule.op === 'contains') return full.includes(rule.value);
  if (rule.op === 'regex') return safeRegex(rule.value)?.test(full) ?? false;

  const pathOnly = rule.value.startsWith('/');
  const withQuery = rule.value.includes('?');
  const subject = (pathOnly ? '' : u.origin) + u.pathname + (withQuery ? u.search : '');

  if (rule.op === 'is') return trimSlash(subject) === trimSlash(normalise(rule.value, pathOnly));
  if (rule.op === 'matches') return globToRegex(normalise(rule.value, pathOnly)).test(subject);
  return false;
}

/** Lower-case the origin of an absolute rule value so it compares with `URL.origin`. */
function normalise(value: string, pathOnly: boolean): string {
  if (pathOnly) return value;
  try {
    const u = new URL(value);
    return u.origin + u.pathname + u.search;
  } catch {
    return value;
  }
}

function trimSlash(s: string): string {
  return s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s;
}

function globToRegex(glob: string): RegExp {
  const body = trimSlash(glob)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}/?$`);
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}
