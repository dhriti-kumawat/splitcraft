import { onceInView, waitForElement } from '../helpers';
import { onRouteChange } from '../router';
import { FORCE_PARAM, PREVIEW_PARAM } from '../qa/force';
import { nav, splitTarget } from '../split';
import { mountPanel, type Panel } from './panel';
import { addSheet } from './sheets';
import type { PreviewApi, PreviewState, StartOptions } from './types';

/** Experiments a preview owns; the main SDK leaves them alone (runtime.ts). */
export const OWNED = '__splitcraftPreview';

/**
 * The preview: applies one variant's CSS and JS as sent (saved or unsaved), shows the
 * panel, and applies later edits. CSS changes apply in place; a JS change needs a clean
 * page, so `update` returns `rerun` and the caller reloads (extension) or runs it again.
 */
export function createPreview(): PreviewApi {
  let state: PreviewState | null = null;
  let opts: StartOptions = {};
  let removeCss: (() => void) | null = null;
  let panel: Panel | null = null;
  let error = '';
  let note = '';
  const w = window as unknown as Record<string, Record<string, boolean> | undefined>;

  const helpers = {
    waitForElement,
    onceInView,
    onRouteChange,
    injectStyles: (css: string) => addSheet(css),
    trackEvent: () => {},
  };
  const current = () => state?.variants.find((v) => v.key === state!.variantKey);
  const render = () => state && panel?.render(state, note, error);
  const setError = (message: string) => {
    error = message;
    render();
  };

  const applyCss = () => {
    removeCss?.();
    removeCss = null;
    const css = current()?.css;
    if (css) removeCss = addSheet(css);
  };

  const runJs = () => {
    const js = current()?.js;
    if (!js?.trim() || opts.externalJs) return;
    try {
      new Function('splitcraft', js)(helpers);
      setError('');
    } catch (e) {
      setError(
        e instanceof EvalError || /unsafe-eval|Content Security Policy/i.test(String(e))
          ? "This site's Content-Security-Policy blocks running JS here. Use the Splitcraft Preview extension with user scripts allowed."
          : `JS error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const api: PreviewApi = {
    helpers,
    start(next, o = {}) {
      state = next;
      opts = o;
      (w[OWNED] ??= {})[next.experimentKey] = true;
      const url = current()?.url;
      const target = url && splitTarget(url, location.href);
      if (target) {
        nav.go(target);
        return;
      }
      // Hide the page until the variant is on, at most one second.
      const reveal = addSheet('html{opacity:0!important}');
      setTimeout(reveal, 1000);
      applyCss();
      panel = mountPanel({
        onSwitch: (variantKey) => o.onAction?.({ type: 'switch', variantKey }),
        onStop: () => {
          // Gone at once; the extension then reloads the page without it.
          api.stop();
          o.onAction?.({ type: 'stop' });
        },
      });
      runJs();
      render();
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => reveal(), { once: true });
      else reveal();
    },
    update(next) {
      const before = current();
      const switched = !state || next.variantKey !== state.variantKey;
      state = next;
      applyCss();
      render();
      return switched || (before?.js ?? '') !== (current()?.js ?? '') ? 'rerun' : 'live';
    },
    rerun() {
      note = 'JS ran again on this page. Reload for a clean run.';
      runJs();
      render();
    },
    stop() {
      removeCss?.();
      removeCss = null;
      panel?.remove();
      panel = null;
      if (state) delete w[OWNED]?.[state.experimentKey];
      state = null;
      forget();
    },
    error: setError,
  };
  return api;
}

/** Forget the preview for this tab, so reloading shows the page as visitors see it. */
function forget(): void {
  const keys = [PREVIEW_PARAM, FORCE_PARAM, 'splitcraft_preview_force'];
  try {
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // Storage blocked: nothing was remembered.
  }
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  let changed = false;
  for (const k of keys) {
    changed = url.searchParams.has(k) || hash.has(k) || changed;
    url.searchParams.delete(k);
    hash.delete(k);
  }
  if (!changed) return;
  url.hash = hash.toString();
  history.replaceState(history.state, '', url.href.replace(/#$/, ''));
}
