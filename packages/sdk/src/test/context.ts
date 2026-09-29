import type { TargetingContext } from '../targeting/types';

export const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/** A returning desktop visitor from the UK on the home page; override what a test needs. */
export function makeContext(overrides: DeepPartial<TargetingContext> = {}): TargetingContext {
  const base: TargetingContext = {
    url: 'https://mytrips.dev/',
    now: NOW,
    visitor: {
      isNew: false,
      sessionId: 's_current',
      sessionNumber: 3,
      pagesViewedThisSession: 2,
      history: [],
    },
    device: { type: 'desktop', screenWidth: 1440 },
    country: 'GB',
    utm: { first: {}, last: {} },
    sourceType: 'direct',
    cookies: {},
    dataLayer: [],
    global: {},
  };
  return {
    ...base,
    ...overrides,
    visitor: { ...base.visitor, ...overrides.visitor },
    device: { ...base.device, ...overrides.device },
    utm: { ...base.utm, ...overrides.utm },
  } as TargetingContext;
}
