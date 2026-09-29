import { getPath } from '../targeting/conditions';
import { matchString } from '../targeting/match';
import type { StringMatch } from '../targeting/types';

/** A dataLayer event as a goal: event name, optional property filters and value. */
export interface DataLayerGoal {
  key: string;
  /** `event` of the dataLayer entry, e.g. "add_to_cart". */
  event: string;
  /** All must match, e.g. `{ path: 'ecommerce.currency', op: 'is', value: 'INR' }`. */
  filters?: Array<{ path: string } & StringMatch>;
  /** Where the value is, e.g. "ecommerce.value". */
  valuePath?: string;
}

/** A purchase: value, currency and a transaction id to count each order once. */
export interface TransactionGoal {
  key: string;
  event: string;
  valuePath: string;
  idPath: string;
  currencyPath?: string;
}

type Entry = Record<string, unknown>;
const SEEN_KEY = 'splitcraft_tx';
const SEEN_MAX = 50;

/**
 * Watch window.dataLayer: entries already there when the SDK starts, and every later
 * push. Wraps `push` (GTM wraps it too; each wrapper calls the one before). Splitcraft's
 * own entries are skipped.
 */
export function watchDataLayer(onEntry: (entry: Entry) => void): () => void {
  const w = window as unknown as { dataLayer?: unknown[] };
  const dl = (w.dataLayer ??= []);
  const handle = (item: unknown): void => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const entry = item as Entry;
    if (typeof entry.event === 'string' && entry.event.startsWith('splitcraft_')) return;
    try {
      onEntry(entry);
    } catch (err) {
      console.error('[splitcraft] dataLayer goal:', err);
    }
  };
  dl.forEach(handle);
  const original = dl.push;
  dl.push = function (...items: unknown[]) {
    const result = original.apply(this, items);
    items.forEach(handle);
    return result;
  };
  return () => {
    if (dl.push !== original) dl.push = original;
  };
}

export function trackDataLayer(
  goals: DataLayerGoal[],
  transactions: TransactionGoal[],
  track: (key: string, props?: { value?: number; [k: string]: unknown }) => void,
): () => void {
  if (!goals.length && !transactions.length) return () => {};
  return watchDataLayer((entry) => {
    for (const goal of goals) {
      if (entry.event !== goal.event) continue;
      const pass = (goal.filters ?? []).every((f) => matchString(text(getPath(entry, f.path)), f));
      if (!pass) continue;
      const value = goal.valuePath ? number(getPath(entry, goal.valuePath)) : undefined;
      track(goal.key, value === undefined ? undefined : { value });
    }
    for (const t of transactions) {
      if (entry.event !== t.event) continue;
      const id = text(getPath(entry, t.idPath));
      if (id && !firstTime(`${t.key}:${id}`)) continue;
      const value = number(getPath(entry, t.valuePath));
      const currency = t.currencyPath ? text(getPath(entry, t.currencyPath)) : undefined;
      track(t.key, {
        ...(value !== undefined && { value }),
        ...(id && { transaction_id: id }),
        ...(currency && { currency }),
      });
    }
  });
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
}

function number(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/** Remember the last 50 transaction ids, so a reloaded thank-you page counts once. */
function firstTime(id: string): boolean {
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    // Storage blocked: count it.
  }
  if (seen.includes(id)) return false;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id].slice(-SEEN_MAX)));
  } catch {
    // Storage blocked.
  }
  return true;
}
