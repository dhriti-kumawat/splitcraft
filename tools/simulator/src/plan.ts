// Plans simulated traffic for demos: visitors are bucketed with the SDK's own
// assignVariant, then convert at the rates you choose. Every event is marked
// { simulated: true } so it can be told apart from real traffic and deleted.
import { assignVariant } from '../../../packages/sdk/src/bucketing';

export interface SimVariant {
  key: string;
  weight: number;
  /** Chance a visitor in this variant fires the goal, 0–1. */
  rate: number;
}

export interface SimOptions {
  projectId: string;
  experimentId: string;
  experimentKey: string;
  goalKey: string;
  variants: SimVariant[];
  visitors: number;
  /** Spread first exposures evenly over this many days, ending now. */
  days: number;
  /** Page the visitors land on, e.g. https://mytrips.dev/trips/norway. */
  url: string;
  seed?: number;
  trafficPct?: number;
  now?: number;
}

export interface SimEvent {
  project_id: string;
  visitor_id: string;
  experiment_id: string | null;
  variant_key: string | null;
  type: 'exposure' | 'goal';
  key: string | null;
  value: number | null;
  props: { simulated: true };
  url: string;
  created_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Small, fast, seedable PRNG (mulberry32) so a run can be repeated exactly. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function plan(o: SimOptions): SimEvent[] {
  const rnd = random(o.seed ?? 1);
  const now = o.now ?? Date.now();
  const start = now - o.days * DAY_MS;
  const events: SimEvent[] = [];
  const base = { project_id: o.projectId, props: { simulated: true as const }, url: o.url };

  for (let i = 0; i < o.visitors; i++) {
    const visitorId = `v_sim${(o.seed ?? 1).toString(36)}_${i.toString(36).padStart(6, '0')}`;
    const variantKey = assignVariant(visitorId, {
      experimentKey: o.experimentKey,
      trafficPct: o.trafficPct ?? 100,
      variants: o.variants,
    });
    if (!variantKey) continue;
    const exposedAt = start + ((i + rnd()) / o.visitors) * (now - start);
    events.push({
      ...base,
      visitor_id: visitorId,
      experiment_id: o.experimentId,
      variant_key: variantKey,
      type: 'exposure',
      key: null,
      value: null,
      created_at: new Date(exposedAt).toISOString(),
    });
    const variant = o.variants.find((v) => v.key === variantKey)!;
    if (rnd() < variant.rate) {
      // Converts within 30 minutes of the exposure, never in the future.
      const convertedAt = Math.min(now, exposedAt + rnd() * 30 * 60 * 1000);
      events.push({
        ...base,
        visitor_id: visitorId,
        experiment_id: null,
        variant_key: null,
        type: 'goal',
        key: o.goalKey,
        value: null,
        created_at: new Date(convertedAt).toISOString(),
      });
    }
  }
  return events;
}

/** "control=0.05,b=0.055" → { control: 0.05, b: 0.055 } */
export function parseRates(raw: string): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const part of raw.split(',')) {
    const [key, value] = part.split('=').map((s) => s.trim());
    const n = Number(value);
    if (!key || !(n >= 0 && n <= 1))
      throw new Error(`Bad rate "${part}". Use key=0.05 with a rate between 0 and 1.`);
    rates[key] = n;
  }
  return rates;
}
