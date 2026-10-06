import { waitForSelector } from '../dom';
import { dataLayerValue, evaluateGroups, runCustomJs } from './conditions';
import { matchUrl } from './match';
import type {
  Activation,
  ConditionGroup,
  Frequency,
  Targeting,
  TargetingContext,
  WhereRules,
} from './types';

export * from './types';
export { evaluateCondition, evaluateGroup, evaluateGroups } from './conditions';

/**
 * Resolves true once `a` is met on this page: the element exists, the JS condition is
 * true (checked every 100 ms), or `manual()` resolves. False after the time limit.
 */
export function waitForActivation(a: Activation, manual: () => Promise<boolean>): Promise<boolean> {
  if (a.mode === 'manual') return manual();
  const limit = Math.min(a.timeoutMs ?? 10000, 60000);
  if (a.mode === 'element') return waitForSelector(a.selector, limit).then(Boolean);
  return new Promise((resolve) => {
    const end = Date.now() + limit;
    const check = (): void => {
      if (runCustomJs(a.code)) resolve(true);
      else if (Date.now() >= end) resolve(false);
      else setTimeout(check, 100);
    };
    check();
  });
}
export { matchUrl } from './match';

const DEFAULT_ELEMENT_TIMEOUT_MS = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decide whether the current visitor, on the current page, is in the audience.
 * Synchronous rules run first so a non-matching page never waits for elements.
 */
export async function evaluateTargeting(t: Targeting, ctx: TargetingContext): Promise<boolean> {
  if (!matchesWithoutElements(t, ctx)) return false;
  const rules = t.where?.elements ?? [];
  if (rules.length === 0) return true;
  const found = await Promise.all(
    rules.map((r) => waitForSelector(r.selector, r.timeoutMs ?? DEFAULT_ELEMENT_TIMEOUT_MS)),
  );
  return found.every((el) => el !== null);
}

/** Every rule except "element on page exists", evaluated synchronously. */
export function matchesWithoutElements(t: Targeting, ctx: TargetingContext): boolean {
  return (
    matchWhereUrl(ctx.url, t.where) &&
    matchFrequency(t.when, ctx) &&
    evaluateGroups(t.who, ctx) &&
    evaluateGroups(t.how, ctx)
  );
}

export function matchWhereUrl(url: string, where: WhereRules | undefined): boolean {
  if ((where?.exclude ?? []).some((r) => matchUrl(url, r))) return false;
  const include = where?.include ?? [];
  return include.length === 0 || include.some((r) => matchUrl(url, r));
}

export function matchFrequency(when: Frequency | undefined, ctx: TargetingContext): boolean {
  const last = ctx.exposure;
  if (!when || !last) return true;
  switch (when.mode) {
    case 'every_load':
      return true;
    case 'once':
      return false;
    case 'once_per_session':
      return last.lastSessionId !== ctx.visitor.sessionId;
    case 'every_n_days':
      return ctx.now - last.lastAt >= when.days * DAY_MS;
    default:
      return false;
  }
}

/**
 * Evaluation setting "wait for dataLayer": resolve once every dataLayer key the rules use
 * has a value, or after `ms` (then the rules see whatever is there).
 */
export function waitForDataLayer(
  t: Targeting,
  ms: number,
  dataLayer: () => unknown[],
): Promise<void> {
  const keys: string[] = [];
  const scan = (groups: ConditionGroup[] = []): void =>
    groups.forEach((g) =>
      g.items.forEach((i) =>
        'mode' in i ? scan([i]) : i.type === 'data_layer' && keys.push(i.key),
      ),
    );
  scan(t.who);
  scan(t.how);
  const ready = () => keys.every((k) => dataLayerValue(dataLayer(), k) !== undefined);
  if (!keys.length || ms <= 0 || ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (ready() || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}
