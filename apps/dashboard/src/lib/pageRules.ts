import type { UrlRule, WhereRules } from './targeting';

/** A WHERE URL rule as the editor holds it: include and exclude rules in one list. */
export type PageRule = UrlRule & { kind: 'include' | 'exclude' };
export type ElementRule = { selector: string; timeoutMs?: number };
export interface PageRules {
  pages: PageRule[];
  elements: ElementRule[];
}

export function validRegex(value: string): boolean {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

export function fromWhere(where: WhereRules | undefined): PageRules {
  return {
    pages: [
      ...(where?.include ?? []).map((r) => ({ ...r, kind: 'include' as const })),
      ...(where?.exclude ?? []).map((r) => ({ ...r, kind: 'exclude' as const })),
    ],
    elements: [...(where?.elements ?? [])],
  };
}

/** Back to the stored shape; undefined when there are no rules (runs on every page). */
export function toWhere({ pages, elements }: PageRules): WhereRules | undefined {
  if (!pages.length && !elements.length) return undefined;
  const of = (kind: PageRule['kind']) =>
    pages.filter((p) => p.kind === kind).map(({ op, value }) => ({ op, value }));
  return {
    ...(of('include').length ? { include: of('include') } : {}),
    ...(of('exclude').length ? { exclude: of('exclude') } : {}),
    ...(elements.length ? { elements } : {}),
  };
}

export function pageRuleProblems({ pages, elements }: PageRules): number {
  return (
    pages.filter((p) => !p.value.trim() || (p.op === 'regex' && !validRegex(p.value))).length +
    elements.filter((e) => !e.selector.trim()).length
  );
}

/** "3 URL rules + element" style summary for pickers. */
export function describePageRules(where: WhereRules): string {
  const urls = (where.include?.length ?? 0) + (where.exclude?.length ?? 0);
  const parts = [`${urls} URL ${urls === 1 ? 'rule' : 'rules'}`];
  if (where.elements?.length) parts.push(where.elements.length === 1 ? 'element' : 'elements');
  return parts.join(' + ');
}
