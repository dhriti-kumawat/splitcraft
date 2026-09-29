// Shapes shared by the Edge Functions. `SdkProjectConfig` must stay assignable to the
// SDK's `ProjectConfig` (packages/sdk/src/runtime.ts); tests/config.test.ts checks this
// at compile time. The Edge Functions can't import the SDK package directly (Deno bundle).

export type Json = Record<string, unknown>;

export const URL_OPS = ['is', 'contains', 'matches', 'regex'] as const;
export type UrlRule = { op: (typeof URL_OPS)[number]; value: string };

export interface ConditionGroup {
  mode: 'all' | 'any' | 'none';
  items: Array<Json | ConditionGroup>;
}

/** `experiments.targeting` as the dashboard stores it. */
export interface StoredTargeting {
  who?: { mode: 'all' | 'any'; segmentIds: string[] };
  where?: Json;
  how?: ConditionGroup[];
  when?: Json;
}

/** What `sdk_config_source()` returns. */
export interface ConfigSource {
  experiments: Array<{
    key: string;
    name: string;
    trafficPct: number;
    targeting: StoredTargeting;
    metricIds: string[];
    variants: Array<{ key: string; name: string; weight: number; js: string; css: string }>;
  }>;
  segments: Record<string, ConditionGroup>;
  metrics: Array<{ id: string; eventKey: string; source: string; sourceConfig: Json }>;
}

export interface SdkProjectConfig {
  projectKey: string;
  eventsUrl: string;
  experiments: Array<{
    key: string;
    name: string;
    trafficPct: number;
    variants: Array<{ key: string; name: string; weight: number; js?: string; css?: string }>;
    targeting: {
      who?: ConditionGroup[];
      where?: Json;
      how?: ConditionGroup[];
      when?: Json;
    };
  }>;
  goals: {
    clicks: Array<{
      key: string;
      selector: string;
      firstPerPage?: boolean;
      /** Send `<key>:view` once per page when a matching element is seen (click-through rate). */
      views?: boolean;
      /** Send seconds since page load as the value of each page's first click. */
      timing?: boolean;
    }>;
    pageviews: Array<{ key: string; url: UrlRule }>;
    custom: Array<{ key: string; code: string; pages?: UrlRule[] }>;
  };
  country?: string;
}

/** One event as the SDK sends it (packages/sdk/src/tracking/transport.ts). */
export interface IncomingEvent {
  type: 'exposure' | 'goal';
  key?: string;
  experimentKey?: string;
  variantKey?: string;
  value?: number;
  props?: Json;
  url: string;
  visitorId: string;
}
