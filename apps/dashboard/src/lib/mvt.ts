import type { MvtFactor, NewVariant } from '../data/api';
import { compareConversion, type Arm, type Comparison } from './stats';

/** Limits that keep every combination's share of traffic useful. */
export const MVT_LIMITS = { factors: 3, levels: 4, combinations: 16 } as const;

/** Number of combinations the sections make (the full factorial). */
export function combinationCount(factors: MvtFactor[]): number {
  return factors.reduce((n, f) => n * Math.max(f.levels.length, 1), 1);
}

/** Level index per section for a variant key: "control" is all originals, "v102" is 1, 0, 2. */
export function levelsOf(key: string, factorCount: number): number[] | null {
  if (key === 'control') return Array<number>(factorCount).fill(0);
  const m = /^v(\d+)$/.exec(key);
  if (!m || m[1]!.length !== factorCount) return null;
  return m[1]!.split('').map(Number);
}

/**
 * Every combination of the sections' versions as a variant, with equal weights. The first
 * version of each section is the original, so all-originals is Control. Each version's
 * code sits in its own block, so two versions can declare the same variable names.
 */
export function combinations(factors: MvtFactor[]): NewVariant[] {
  const combos = factors.reduce<number[][]>(
    (acc, f) => acc.flatMap((c) => f.levels.map((_, i) => [...c, i])),
    [[]],
  );
  const weight = Math.round((100 / combos.length) * 100) / 100;
  return combos.map((c) => {
    const picked = c.flatMap((l, i) =>
      l > 0 ? [{ f: factors[i]!, l: factors[i]!.levels[l]! }] : [],
    );
    return {
      key: c.every((l) => l === 0) ? 'control' : `v${c.join('')}`,
      name: picked.length
        ? picked.map(({ f, l }) => `${f.name}: ${l.name}`).join(' · ')
        : 'Control',
      weight,
      js: picked
        .filter(({ l }) => l.js.trim())
        .map(({ f, l }) => `// ${f.name}: ${l.name}\n{\n${l.js.trim()}\n}`)
        .join('\n\n'),
      css: picked
        .filter(({ l }) => l.css.trim())
        .map(({ f, l }) => `/* ${f.name}: ${l.name} */\n${l.css.trim()}`)
        .join('\n\n'),
    };
  });
}

export interface LevelEffect {
  factor: MvtFactor;
  levelIndex: number;
  arm: Arm;
  /** Against the section's original, pooled over the other sections. Null for the original. */
  comparison: Comparison | null;
}

/**
 * Main effects: each section version's visitors and conversions summed over every
 * combination that shows it, compared with the same section's original.
 */
export function mainEffects(
  factors: MvtFactor[],
  arms: Array<{ variantKey: string } & Arm>,
): LevelEffect[][] {
  return factors.map((factor, fi) => {
    const pooled = factor.levels.map<Arm>(() => ({ visitors: 0, conversions: 0 }));
    for (const a of arms) {
      const levels = levelsOf(a.variantKey, factors.length);
      const l = levels?.[fi];
      if (l === undefined || !pooled[l]) continue;
      pooled[l].visitors += a.visitors;
      pooled[l].conversions += a.conversions;
    }
    return pooled.map((arm, levelIndex) => ({
      factor,
      levelIndex,
      arm,
      comparison: levelIndex === 0 ? null : compareConversion(pooled[0]!, arm),
    }));
  });
}
