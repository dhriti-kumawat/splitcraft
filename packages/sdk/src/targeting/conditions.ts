import { matchNumber, matchString, matchUrl } from './match';
import type { Condition, ConditionGroup, TargetingContext } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function isGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return 'mode' in item;
}

/** Top-level groups are ANDed. No groups means everyone matches. */
export function evaluateGroups(
  groups: ConditionGroup[] | undefined,
  ctx: TargetingContext,
): boolean {
  return (groups ?? []).every((g) => evaluateGroup(g, ctx));
}

export function evaluateGroup(group: ConditionGroup, ctx: TargetingContext): boolean {
  if (group.items.length === 0) return true;
  const matches = (item: Condition | ConditionGroup): boolean =>
    isGroup(item) ? evaluateGroup(item, ctx) : evaluateCondition(item, ctx);
  switch (group.mode) {
    case 'all':
      return group.items.every(matches);
    case 'any':
      return group.items.some(matches);
    case 'none':
      return !group.items.some(matches);
    default:
      return false;
  }
}

export function evaluateCondition(c: Condition, ctx: TargetingContext): boolean {
  switch (c.type) {
    case 'visitor_type':
      return (c.value === 'new') === ctx.visitor.isNew;
    case 'session_number':
      return matchNumber(ctx.visitor.sessionNumber, c);
    case 'pages_viewed_session':
      return matchNumber(ctx.visitor.pagesViewedThisSession, c);
    case 'page_views_matching': {
      const since = ctx.now - c.days * DAY_MS;
      let count = 0;
      for (const view of ctx.visitor.history) {
        if (view.at >= since && matchUrl(view.url, c.url)) count++;
      }
      return count >= c.count;
    }
    case 'device_type':
      return c.value.includes(ctx.device.type);
    case 'screen_width':
      return matchNumber(ctx.device.screenWidth, c);
    case 'country':
      return matchString(ctx.country, c);
    case 'utm':
      return matchString(ctx.utm[c.touch][c.param], c);
    case 'source_type':
      return c.value.includes(ctx.sourceType);
    case 'cookie':
      return matchString(ctx.cookies[c.name], c);
    case 'data_layer':
      return matchString(toText(dataLayerValue(ctx.dataLayer, c.key)), c);
    case 'js_variable':
      return matchString(toText(getPath(ctx.global, c.path)), c);
    case 'custom_js':
      return runCustomJs(c.code);
    default:
      // Unknown condition type from a newer config: fail closed.
      return false;
  }
}

/** Latest value pushed for `key`, the same "last write wins" view GTM gives. */
export function dataLayerValue(dataLayer: unknown[], key: string): unknown {
  for (let i = dataLayer.length - 1; i >= 0; i--) {
    const entry = dataLayer[i];
    // Skip gtag() argument objects and non-objects.
    if (entry === null || typeof entry !== 'object' || isArguments(entry)) continue;
    const value = getPath(entry, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function getPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const part of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    try {
      current = (current as Record<string, unknown>)[part];
    } catch {
      // Getters on host objects can throw.
      return undefined;
    }
  }
  return current;
}

function toText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return String(value);
}

function isArguments(value: object): boolean {
  return Object.prototype.toString.call(value) === '[object Arguments]';
}

function runCustomJs(code: string): boolean {
  try {
    return Boolean(new Function(code)());
  } catch {
    return false;
  }
}
