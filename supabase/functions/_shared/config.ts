import {
  STRING_OPS,
  URL_OPS,
  type ConditionGroup,
  type ConfigSource,
  type SdkProjectConfig,
  type StoredTargeting,
  type StringOp,
  type UrlRule,
} from './types.ts';

// Matches nobody: NONE of [an empty group, which always matches].
const NEVER: ConditionGroup = { mode: 'none', items: [{ mode: 'all', items: [] }] };

/**
 * Turn the database rows into the config the SDK fetches. Only what live experiments
 * use is included, because this response is public.
 */
export function toSdkConfig(
  source: ConfigSource,
  projectKey: string,
  eventsUrl: string,
  country?: string,
): SdkProjectConfig {
  const usedMetricIds = new Set(source.experiments.flatMap((e) => e.metricIds));
  const used = source.metrics.filter((m) => usedMetricIds.has(m.id));

  const clicks: SdkProjectConfig['goals']['clicks'] = [];
  const pageviews: SdkProjectConfig['goals']['pageviews'] = [];
  const custom: SdkProjectConfig['goals']['custom'] = [];
  const datalayer: SdkProjectConfig['goals']['datalayer'] = [];
  const transactions: SdkProjectConfig['goals']['transactions'] = [];
  const browsing = new Set<NonNullable<SdkProjectConfig['goals']['browsing']>[number]>();
  const vitals = new Set<NonNullable<SdkProjectConfig['goals']['vitals']>[number]>();
  const path = (v: unknown, fallback: string) =>
    typeof v === 'string' && /^[\w$.-]{1,100}$/.test(v) ? v : fallback;
  for (const m of used) {
    const cfg = m.sourceConfig;
    if (m.source === 'click' && typeof cfg.selector === 'string' && cfg.selector) {
      clicks.push({
        key: m.eventKey,
        selector: cfg.selector,
        ...(cfg.firstPerPage === true && { firstPerPage: true }),
        ...(cfg.views === true && { views: true }),
        ...(cfg.timing === true && { timing: true }),
      });
    } else if (m.source === 'pageview' && isUrlRule(cfg.url)) {
      pageviews.push({ key: m.eventKey, url: cfg.url });
    } else if (m.source === 'custom_js' && typeof cfg.code === 'string' && cfg.code.trim()) {
      const pages = Array.isArray(cfg.pages) ? cfg.pages.filter(isUrlRule) : [];
      custom.push({ key: m.eventKey, code: cfg.code, ...(pages.length && { pages }) });
    } else if (m.source === 'datalayer' && typeof cfg.event === 'string' && cfg.event) {
      const filters = (Array.isArray(cfg.filters) ? cfg.filters : []).flatMap((f) => {
        const r = (f ?? {}) as Record<string, unknown>;
        if (typeof r.path !== 'string' || !(STRING_OPS as readonly unknown[]).includes(r.op))
          return [];
        const value =
          typeof r.value === 'string' || Array.isArray(r.value)
            ? (r.value as string | string[])
            : undefined;
        return [{ path: r.path, op: r.op as StringOp, ...(value !== undefined && { value }) }];
      });
      datalayer.push({
        key: m.eventKey,
        event: cfg.event,
        ...(filters.length && { filters }),
        ...(typeof cfg.valuePath === 'string' &&
          cfg.valuePath && { valuePath: path(cfg.valuePath, '') }),
      });
    } else if (m.source === 'transaction') {
      transactions.push({
        key: m.eventKey,
        event: path(cfg.event, 'purchase'),
        valuePath: path(cfg.valuePath, 'ecommerce.value'),
        idPath: path(cfg.idPath, 'ecommerce.transaction_id'),
        currencyPath: path(cfg.currencyPath, 'ecommerce.currency'),
      });
    } else if (
      m.source === 'browsing' &&
      ['engaged', 'pages', 'time', 'return'].includes(cfg.kind as string)
    ) {
      browsing.add(cfg.kind as 'engaged');
    } else if (m.source === 'web_vitals' && ['lcp', 'inp', 'cls'].includes(cfg.vital as string)) {
      vitals.add(cfg.vital as 'lcp');
    }
  }

  return {
    projectKey,
    eventsUrl,
    experiments: source.experiments.map((e) => ({
      key: e.key,
      name: e.name,
      // A preview shows everywhere on the open page, to everyone who has the link.
      trafficPct: e.preview ? 100 : Number(e.trafficPct),
      ...(!e.preview && e.group && { group: e.group }),
      variants: e.variants.map((v) => ({
        key: v.key,
        name: v.name,
        weight: Number(v.weight),
        ...(v.js && { js: v.js }),
        ...(v.css && { css: v.css }),
        // Split URL tests: the SDK sends this variant's visitors here.
        ...(v.url && { url: v.url }),
      })),
      targeting: e.preview ? {} : toSdkTargeting(e.targeting ?? {}, source.segments),
    })),
    goals: {
      clicks,
      pageviews,
      custom,
      datalayer,
      transactions,
      // Only when used: their presence makes the SDK load its metrics bundle.
      ...(browsing.size && { browsing: [...browsing] }),
      ...(vitals.size && { vitals: [...vitals] }),
    },
    ...(country && { country }),
    ...(options(source.settings) && { options: options(source.settings) }),
  };
}

export function toSdkTargeting(
  t: StoredTargeting,
  segments: Record<string, ConditionGroup>,
): SdkProjectConfig['experiments'][number]['targeting'] {
  const out: SdkProjectConfig['experiments'][number]['targeting'] = {};
  if (t.who && t.who.segmentIds.length > 0) {
    // A deleted segment must not widen the audience, so it becomes "matches nobody".
    const groups = t.who.segmentIds.map((id) => segments[id] ?? NEVER);
    out.who = t.who.mode === 'any' ? [{ mode: 'any', items: groups }] : groups;
  }
  if (t.where) out.where = t.where;
  if (t.how && t.how.length > 0) out.how = t.how;
  if (t.when) out.when = t.when;
  // Evaluation settings (PRODUCT_SPEC §4).
  if (t.stay === true) out.stay = true;
  if (typeof t.waitForDataLayerMs === 'number' && t.waitForDataLayerMs > 0) {
    out.waitForDataLayerMs = Math.min(Math.round(t.waitForDataLayerMs), 5000);
  }
  return out;
}

/** Switches that are off, for the SDK; undefined when all are on (the default). */
function options(settings: ConfigSource['settings']): SdkProjectConfig['options'] {
  const s = (settings ?? {}) as Record<string, unknown>;
  const out: NonNullable<SdkProjectConfig['options']> = {
    ...(s.spa === false && { spa: false as const }),
    ...(s.ga4 === false && { ga4: false as const }),
  };
  return Object.keys(out).length ? out : undefined;
}

function isUrlRule(value: unknown): value is UrlRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  return (URL_OPS as readonly unknown[]).includes(rule.op) && typeof rule.value === 'string';
}
