import { injectStyles, onceInView, onRouteChange, waitForElement } from './helpers';

export interface VariantCode {
  experimentKey: string;
  variantKey: string;
  js?: string;
  css?: string;
}

export interface ApplyResult {
  /** False when this variant already ran on this page. */
  applied: boolean;
  error?: unknown;
}

/** Helpers variant code can call as `splitcraft.*`. The runtime adds `trackEvent`. */
const helpers = { waitForElement, onceInView, onRouteChange, injectStyles };

/** experimentKey → URL the variant JS last ran on. */
const appliedOn = new Map<string, string>();

export function styleId(experimentKey: string): string {
  return `splitcraft-exp-${experimentKey}`;
}

/**
 * Apply a variant's CSS and JS. JS runs at most once per page (URL), so SPA
 * route changes can re-apply it without double-running on the same page.
 * Errors in variant code are caught and returned, never thrown into the site.
 */
export function applyVariant(v: VariantCode, extra: Record<string, unknown> = {}): ApplyResult {
  const url = location.href;
  if (appliedOn.get(v.experimentKey) === url) return { applied: false };
  appliedOn.set(v.experimentKey, url);

  if (v.css) injectStyles(v.css, styleId(v.experimentKey));
  if (!v.js) return { applied: true };
  try {
    new Function('splitcraft', v.js)({ ...helpers, ...extra });
    return { applied: true };
  } catch (error) {
    console.error(`[splitcraft] ${v.experimentKey}/${v.variantKey}:`, error);
    return { applied: true, error };
  }
}

/** Remove a variant's CSS, e.g. after an SPA navigation leaves the targeted pages. */
export function removeVariant(experimentKey: string): void {
  appliedOn.delete(experimentKey);
  document.getElementById(styleId(experimentKey))?.remove();
}
