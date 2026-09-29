import type { DeviceType, SourceType, TargetingContext, UtmParam } from './targeting/types';
import { createVisitorId } from './visitor';

const STORAGE_KEY = 'splitcraft_state';
const SESSION_MS = 30 * 60 * 1000;
const HISTORY_MAX = 50;
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000;
const UTM_PARAMS: UtmParam[] = ['source', 'medium', 'campaign', 'term', 'content'];

type Utm = Partial<Record<UtmParam, string>>;

/** Everything Splitcraft remembers about a visitor between page loads. Short keys keep it small. */
export interface VisitorState {
  /** Current session. */
  s?: { id: string; n: number; at: number; p: number; src: SourceType };
  /** Page history: [url, epoch ms]. */
  h: Array<[string, number]>;
  /** Last exposure per experiment: [epoch ms, session id]. */
  x: Record<string, [number, string]>;
  /** First-touch and last-touch UTM params. */
  u: { f: Utm; l: Utm };
}

export function loadState(): VisitorState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as VisitorState | null;
    if (saved && Array.isArray(saved.h) && saved.x && saved.u) return saved;
  } catch {
    // Blocked storage or corrupted JSON: start fresh.
  }
  return { h: [], x: {}, u: { f: {}, l: {} } };
}

export function saveState(state: VisitorState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: targeting falls back to per-page state.
  }
}

/**
 * Record a page view: start a new session after 30 minutes of inactivity,
 * count pages, keep 30 days / 50 entries of history and first/last-touch UTMs.
 */
export function recordPageview(
  state: VisitorState,
  url: string,
  referrer: string,
  now: number,
): void {
  const utm = readUtm(url);
  if (Object.keys(utm).length > 0) {
    state.u.l = utm;
    if (Object.keys(state.u.f).length === 0) state.u.f = utm;
  }

  const s = state.s;
  if (!s || now - s.at > SESSION_MS) {
    state.s = {
      id: createVisitorId(),
      n: (s?.n ?? 0) + 1,
      at: now,
      p: 0,
      src: classifySource(referrer, utm, hostOf(url)),
    };
  }
  state.s!.p++;
  state.s!.at = now;

  state.h.push([url, now]);
  state.h = state.h.filter(([, at]) => now - at <= HISTORY_MS).slice(-HISTORY_MAX);
}

export function recordExposure(state: VisitorState, experimentKey: string, now: number): void {
  state.x[experimentKey] = [now, state.s?.id ?? ''];
}

/** Snapshot the browser and stored state for the targeting evaluator. */
export function buildContext(
  state: VisitorState,
  experimentKey: string,
  country: string | undefined,
  now: number,
): TargetingContext {
  const s = state.s ?? { id: '', n: 1, at: now, p: 1, src: 'direct' as const };
  const exposure = state.x[experimentKey];
  const w = window as unknown as Record<string, unknown> & { dataLayer?: unknown[] };
  return {
    url: location.href,
    now,
    visitor: {
      isNew: s.n === 1,
      sessionId: s.id,
      sessionNumber: s.n,
      pagesViewedThisSession: s.p,
      history: state.h.map(([url, at]) => ({ url, at })),
    },
    device: { type: deviceType(navigator.userAgent), screenWidth: screen.width },
    country,
    utm: { first: state.u.f, last: state.u.l },
    sourceType: s.src,
    cookies: readCookies(),
    dataLayer: Array.isArray(w.dataLayer) ? w.dataLayer : [],
    global: w,
    exposure: exposure && { lastAt: exposure[0], lastSessionId: exposure[1] },
  };
}

export function deviceType(ua: string): DeviceType {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia)\./;
const SOCIAL =
  /(^|\.)(facebook|instagram|linkedin|pinterest|reddit|youtube|tiktok|twitter|x)\.com$|(^|\.)t\.co$/;

export function classifySource(referrer: string, utm: Utm, host: string): SourceType {
  const medium = (utm.medium ?? '').toLowerCase();
  if (/cpc|ppc|paid|display|cpm/.test(medium)) return 'paid';
  if (medium === 'email') return 'email';
  if (medium === 'social') return 'social';
  const ref = hostOf(referrer);
  if (!ref || ref === host) return utm.source ? 'referral' : 'direct';
  if (SEARCH.test(ref)) return 'organic';
  if (SOCIAL.test(ref)) return 'social';
  return 'referral';
}

function readUtm(url: string): Utm {
  const utm: Utm = {};
  try {
    const params = new URL(url).searchParams;
    for (const p of UTM_PARAMS) {
      const v = params.get(`utm_${p}`);
      if (v) utm[p] = v;
    }
  } catch {
    // Invalid URL: no UTMs.
  }
  return utm;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function readCookies(): Record<string, string> {
  const cookies: Record<string, string> = {};
  try {
    for (const part of document.cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq > 0) cookies[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    }
  } catch {
    // Cookies blocked or a malformed value.
  }
  return cookies;
}

/**
 * What the session ping carries: the traits reach estimates can check without the page
 * (device, screen, source, new / returning, session number, first- and last-touch UTMs).
 * Short keys keep the event small.
 */
export function sessionPing(
  state: VisitorState,
  userAgent: string,
  screenWidth: number,
  country?: string,
): Record<string, unknown> {
  const s = state.s;
  return {
    d: deviceType(userAgent),
    w: screenWidth,
    s: s?.src ?? 'direct',
    n: s?.n ?? 1,
    ...(Object.keys(state.u.f).length && { uf: state.u.f }),
    ...(Object.keys(state.u.l).length && { ul: state.u.l }),
    ...(country && { c: country }),
  };
}
