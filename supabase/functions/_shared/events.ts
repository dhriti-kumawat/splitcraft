import type { IncomingEvent, Json } from './types.ts';

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_EVENTS = 50;
const MAX_PROPS_BYTES = 2048;
const PUBLIC_KEY = /^prj_[0-9a-f]{32}$/;
const VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;
const EVENT_KEY = /^[A-Za-z0-9_.:-]{1,100}$/;
const EXPERIMENT_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const VARIANT_KEY = /^[A-Za-z0-9_-]{1,32}$/;

export type ParsedBatch =
  { ok: true; projectKey: string; events: IncomingEvent[] } | { ok: false; error: string };

/**
 * Validate a batch from the SDK (text/plain JSON: `{ projectKey, events }`).
 * Invalid events are dropped one by one; only a malformed batch is rejected.
 */
export function parseBatch(body: string): ParsedBatch {
  if (body.length > MAX_BODY_BYTES) return { ok: false, error: 'body too large' };
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  if (!isObject(data)) return { ok: false, error: 'invalid batch' };
  const { projectKey, events } = data;
  if (typeof projectKey !== 'string' || !PUBLIC_KEY.test(projectKey)) {
    return { ok: false, error: 'invalid projectKey' };
  }
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    return { ok: false, error: `events must be 1–${MAX_EVENTS} items` };
  }
  return {
    ok: true,
    projectKey,
    events: events.map(cleanEvent).filter((e): e is IncomingEvent => e !== null),
  };
}

/** Keep only known, well-formed fields. Returns null when the event is unusable. */
export function cleanEvent(raw: unknown): IncomingEvent | null {
  if (!isObject(raw)) return null;
  const { type, visitorId, url } = raw;
  if (type !== 'exposure' && type !== 'goal' && type !== 'ping') return null;
  if (typeof visitorId !== 'string' || !VISITOR_ID.test(visitorId)) return null;
  if (typeof url !== 'string' || url.length > 2048 || !/^https?:\/\//.test(url)) return null;

  const event: IncomingEvent = { type, visitorId, url };
  if (type === 'exposure') {
    if (typeof raw.experimentKey !== 'string' || !EXPERIMENT_KEY.test(raw.experimentKey))
      return null;
    if (typeof raw.variantKey !== 'string' || !VARIANT_KEY.test(raw.variantKey)) return null;
    event.experimentKey = raw.experimentKey;
    event.variantKey = raw.variantKey;
  } else if (type === 'ping') {
    // Session ping: only small, known traits (see project_session_sample).
    if (!isObject(raw.props) || JSON.stringify(raw.props).length > MAX_PROPS_BYTES) return null;
    event.props = raw.props;
  } else {
    if (typeof raw.key !== 'string' || !EVENT_KEY.test(raw.key)) return null;
    event.key = raw.key;
    if (typeof raw.value === 'number' && Number.isFinite(raw.value)) event.value = raw.value;
    if (isObject(raw.props) && JSON.stringify(raw.props).length <= MAX_PROPS_BYTES) {
      event.props = raw.props;
    }
  }
  return event;
}

/** Hostname of an `Origin` header, or '' when missing or invalid. */
export function hostFromOrigin(origin: string | null): string {
  if (!origin) return '';
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
