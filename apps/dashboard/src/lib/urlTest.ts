import { matchUrl } from '../../../../packages/sdk/src/targeting/match';
import type { StoredTargeting } from './targeting';

export interface UrlTestLine {
  ok: boolean | null;
  text: string;
}

/**
 * Check a URL against an experiment's WHERE URL rules with the SDK's own matcher.
 * Rules that need the live page (elements, visitor, session) are listed as checked on the site.
 */
export function testUrl(
  input: string,
  t: StoredTargeting,
): { valid: boolean; lines: UrlTestLine[]; matches: boolean } {
  const raw = input.trim();
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    new URL(url);
  } catch {
    return { valid: false, lines: [], matches: false };
  }
  const lines: UrlTestLine[] = [];
  const include = t.where?.include ?? [];
  const exclude = t.where?.exclude ?? [];
  const excludedBy = exclude.find((r) => matchUrl(url, r));
  const includedBy = include.find((r) => matchUrl(url, r));

  if (excludedBy)
    lines.push({ ok: false, text: `Excluded by ${excludedBy.op} ${excludedBy.value}` });
  else if (include.length === 0) lines.push({ ok: true, text: 'Where: every page' });
  else if (includedBy)
    lines.push({ ok: true, text: `Where: ${includedBy.op} ${includedBy.value}` });
  else
    lines.push({
      ok: false,
      text: `Where: matches none of ${include.length} include ${include.length === 1 ? 'rule' : 'rules'}`,
    });

  for (const el of t.where?.elements ?? []) {
    lines.push({
      ok: null,
      text: `Element ${el.selector} is checked on the page (waits up to ${(el.timeoutMs ?? 3000) / 1000} s)`,
    });
  }
  if (t.who?.segmentIds.length)
    lines.push({ ok: null, text: 'Segments are checked against the visitor on the site' });
  if (t.how?.some((g) => g.items.length))
    lines.push({ ok: null, text: 'Triggers are checked in the visit on the site' });

  return {
    valid: true,
    lines,
    matches: !excludedBy && (include.length === 0 || Boolean(includedBy)),
  };
}
