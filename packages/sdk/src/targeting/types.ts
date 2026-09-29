/**
 * Targeting rules as stored in the experiment config (JSON).
 * See PRODUCT_SPEC §4: WHO (segments) / WHERE (pages) / HOW (triggers) / WHEN (frequency).
 */

export interface Targeting {
  /** Segments: traits that persist across visits. Top-level groups are ANDed. */
  who?: ConditionGroup[];
  where?: WhereRules;
  /** Triggers: conditions in the current visit. Top-level groups are ANDed. */
  how?: ConditionGroup[];
  when?: Frequency;
}

// ---------------------------------------------------------------- groups

/** `none` matches when no item matches (exclude). An empty group always matches. */
export type GroupMode = 'all' | 'any' | 'none';

export interface ConditionGroup {
  mode: GroupMode;
  items: Array<Condition | ConditionGroup>;
}

// ---------------------------------------------------------------- matchers

/**
 * String comparisons ignore case, except `regex`, which uses the pattern as written.
 * When `value` is a list, `is` / `contains` / `starts_with` / `ends_with` / `regex`
 * match if any entry matches; `is_not` / `not_contains` match if none does.
 */
export type StringOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'exists'
  | 'not_exists';

export interface StringMatch {
  op: StringOperator;
  value?: string | string[];
}

export type NumberOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface NumberMatch {
  op: NumberOperator;
  value: number;
}

// ---------------------------------------------------------------- conditions

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type SourceType = 'direct' | 'organic' | 'paid' | 'social' | 'email' | 'referral';
export type UtmParam = 'source' | 'medium' | 'campaign' | 'term' | 'content';

export type Condition =
  | { type: 'visitor_type'; value: 'new' | 'returning' }
  | ({ type: 'session_number' } & NumberMatch)
  | ({ type: 'pages_viewed_session' } & NumberMatch)
  /** Visitor viewed pages matching `url` at least `count` times in the last `days` days. */
  | { type: 'page_views_matching'; url: UrlRule; count: number; days: number }
  /** Matches if the device is any of the listed types. */
  | { type: 'device_type'; value: DeviceType[] }
  | ({ type: 'screen_width' } & NumberMatch)
  /** ISO 3166-1 alpha-2 code, e.g. "GB". */
  | ({ type: 'country' } & StringMatch)
  | ({ type: 'utm'; param: UtmParam; touch: 'first' | 'last' } & StringMatch)
  /** Matches if the traffic source is any of the listed types. */
  | { type: 'source_type'; value: SourceType[] }
  | ({ type: 'cookie'; name: string } & StringMatch)
  /** Latest dataLayer value for a dotted key, e.g. "ecommerce.currency". */
  | ({ type: 'data_layer'; key: string } & StringMatch)
  /** Dotted path on `window`, e.g. "app.user.plan". */
  | ({ type: 'js_variable'; path: string } & StringMatch)
  /** Function body; the condition matches when it returns a truthy value. */
  | { type: 'custom_js'; code: string };

// ---------------------------------------------------------------- where

/**
 * `is` and `matches` compare against the path (plus query, if the rule has one)
 * when the value starts with "/", otherwise against the full URL.
 * `contains` and `regex` always test the full URL. The hash is ignored.
 * `matches` supports `*` wildcards, e.g. "/trips/*".
 */
export interface UrlRule {
  op: 'is' | 'contains' | 'matches' | 'regex';
  value: string;
}

export interface ElementRule {
  selector: string;
  /** How long to wait for the element. Default 3000 ms. */
  timeoutMs?: number;
}

/** INCLUDE rules are ORed (none = every page); EXCLUDE always wins; ELEMENT rules are ANDed. */
export interface WhereRules {
  include?: UrlRule[];
  exclude?: UrlRule[];
  elements?: ElementRule[];
}

// ---------------------------------------------------------------- when

export type Frequency =
  | { mode: 'every_load' }
  | { mode: 'once' }
  | { mode: 'once_per_session' }
  | { mode: 'every_n_days'; days: number };

// ---------------------------------------------------------------- context

export interface PageView {
  url: string;
  /** Epoch ms. */
  at: number;
}

export interface ExposureRecord {
  lastAt: number;
  lastSessionId: string;
}

/** Snapshot of everything the evaluator reads. Built by the SDK runtime from the browser. */
export interface TargetingContext {
  url: string;
  /** Epoch ms. */
  now: number;
  visitor: {
    isNew: boolean;
    sessionId: string;
    sessionNumber: number;
    pagesViewedThisSession: number;
    history: PageView[];
  };
  device: { type: DeviceType; screenWidth: number };
  country?: string;
  utm: {
    first: Partial<Record<UtmParam, string>>;
    last: Partial<Record<UtmParam, string>>;
  };
  sourceType: SourceType;
  cookies: Record<string, string>;
  dataLayer: unknown[];
  /** Usually `window`. */
  global: Record<string, unknown>;
  /** Last exposure to the experiment being evaluated, if any. */
  exposure?: ExposureRecord;
}
