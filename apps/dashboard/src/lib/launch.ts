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
    new Function('splitcraft', js);
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

const QA_KEY = (id: string) => `splitcraft_qa_${id}`;

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
  // The experiment's test page, or the site's home page.
  const url = new URL(
    exp.previewUrl ?? `${schemeFor(project.mainDomain)}://${project.mainDomain}/`,
  );
  url.searchParams.set('splitcraft_force', `${exp.key}:${key}`);
  // Loads this experiment even while it's a draft (or paused), on any page.
  url.searchParams.set('splitcraft_preview', exp.previewToken);
  return url.href;
}

const schemeFor = (host: string) =>
  /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https';

/**
 * The test page an experiment runs on, from what someone typed: a path (on the main
 * domain) or a full URL on one of the project's domains (main, www., or "Also allow on").
 */
export function testPageUrl(
  input: string,
  project: Pick<Project, 'mainDomain' | 'allowedDomains'>,
): { url: string | null; error?: string } {
  const raw = input.trim();
  if (!raw) return { url: null };
  const main = project.mainDomain;
  const full = raw.startsWith('/')
    ? `${schemeFor(main)}://${main}${raw}`
    : /^https?:\/\//i.test(raw)
      ? raw
      : `${schemeFor(raw)}://${raw}`;
  let url: URL;
  try {
    url = new URL(full);
  } catch {
    return { url: null, error: 'Enter a page on your site, like /trips/norway.' };
  }
  const host = url.hostname.toLowerCase();
  const allowed = [main, `www.${main}`, ...project.allowedDomains].some((entry) => {
    const d = entry.toLowerCase().split(':')[0]!;
    return host === d || (d.startsWith('*.') && host.endsWith(d.slice(1)));
  });
  if (!allowed) {
    return {
      url: null,
      error: `${host} isn't one of this project's domains. Add it in Settings › Also allow on.`,
    };
  }
  url.searchParams.delete('splitcraft_force');
  url.searchParams.delete('splitcraft_preview');
  return { url: url.href };
}
