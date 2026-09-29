import type { Vital } from './types';

type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean };
type EventTiming = PerformanceEntry & { interactionId?: number };

/**
 * Core Web Vitals for the page load, with the browser's PerformanceObserver (no library):
 * LCP (ms), INP (ms, the slowest interaction) and CLS (largest session window of layout
 * shifts). Sent once, as `vitals.<name>` goals, when the page is first hidden.
 */
export function trackVitals(
  vitals: Vital[],
  track: (key: string, props?: { value?: number }) => void,
): () => void {
  if (!vitals.length || typeof PerformanceObserver === 'undefined') return () => {};
  let lcp = 0;
  let inp = 0;
  let cls = 0;
  let window = 0;
  let windowStart = 0;
  let last = 0;
  const observers: PerformanceObserver[] = [];

  const observe = (type: string, fn: (e: PerformanceEntry) => void, extra = {}) => {
    try {
      const o = new PerformanceObserver((list) => list.getEntries().forEach(fn));
      o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      observers.push(o);
    } catch {
      // This browser doesn't report that entry type.
    }
  };

  if (vitals.includes('lcp')) observe('largest-contentful-paint', (e) => (lcp = e.startTime));
  if (vitals.includes('inp')) {
    observe(
      'event',
      (e) => {
        if ((e as EventTiming).interactionId) inp = Math.max(inp, e.duration);
      },
      { durationThreshold: 40 },
    );
  }
  if (vitals.includes('cls')) {
    observe('layout-shift', (e) => {
      const s = e as Shift;
      if (s.hadRecentInput) return;
      // A session window ends after a 1 s gap or 5 s in total.
      if (s.startTime - last > 1000 || s.startTime - windowStart > 5000) {
        window = 0;
        windowStart = s.startTime;
      }
      window += s.value;
      last = s.startTime;
      cls = Math.max(cls, window);
    });
  }

  let sent = false;
  const report = (): void => {
    if (sent || document.visibilityState !== 'hidden') return;
    sent = true;
    if (vitals.includes('lcp') && lcp > 0) track('vitals.lcp', { value: Math.round(lcp) });
    if (vitals.includes('inp') && inp > 0) track('vitals.inp', { value: Math.round(inp) });
    if (vitals.includes('cls')) track('vitals.cls', { value: Math.round(cls * 1000) / 1000 });
    stop();
  };
  const stop = (): void => {
    observers.forEach((o) => o.disconnect());
    document.removeEventListener('visibilitychange', report);
  };
  document.addEventListener('visibilitychange', report);
  return stop;
}
