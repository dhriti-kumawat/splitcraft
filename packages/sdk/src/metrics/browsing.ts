import { onRouteChange } from '../router';
import { BROWSING_KEYS, type BrowsingKind } from './types';

const ENGAGED_MS = 10_000;
const MAX_PAGE_SECONDS = 1800;

/**
 * Browsing goals, sent from the page:
 * - engaged: once per session, from the 2nd page or after 10 s on a visible page
 *   (the opposite of a bounce);
 * - pages: one per page view (pages per visitor);
 * - time: seconds the page was visible, when it's left (time on site, capped at 30 min
 *   a page);
 * - return: once, at the start of a returning visitor's session.
 */
export function trackBrowsing(
  kinds: BrowsingKind[],
  track: (key: string, props?: { value?: number }) => void,
  session: () => { n: number; p: number },
): () => void {
  const on = (k: BrowsingKind) => kinds.includes(k);
  const sessionFlag = (name: string): boolean => {
    const key = `splitcraft_${name}_${session().n}`;
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked: may count twice in one session.
    }
    return true;
  };

  let visibleMs = 0;
  let since = document.visibilityState === 'visible' ? performance.now() : -1;
  let engagedTimer: ReturnType<typeof setTimeout> | undefined;

  const engaged = () => on('engaged') && sessionFlag('engaged') && track(BROWSING_KEYS.engaged);
  const page = (): void => {
    const s = session();
    if (on('pages')) track(BROWSING_KEYS.pages);
    if (on('return') && s.n > 1 && s.p <= 1 && sessionFlag('return')) track(BROWSING_KEYS.return);
    if (s.p >= 2) engaged();
    clearTimeout(engagedTimer);
    engagedTimer = setTimeout(engaged, ENGAGED_MS);
  };
  const flushTime = (): void => {
    if (since >= 0) visibleMs += performance.now() - since;
    since = document.visibilityState === 'visible' ? performance.now() : -1;
    const seconds = Math.min(MAX_PAGE_SECONDS, Math.round(visibleMs / 1000));
    if (on('time') && seconds > 0) track(BROWSING_KEYS.time, { value: seconds });
    visibleMs = 0;
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') flushTime();
    else since = performance.now();
  };

  page();
  document.addEventListener('visibilitychange', onVisibility);
  const stopRoutes = onRouteChange(() => {
    flushTime();
    // The runtime records the new page view first, so the session count is current.
    setTimeout(page, 0);
  });
  return () => {
    clearTimeout(engagedTimer);
    stopRoutes();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
