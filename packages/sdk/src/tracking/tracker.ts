import { pushDataLayer } from './dataLayer';
import type { EventQueue, TrackedEvent } from './transport';

export interface Tracker {
  /** Record that the visitor saw a variant. Sent once per page per experiment. */
  exposure(experimentKey: string, variantKey: string): boolean;
  trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void;
}

export function createTracker(queue: EventQueue, visitorId: string): Tracker {
  const exposed = new Set<string>();
  const base = () => ({ url: location.href, visitorId, at: Date.now() });

  return {
    exposure(experimentKey, variantKey) {
      const once = `${experimentKey}\n${location.href}`;
      if (exposed.has(once)) return false;
      exposed.add(once);
      queue.push({ type: 'exposure', experimentKey, variantKey, ...base() });
      pushDataLayer({ event: 'splitcraft_exposure', splitcraft: { experimentKey, variantKey } });
      return true;
    },

    trackEvent(key, props = {}) {
      if (typeof key !== 'string' || key === '') return;
      const { value, ...rest } = props;
      const event: TrackedEvent = { type: 'goal', key, ...base() };
      // Drop NaN / Infinity / non-numbers rather than poison sums.
      if (typeof value === 'number' && Number.isFinite(value)) event.value = value;
      if (Object.keys(rest).length > 0) event.props = rest;
      queue.push(event);
      pushDataLayer({ event: 'splitcraft_event', splitcraft: { key, value: event.value } });
    },
  };
}
