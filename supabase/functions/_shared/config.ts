import {
  URL_OPS,
  type ConditionGroup,
  type ConfigSource,
  type SdkProjectConfig,
  type StoredTargeting,
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
  for (const m of used) {
    const cfg = m.sourceConfig;
    if (m.source === 'click' && typeof cfg.selector === 'string' && cfg.selector) {
      clicks.push({
        key: m.eventKey,
        selector: cfg.selector,
        ...(cfg.firstPerPage === true && { firstPerPage: true }),
      });
    } else if (m.source === 'pageview' && isUrlRule(cfg.url)) {
      pageviews.push({ key: m.eventKey, url: cfg.url });
    }
    // custom_js, datalayer and transaction metrics are not tracked by the SDK yet.
  }

  return {
    projectKey,
    eventsUrl,
    experiments: source.experiments.map((e) => ({
      key: e.key,
      name: e.name,
      trafficPct: Number(e.trafficPct),
      variants: e.variants.map((v) => ({
        key: v.key,
        name: v.name,
        weight: Number(v.weight),
        ...(v.js && { js: v.js }),
        ...(v.css && { css: v.css }),
      })),
      targeting: toSdkTargeting(e.targeting ?? {}, source.segments),
    })),
    goals: { clicks, pageviews },
    ...(country && { country }),
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
  return out;
}

function isUrlRule(value: unknown): value is UrlRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  return (URL_OPS as readonly unknown[]).includes(rule.op) && typeof rule.value === 'string';
}
