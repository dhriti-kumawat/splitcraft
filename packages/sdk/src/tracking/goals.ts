import { onRouteChange } from '../router';
import { matchUrl } from '../targeting/match';
import type { UrlRule } from '../targeting/types';

export interface ClickGoal {
  key: string;
  /** CSS selector list; a comma means any of them. */
  selector: string;
  /** Count only the first click per page. */
  firstPerPage?: boolean;
  /** Also send `<key>:view` once per page when a matching element is seen (click-through rate). */
  views?: boolean;
  /** Send seconds since the page loaded as the value of each page's first click. */
  timing?: boolean;
}

export interface PageviewGoal {
  key: string;
  url: UrlRule;
}

/**
 * One delegated, capture-phase listener on `document`, so elements added later
 * (SPA re-renders) are tracked and sites that stop propagation can't hide clicks.
 * Keyboard activation (Enter on links and buttons) fires `click`, so it is covered.
 */
export function trackClicks(
  goals: ClickGoal[],
  track: (key: string, value?: number) => void,
): () => void {
  const fired = new Set<string>();
  let page = location.href;
  // Time origin of the current page: load, or the last SPA navigation.
  let start = 0;
  const stopRoutes = onRouteChange(() => {
    start = performance.now();
  });

  const onClick = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (location.href !== page) {
      page = location.href;
      fired.clear();
    }
    for (const goal of goals) {
      const first = !fired.has(goal.key);
      if (goal.firstPerPage && !first) continue;
      if (!closest(target, goal.selector)) continue;
      fired.add(goal.key);
      if (goal.timing && first) track(goal.key, Math.round((performance.now() - start) / 100) / 10);
      else track(goal.key);
    }
  };

  document.addEventListener('click', onClick, true);
  return () => {
    stopRoutes();
    document.removeEventListener('click', onClick, true);
  };
}

/**
 * For click-through rate: send `<key>:view` once per page, the first time an element
 * matching the goal's selector is at least half in view. Elements added later (SPA
 * re-renders, lazy content) are picked up by a debounced MutationObserver.
 */
export function trackViews(goals: ClickGoal[], track: (key: string) => void): () => void {
  const withViews = goals.filter((g) => g.views);
  if (!withViews.length || typeof IntersectionObserver === 'undefined') return () => {};
  const seen = new Set<string>();
  let watched = new WeakSet<Element>();

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const goal of withViews) {
          if (seen.has(goal.key) || !matches(entry.target, goal.selector)) continue;
          seen.add(goal.key);
          track(`${goal.key}:view`);
        }
      }
    },
    { threshold: 0.5 },
  );

  const scan = (): void => {
    for (const goal of withViews) {
      if (seen.has(goal.key)) continue;
      let els: NodeListOf<Element>;
      try {
        els = document.querySelectorAll(goal.selector);
      } catch {
        continue;
      }
      els.forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const mo = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 200);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  scan();
  const stopRoutes = onRouteChange(() => {
    // A new page: count views again, including elements already on screen.
    seen.clear();
    watched = new WeakSet();
    io.disconnect();
    scan();
  });

  return () => {
    clearTimeout(timer);
    stopRoutes();
    mo.disconnect();
    io.disconnect();
  };
}

/** Fire a goal on every page view (including SPA navigations) whose URL matches. */
export function trackPageviews(goals: PageviewGoal[], track: (key: string) => void): () => void {
  const check = (url: string): void => {
    for (const goal of goals) if (matchUrl(url, goal.url)) track(goal.key);
  };
  check(location.href);
  return onRouteChange(check);
}

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function closest(el: Element, selector: string): Element | null {
  try {
    return el.closest(selector);
  } catch {
    return null;
  }
}

export interface CustomGoal {
  key: string;
  /** Tracker code; calls splitcraft.trackEvent(key, props) when the action happens. */
  code: string;
  /** Pages to run on (ORed). None means every page. */
  pages?: UrlRule[];
}

/**
 * Run custom JS trackers once per page (and after each SPA navigation) on their pages,
 * with the splitcraft helpers. Errors are caught so a broken tracker can't break the site.
 */
export function runCustomTrackers(goals: CustomGoal[], api: Record<string, unknown>): () => void {
  const run = (url: string): void => {
    for (const goal of goals) {
      if (goal.pages?.length && !goal.pages.some((rule) => matchUrl(url, rule))) continue;
      try {
        new Function('splitcraft', goal.code)(api);
      } catch (err) {
        console.error(`[splitcraft] tracker ${goal.key}:`, err);
      }
    }
  };
  run(location.href);
  return onRouteChange(run);
}
