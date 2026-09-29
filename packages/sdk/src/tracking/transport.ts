export interface TrackedEvent {
  /** `ping`: one per session, with what reach estimates need (see sessionPing). */
  type: 'exposure' | 'goal' | 'ping';
  /** Goal / event key. */
  key?: string;
  experimentKey?: string;
  variantKey?: string;
  value?: number;
  props?: Record<string, unknown>;
  url: string;
  visitorId: string;
  /** Epoch ms. */
  at: number;
}

export interface QueueOptions {
  endpoint: string;
  projectKey: string;
  /** Send as soon as this many events are waiting. Default 20. */
  maxBatch?: number;
  /** Otherwise send this long after the first waiting event. Default 1000 ms. */
  flushMs?: number;
}

export interface EventQueue {
  push(event: TrackedEvent): void;
  flush(): void;
  /** Send what is waiting and stop listening for page hide. */
  stop(): void;
}

/**
 * Batch events and send them together. Anything still waiting is sent when the
 * page is hidden or unloaded, which is when sendBeacon is most useful.
 */
export function createQueue(opts: QueueOptions): EventQueue {
  const maxBatch = opts.maxBatch ?? 20;
  const flushMs = opts.flushMs ?? 1000;
  let buffer: TrackedEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): void => {
    clearTimeout(timer);
    timer = undefined;
    if (buffer.length === 0) return;
    const events = buffer;
    buffer = [];
    send(opts.endpoint, JSON.stringify({ projectKey: opts.projectKey, events }));
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') flush();
  };

  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    push(event) {
      buffer.push(event);
      if (buffer.length >= maxBatch) flush();
      else timer ??= setTimeout(flush, flushMs);
    },
    flush,
    stop() {
      removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    },
  };
}

// text/plain keeps both requests "simple", so the browser sends no CORS preflight.
const BODY_TYPE = 'text/plain;charset=UTF-8';

/** Send with navigator.sendBeacon, falling back to fetch with keepalive. Never throws. */
export function send(endpoint: string, body: string): void {
  try {
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: BODY_TYPE }))) return;
  } catch {
    // Some browsers throw instead of returning false.
  }
  try {
    fetch(endpoint, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': BODY_TYPE },
    }).catch(() => {});
  } catch {
    // No fetch: drop the batch rather than break the page.
  }
}
