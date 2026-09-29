export const FORCE_PARAM = 'splitly_force';
const STORAGE_KEY = 'splitly_force';

/** experimentKey → variantKey */
export type ForcedVariants = Record<string, string>;

/** Parse `exp:variant`, or several pairs separated by commas. Invalid pairs are skipped. */
export function parseForce(raw: string | null): ForcedVariants {
  const forced: ForcedVariants = {};
  for (const pair of (raw ?? '').split(',')) {
    const colon = pair.indexOf(':');
    const exp = pair.slice(0, colon).trim();
    const variant = pair.slice(colon + 1).trim();
    if (colon > 0 && exp && variant) forced[exp] = variant;
  }
  return forced;
}

/**
 * Forced variants from `?splitly_force=`. They are remembered for the tab
 * session, so QA mode survives SPA navigation and reloads that drop the param.
 */
export function getForcedVariants(search = location.search): ForcedVariants {
  const fromUrl = parseForce(new URLSearchParams(search).get(FORCE_PARAM));
  if (Object.keys(fromUrl).length > 0) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
    } catch {
      // Storage blocked: QA mode lasts for this page only.
    }
    return fromUrl;
  }
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const forced: ForcedVariants = {};
      for (const [k, v] of Object.entries(saved)) if (typeof v === 'string') forced[k] = v;
      return forced;
    }
  } catch {
    // Blocked storage or a corrupted value: treat as not forced.
  }
  return {};
}

export function clearForcedVariants(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** `href` with `splitly_force` set to `forced`, or removed when `forced` is empty. */
export function withForce(href: string, forced: ForcedVariants): string {
  const url = new URL(href);
  const value = Object.entries(forced)
    .map(([exp, variant]) => `${exp}:${variant}`)
    .join(',');
  if (value) url.searchParams.set(FORCE_PARAM, value);
  else url.searchParams.delete(FORCE_PARAM);
  return url.toString();
}
