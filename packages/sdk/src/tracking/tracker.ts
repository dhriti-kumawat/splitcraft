import { pushDataLayer } from './dataLayer';
import type { EventQueue, TrackedEvent } from './transport';

export interface Tracker {
  /** Record that the visitor saw a variant. Sent once per page per experiment. */
  exposure(experimentKey: string, variantKey: string): boolean;
  trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void;
  /** Session ping for reach estimates; not a goal, not sent to dataLayer. */
  ping(props: Record<string, unknown>): void;
}

/** `dataLayer`: push exposures and events to window.dataLayer for GTM / GA4 (default on). */
export function createTracker(queue: EventQueue, visitorId: string, dataLayer = true): Tracker {
  const exposed = new Set<string>();
  const base = () => ({ url: location.href, visitorId, at: Date.now() });

  return {
    exposure(experimentKey, variantKey) {
      const once = `${experimentKey}\n${location.href}`;
      if (exposed.has(once)) return false;
      exposed.add(once);
      queue.push({ type: 'exposure', experimentKey, variantKey, ...base() });
      if (dataLayer) {
        pushDataLayer({ event: 'splitcraft_exposure', splitcraft: { experimentKey, variantKey } });
      }
      return true;
    },

    ping(props) {
      queue.push({ type: 'ping', props, ...base() });
    },

    trackEvent(key, props = {}) {
      if (typeof key !== 'string' || key === '') return;
      const { value, ...rest } = props;
      const event: TrackedEvent = { type: 'goal', key, ...base() };
      // Drop NaN / Infinity / non-numbers rather than poison sums.
      if (typeof value === 'number' && Number.isFinite(value)) event.value = value;
      if (Object.keys(rest).length > 0) event.props = rest;
      queue.push(event);
      if (dataLayer)
        pushDataLayer({ event: 'splitcraft_event', splitcraft: { key, value: event.value } });
    },
  };
}
