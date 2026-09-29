import type { Experiment, Project } from '../data/api';
import { controlKey } from './experiments';

export interface Check {
  id: 'snippet' | 'goal' | 'code' | 'qa';
  label: string;
  ok: boolean;
  /** Blocking checks stop the launch; the QA check is only a warning (PRODUCT_SPEC §3). */
  blocking: boolean;
}

/** Returns a message for the first syntax error, or null when the JS parses. */
export function syntaxError(js: string): string | null {
  if (!js.trim()) return null;
  try {
    // Parses only; nothing runs.
    new Function('splitly', js);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function variantsReady(exp: Experiment): boolean {
  const control = controlKey(exp);
  const others = exp.variants.filter((v) => v.key !== control);
  return (
    others.length > 0 &&
    others.every((v) => (v.js.trim() || v.css.trim()) && syntaxError(v.js) === null) &&
    exp.variants.some((v) => v.weight > 0)
  );
}

export function launchChecks(exp: Experiment, project: Project, qaDone: boolean): Check[] {
  return [
    {
      id: 'snippet',
      label: project.installedAt ? 'Snippet installed on site' : 'Install the snippet on your site',
      ok: Boolean(project.installedAt),
      blocking: true,
    },
    {
      id: 'goal',
      label: exp.primaryMetricId ? 'Primary goal set' : 'Set a primary goal',
      ok: Boolean(exp.primaryMetricId),
      blocking: true,
    },
    {
      id: 'code',
      label: variantsReady(exp)
        ? 'Variant code saved, no errors'
        : 'Add variant code that runs without errors',
      ok: variantsReady(exp),
      blocking: true,
    },
    {
      id: 'qa',
      label: qaDone ? 'Previewed on site' : 'QA preview not done yet',
      ok: qaDone,
      blocking: false,
    },
  ];
}

export function canLaunch(checks: Check[]): boolean {
  return checks.every((c) => c.ok || !c.blocking);
}

const QA_KEY = (id: string) => `splitly_qa_${id}`;

export function qaDone(experimentId: string): boolean {
  try {
    return localStorage.getItem(QA_KEY(experimentId)) === '1';
  } catch {
    return false;
  }
}

export function markQaDone(experimentId: string): void {
  try {
    localStorage.setItem(QA_KEY(experimentId), '1');
  } catch {
    // Only affects the warning.
  }
}

/** URL that opens the site with a variant forced and the QA panel shown. */
export function previewUrl(exp: Experiment, project: Project, variantKey?: string): string {
  const key =
    variantKey ?? exp.variants.find((v) => v.key !== controlKey(exp))?.key ?? controlKey(exp);
  const host = project.mainDomain;
  const scheme = host.startsWith('localhost') ? 'http' : 'https';
  return `${scheme}://${host}/?splitly_force=${encodeURIComponent(`${exp.key}:${key}`)}`;
}
