import { hash32 } from './hash';

export const BUCKET_COUNT = 10_000;

export interface VariantWeight {
  key: string;
  /** Relative weight. Weights need not sum to 100; zero or negative means never served. */
  weight: number;
}

export interface Allocation {
  experimentKey: string;
  /** Share of matching visitors who enter the experiment, 0–100. */
  trafficPct: number;
  variants: VariantWeight[];
}

/** Map any string to a stable bucket in 0–9999. */
export function bucketOf(input: string): number {
  return hash32(input) % BUCKET_COUNT;
}

/**
 * Deterministically assign a visitor to a variant, or `null` when the visitor
 * falls outside the experiment's traffic share.
 *
 * Traffic and variant use separate hashes, so raising `trafficPct` only adds
 * new visitors; nobody already in the experiment changes variant.
 */
export function assignVariant(visitorId: string, allocation: Allocation): string | null {
  const { experimentKey, trafficPct, variants } = allocation;

  const trafficBucket = bucketOf(`${experimentKey}:traffic:${visitorId}`);
  if (trafficBucket >= Math.round(clamp(trafficPct, 0, 100) * 100)) return null;

  const eligible = variants.filter((v) => v.weight > 0);
  const total = eligible.reduce((sum, v) => sum + v.weight, 0);
  if (total <= 0) return null;

  // Position in [0, total), compared in integer-scaled space to avoid float drift.
  const scaled = bucketOf(`${experimentKey}:${visitorId}`) * total;
  let cumulative = 0;
  for (const v of eligible) {
    cumulative += v.weight;
    if (scaled < cumulative * BUCKET_COUNT) return v.key;
  }
  return eligible[eligible.length - 1]!.key;
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
