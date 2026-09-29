import { onRouteChange } from '../router';
import { matchUrl } from '../targeting/match';
import type { UrlRule } from '../targeting/types';

export interface ClickGoal {
  key: string;
  /** CSS selector list; a comma means any of them. */
  selector: string;
  /** Count only the first click per page. */
  firstPerPage?: boolean;
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
export function trackClicks(goals: ClickGoal[], track: (key: string) => void): () => void {
  const fired = new Set<string>();
  let page = location.href;

  const onClick = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (location.href !== page) {
      page = location.href;
      fired.clear();
    }
    for (const goal of goals) {
      if (goal.firstPerPage && fired.has(goal.key)) continue;
      if (!closest(target, goal.selector)) continue;
      fired.add(goal.key);
      track(goal.key);
    }
  };

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

/** Fire a goal on every page view (including SPA navigations) whose URL matches. */
export function trackPageviews(goals: PageviewGoal[], track: (key: string) => void): () => void {
  const check = (url: string): void => {
    for (const goal of goals) if (matchUrl(url, goal.url)) track(goal.key);
  };
  check(location.href);
  return onRouteChange(check);
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
  /** Tracker code; calls splitly.trackEvent(key, props) when the action happens. */
  code: string;
  /** Pages to run on (ORed). None means every page. */
  pages?: UrlRule[];
}

/**
 * Run custom JS trackers once per page (and after each SPA navigation) on their pages,
 * with the splitly helpers. Errors are caught so a broken tracker can't break the site.
 */
export function runCustomTrackers(goals: CustomGoal[], api: Record<string, unknown>): () => void {
  const run = (url: string): void => {
    for (const goal of goals) {
      if (goal.pages?.length && !goal.pages.some((rule) => matchUrl(url, rule))) continue;
      try {
        new Function('splitly', goal.code)(api);
      } catch (err) {
        console.error(`[splitly] tracker ${goal.key}:`, err);
      }
    }
  };
  run(location.href);
  return onRouteChange(run);
}
