import { FORCE_PARAM, parseForce, PREVIEW_PARAM } from '../qa/force';
import type { PreviewAction, PreviewApi, PreviewState, PreviewVariant } from './types';

export interface BookmarkOptions {
  /** Origin of the dashboard that made the bookmark; only its messages are accepted. */
  dashboard: string;
  /** The project's config URL, for saved code when the dashboard isn't connected. */
  config: string;
  /** How long to wait for the dashboard tab before falling back to saved code. */
  waitMs?: number;
  /** How often to check for newly saved code, in saved mode. */
  pollMs?: number;
}

const HELP =
  'Open this page from Splitcraft with "Preview on site", then click the bookmark again.';

/**
 * Started by the "Splitcraft preview" bookmark on a page without the snippet.
 * 1. Live: the dashboard tab that opened this page sends the variants, including unsaved
 *    edits, and every later edit.
 * 2. Saved: otherwise the preview link's token and variant (query string or hash, which
 *    survives redirects) load the saved code from the config, checked again every few
 *    seconds.
 */
export function bootBookmark(api: PreviewApi, o: BookmarkOptions): () => void {
  const opener = window.opener as Window | null;
  let state: PreviewState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const show = (next: PreviewState, onAction: (a: PreviewAction) => void) => {
    if (!state) api.start(next, { onAction });
    else if (api.update(next) === 'rerun') api.rerun();
    state = next;
  };

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    removeEventListener('message', onMessage);
    api.stop();
  };

  // Live mode.
  const toDashboard = (a: PreviewAction) => {
    if (a.type === 'stop') stop();
    opener?.postMessage({ source: 'splitcraft-preview', ...a }, o.dashboard);
  };
  const onMessage = (e: MessageEvent) => {
    const d = e.data as { source?: string; type?: string; state?: PreviewState } | null;
    if (e.origin !== o.dashboard || e.source !== opener || d?.source !== 'splitcraft-dashboard')
      return;
    if (d.type === 'stop') stop();
    else if (d.type === 'state' && d.state) {
      clearTimeout(timer);
      show({ ...d.state, source: 'live' }, toDashboard);
    }
  };
  addEventListener('message', onMessage);
  try {
    opener?.postMessage({ source: 'splitcraft-preview', type: 'hello' }, o.dashboard);
  } catch {
    // The opener is gone or cut off (Cross-Origin-Opener-Policy).
  }

  // Saved mode.
  const params = new URLSearchParams(`${location.search.slice(1)}&${location.hash.slice(1)}`);
  let token = params.get(PREVIEW_PARAM);
  let forced = parseForce(params.get(FORCE_PARAM));
  try {
    if (token) sessionStorage.setItem(PREVIEW_PARAM, token);
    else token = sessionStorage.getItem(PREVIEW_PARAM);
    if (!Object.keys(forced).length)
      forced = parseForce(sessionStorage.getItem('splitcraft_preview_force'));
    else sessionStorage.setItem('splitcraft_preview_force', params.get(FORCE_PARAM)!);
  } catch {
    // Storage blocked: the link's parameters only.
  }
  const [experimentKey, forcedVariant] = Object.entries(forced)[0] ?? [];

  const fromConfig = async (variantKey?: string): Promise<void> => {
    if (stopped) return;
    if (!token || !experimentKey) {
      api.start({
        experimentKey: '',
        experimentName: '',
        variants: [],
        variantKey: '',
        source: 'saved',
      });
      api.error(HELP);
      return;
    }
    const url = new URL(o.config);
    url.searchParams.set('preview', token);
    try {
      const res = await fetch(url.href, { credentials: 'omit', cache: 'no-store' });
      const config = (await res.json()) as {
        experiments?: Array<{ key: string; name: string; variants: PreviewVariant[] }>;
      };
      const exp = config.experiments?.find((e) => e.key === experimentKey);
      if (!exp) throw new Error('not found');
      const onAction = (a: PreviewAction) => {
        if (a.type === 'stop') stop();
        else if (a.type === 'switch') void fromConfig(a.variantKey);
      };
      show(
        {
          experimentKey,
          experimentName: exp.name,
          variants: exp.variants,
          variantKey: variantKey ?? state?.variantKey ?? forcedVariant!,
          source: 'saved',
        },
        onAction,
      );
    } catch {
      if (!state) {
        api.start({
          experimentKey,
          experimentName: '',
          variants: [],
          variantKey: '',
          source: 'saved',
        });
        api.error(`Couldn't load experiment "${experimentKey}". ${HELP}`);
        return;
      }
    }
    clearTimeout(timer);
    timer = setTimeout(() => void fromConfig(), o.pollMs ?? 3000);
  };

  timer = setTimeout(() => void fromConfig(), opener ? (o.waitMs ?? 1500) : 0);
  return stop;
}
