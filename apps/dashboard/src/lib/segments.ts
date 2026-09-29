import type { ConditionGroup } from './targeting';

/** The builder edits top-level groups; a segment stores them as one ALL group. */
export function toGroups(rules: ConditionGroup): ConditionGroup[] {
  if (rules.items.length === 0) return [];
  return rules.items.every((i) => 'mode' in i) ? (rules.items as ConditionGroup[]) : [rules];
}

export function fromGroups(groups: ConditionGroup[]): ConditionGroup {
  return { mode: 'all', items: groups };
}
