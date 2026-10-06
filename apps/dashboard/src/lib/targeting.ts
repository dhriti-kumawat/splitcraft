// Targeting as the dashboard stores it (experiments.targeting). Conditions and rules use
// the SDK's own types so the two can't drift apart.
import type {
  Activation,
  Condition,
  ConditionGroup,
  DeviceType,
  Frequency,
  NumberOperator,
  SourceType,
  StringOperator,
  UrlRule,
  UtmParam,
  WhereRules,
} from '../../../../packages/sdk/src/targeting/types';

export type {
  Condition,
  ConditionGroup,
  DeviceType,
  Frequency,
  NumberOperator,
  SourceType,
  StringOperator,
  UrlRule,
  UtmParam,
  WhereRules,
};

export interface StoredTargeting {
  who?: { mode: 'all' | 'any'; segmentIds: string[] };
  where?: WhereRules;
  how?: ConditionGroup[];
  when?: Frequency;
  /** Once a visitor has seen the experiment, skip WHO and HOW. */
  stay?: boolean;
  /** Wait up to this long (ms) for the dataLayer keys the rules use. */
  waitForDataLayerMs?: number;
  /** When the experiment activates on a matching page; none = at once. */
  activation?: Activation;
}

function conditions(groups: ConditionGroup[] = []): Condition[] {
  return groups.flatMap((g) =>
    g.items.flatMap((item) => ('mode' in item ? conditions([item]) : [item])),
  );
}

/** "/trips/* · mobile" style one-liner used in lists. */
export function targetingSummary(t: StoredTargeting | null | undefined): string {
  const include = t?.where?.include ?? [];
  const pages = include.length ? include.map((r) => r.value).join(', ') : 'all pages';
  const devices = conditions(t?.how)
    .filter((c): c is Extract<Condition, { type: 'device_type' }> => c.type === 'device_type')
    .flatMap((c) => c.value);
  return `${pages} · ${devices.length ? [...new Set(devices)].join(', ') : 'all devices'}`;
}
