import type { PreviewState } from './protocol';

/** One previewed tab. Kept in chrome.storage.session, since the worker can stop any time. */
export interface Session {
  state: PreviewState;
  /** The project's domains: the preview follows links within them and stops elsewhere. */
  hosts: string[];
  /** The dashboard tab that opened it, told when the panel switches or stops. */
  dashboardTabId: number;
}

/** Whether `url` is on one of the project's domains (`shop.com`, `www.shop.com`, `*.shop.com`, `localhost:5173`). */
export function hostAllowed(url: string, hosts: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (!hosts.length) return true;
  const host = u.host.toLowerCase();
  const name = u.hostname.toLowerCase();
  return hosts.some((entry) => {
    const d = entry.toLowerCase().trim();
    if (d.startsWith('*.')) return name.endsWith(d.slice(1));
    return d.includes(':') ? host === d : name === d || name === `www.${d}`;
  });
}

/**
 * Variant JS for chrome.userScripts, which runs it in the page even when its CSP blocks
 * eval. Errors show in the preview panel.
 */
export function userScriptCode(js: string): string {
  return `(function(){var p=window.splitcraftPreview;if(!p)return;try{(function(splitcraft){\n${js}\n}).call(window,p.helpers)}catch(e){p.error('JS error: '+(e&&e.message||e))}})();`;
}

export function currentJs(state: PreviewState): string {
  return state.variants.find((v) => v.key === state.variantKey)?.js ?? '';
}
