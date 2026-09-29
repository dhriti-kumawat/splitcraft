// Reach estimates (PRODUCT_SPEC §4): run targeting rules over a sample of recent sessions.
//
// Each session is one SDK ping with the traits it can check without the page: device,
// screen width, source, session number, UTMs (and country once the config provides it).
// Rules that need the live page (cookies, dataLayer, JS, page history, pages this visit,
// elements) can't be judged from a ping, so the answer is three-valued: match, no match,
// or unknown. Reach is then a range, from sessions that surely match to those that might.

import type { SessionPing } from '../data/api';
import { matchNumber, matchString } from '../../../../packages/sdk/src/targeting/match';
import { matchWhereUrl } from '../../../../packages/sdk/src/targeting';
import type { Condition, ConditionGroup, StoredTargeting } from './targeting';

type Maybe = boolean | null;

export interface Range {
  /** Share of sessions that surely match (0–1). */
  low: number;
  /** Share that match or might (0–1). */
  high: number;
}

export function evaluateCondition(c: Condition, s: SessionPing): Maybe {
  const p = s.props;
  switch (c.type) {
    case 'visitor_type':
      return (p.n === 1) === (c.value === 'new');
    case 'session_number':
      return matchNumber(p.n, c);
    case 'device_type':
      return c.value.includes(p.d);
    case 'screen_width':
      return matchNumber(p.w, c);
    case 'source_type':
      return c.value.includes(p.s);
    case 'utm':
      return matchString((c.touch === 'first' ? p.uf : p.ul)?.[c.param], c);
    case 'country':
      return p.c === undefined ? null : matchString(p.c, c);
    default:
      return null;
  }
}

export function evaluateGroup(group: ConditionGroup, s: SessionPing): Maybe {
  const results = group.items.map((item) =>
    'mode' in item ? evaluateGroup(item, s) : evaluateCondition(item, s),
  );
  if (group.mode === 'all') return and(results);
  const any = or(results);
  return group.mode === 'any' ? any : any === null ? null : !any;
}

function and(results: Maybe[]): Maybe {
  if (results.includes(false)) return false;
  return results.includes(null) ? null : true;
}

function or(results: Maybe[]): Maybe {
  if (results.includes(true)) return true;
  return results.includes(null) ? null : false;
}

/** Every part of an experiment's targeting except frequency (WHEN limits repeats, not who). */
export function evaluateTargeting(
  t: StoredTargeting,
  segments: Record<string, ConditionGroup>,
  s: SessionPing,
): Maybe {
  const parts: Maybe[] = [];
  if (t.who?.segmentIds.length) {
    const each = t.who.segmentIds.map((id) =>
      segments[id] ? evaluateGroup(segments[id], s) : false,
    );
    parts.push(t.who.mode === 'any' ? or(each) : and(each));
  }
  if (t.where) {
    // Judged on the page the session started on; element rules need the live page.
    const url = matchWhereUrl(s.url, { ...t.where, elements: undefined });
    parts.push(url && t.where.elements?.length ? null : url);
  }
  for (const g of t.how ?? []) parts.push(evaluateGroup(g, s));
  return and(parts);
}

export function share(sample: SessionPing[], test: (s: SessionPing) => Maybe): Range | null {
  if (!sample.length) return null;
  let sure = 0;
  let maybe = 0;
  for (const s of sample) {
    const r = test(s);
    if (r === true) sure++;
    else if (r === null) maybe++;
  }
  return { low: sure / sample.length, high: (sure + maybe) / sample.length };
}

/** "18%" or "12–18%". */
export function formatRange(r: Range): string {
  const pct = (x: number) => `${x < 0.1 && x > 0 ? (x * 100).toFixed(1) : Math.round(x * 100)}%`;
  return Math.abs(r.high - r.low) < 0.005 ? pct(r.low) : `${pct(r.low)}–${pct(r.high)}`;
}
