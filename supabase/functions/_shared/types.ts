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
  stay?: boolean;
  waitForDataLayerMs?: number;
}

/** What `sdk_config_source()` returns. */
export interface ConfigSource {
  experiments: Array<{
    key: string;
    name: string;
    /** Not live: included only for a preview request (preview token). */
    preview?: boolean;
    trafficPct: number;
    targeting: StoredTargeting;
    /** Exclusion group: [name, this test's place among its live tests, their count]. */
    group?: [string, number, number] | null;
    metricIds: string[];
    variants: Array<{
      key: string;
      name: string;
      weight: number;
      js: string;
      css: string;
      url?: string | null;
    }>;
  }>;
  segments: Record<string, ConditionGroup>;
  metrics: Array<{ id: string; eventKey: string; source: string; sourceConfig: Json }>;
  /** projects.settings: `{ antiFlicker?, spa?, ga4? }`, each on unless false. */
  settings?: Json;
}

export interface SdkProjectConfig {
  projectKey: string;
  eventsUrl: string;
  experiments: Array<{
    key: string;
    name: string;
    trafficPct: number;
    /** Exclusion group: [name, place, count]; see sdk bucketing. */
    group?: [string, number, number];
    variants: Array<{
      key: string;
      name: string;
      weight: number;
      js?: string;
      css?: string;
      url?: string;
    }>;
    targeting: {
      who?: ConditionGroup[];
      where?: Json;
      how?: ConditionGroup[];
      when?: Json;
      stay?: boolean;
      waitForDataLayerMs?: number;
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
    datalayer: Array<{
      key: string;
      event: string;
      filters?: Array<{ path: string; op: StringOp; value?: string | string[] }>;
      valuePath?: string;
    }>;
    transactions: Array<{
      key: string;
      event: string;
      valuePath: string;
      idPath: string;
      currencyPath?: string;
    }>;
    browsing?: Array<'engaged' | 'pages' | 'time' | 'return'>;
    vitals?: Array<'lcp' | 'inp' | 'cls'>;
  };
  country?: string;
  /** Only the switches that are off. */
  options?: { spa?: false; ga4?: false };
}

/** One event as the SDK sends it (packages/sdk/src/tracking/transport.ts). */
export interface IncomingEvent {
  type: 'exposure' | 'goal' | 'ping';
  key?: string;
  experimentKey?: string;
  variantKey?: string;
  value?: number;
  props?: Json;
  url: string;
  visitorId: string;
}

/** String operators the SDK understands (packages/sdk/src/targeting/types.ts). */
export const STRING_OPS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'regex',
  'exists',
  'not_exists',
] as const;
export type StringOp = (typeof STRING_OPS)[number];
