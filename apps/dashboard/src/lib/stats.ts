// Experiment statistics (PRODUCT_SPEC §6). Pure functions, no dependencies.

/** Standard normal CDF, via the Abramowitz & Stegun 7.1.26 erf approximation (error < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Inverse standard normal CDF (Acklam's algorithm, relative error < 1.2e-9). */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError('p must be between 0 and 1');
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472,
    2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373,
    4.37466414146497, 2.93816398269878,
  ];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

/** ln Γ(x), Lanczos approximation (g = 7). */
export function logGamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let sum = coef[0]!;
  for (let i = 1; i < g + 2; i++) sum += coef[i]! / (x + i);
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

export interface Arm {
  visitors: number;
  conversions: number;
}

const rate = (a: Arm) => (a.visitors > 0 ? a.conversions / a.visitors : 0);

export interface Comparison {
  controlRate: number;
  variantRate: number;
  /** Relative uplift, e.g. 0.097 for +9.7%. */
  uplift: number;
  /** 95% range of the relative uplift. */
  upliftLow: number;
  upliftHigh: number;
  /** Two-proportion z-test. */
  z: number;
  pValue: number;
  /** Bayesian P(variant beats control), Beta(1,1) priors. */
  chanceToWin: number;
}

/**
 * Compare a variant with control on a conversion metric.
 * The uplift range is the unpooled 95% interval of the difference, relative to control.
 */
export function compareConversion(control: Arm, variant: Arm, confidence = 0.95): Comparison {
  const p1 = rate(control);
  const p2 = rate(variant);
  const diff = p2 - p1;
  const zc = normalQuantile(1 - (1 - confidence) / 2);
  const seDiff = Math.sqrt(
    (p1 * (1 - p1)) / Math.max(control.visitors, 1) +
      (p2 * (1 - p2)) / Math.max(variant.visitors, 1),
  );
  const pooled =
    (control.conversions + variant.conversions) / Math.max(control.visitors + variant.visitors, 1);
  const sePooled = Math.sqrt(
    pooled * (1 - pooled) * (1 / Math.max(control.visitors, 1) + 1 / Math.max(variant.visitors, 1)),
  );
  const z = sePooled > 0 ? diff / sePooled : 0;
  return {
    controlRate: p1,
    variantRate: p2,
    uplift: p1 > 0 ? diff / p1 : 0,
    upliftLow: p1 > 0 ? (diff - zc * seDiff) / p1 : 0,
    upliftHigh: p1 > 0 ? (diff + zc * seDiff) / p1 : 0,
    z,
    pValue: 2 * (1 - normalCdf(Math.abs(z))),
    chanceToWin: chanceToBeat(control, variant),
  };
}

/**
 * Exact P(p_variant > p_control) for Beta(1 + conversions, 1 + failures) posteriors
 * (Evan Miller's closed form). Falls back to a normal approximation above 50,000
 * conversions, where the two agree to many decimals.
 */
export function chanceToBeat(control: Arm, variant: Arm): number {
  const aA = 1 + control.conversions;
  const bA = 1 + control.visitors - control.conversions;
  const aB = 1 + variant.conversions;
  const bB = 1 + variant.visitors - variant.conversions;
  if (aB > 50_000) {
    const mean = (a: number, b: number) => a / (a + b);
    const variance = (a: number, b: number) => (a * b) / ((a + b) ** 2 * (a + b + 1));
    const z = (mean(aB, bB) - mean(aA, bA)) / Math.sqrt(variance(aA, bA) + variance(aB, bB));
    return normalCdf(z);
  }
  let total = 0;
  const base = logBeta(aA, bA);
  for (let i = 0; i < aB; i++) {
    total += Math.exp(logBeta(aA + i, bA + bB) - Math.log(bB + i) - logBeta(1 + i, bB) - base);
  }
  return Math.min(1, Math.max(0, total));
}

/** Upper tail of the chi-square distribution with k degrees of freedom (k ≤ 10 is plenty here). */
export function chiSquarePValue(x: number, k: number): number {
  if (x <= 0) return 1;
  // Regularised upper incomplete gamma Q(k/2, x/2) by series / continued fraction.
  const s = k / 2;
  const t = x / 2;
  if (t < s + 1) {
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= t / (s + n);
      sum += term;
      if (term < sum * 1e-15) break;
    }
    return 1 - sum * Math.exp(-t + s * Math.log(t) - logGamma(s));
  }
  let b = t + 1 - s;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-t + s * Math.log(t) - logGamma(s)) * h;
}

export interface SrmResult {
  chiSquare: number;
  pValue: number;
  /** True when p < 0.01: the split is off by more than chance explains. */
  mismatch: boolean;
}

/** Sample ratio mismatch: do observed visitors per variant match the planned weights? */
export function srm(visitors: number[], weights: number[]): SrmResult {
  const total = visitors.reduce((a, b) => a + b, 0);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || weightSum === 0 || visitors.length < 2) {
    return { chiSquare: 0, pValue: 1, mismatch: false };
  }
  let chi = 0;
  visitors.forEach((observed, i) => {
    const expected = (total * (weights[i] ?? 0)) / weightSum;
    if (expected > 0) chi += (observed - expected) ** 2 / expected;
  });
  const pValue = chiSquarePValue(chi, visitors.length - 1);
  return { chiSquare: chi, pValue, mismatch: pValue < 0.01 };
}

/**
 * Visitors needed per variant to detect a relative lift `mde` on `baseline`
 * (two-sided, default 95% confidence and 80% power).
 */
export function sampleSizePerVariant(
  baseline: number,
  mde: number,
  { confidence = 0.95, power = 0.8 } = {},
): number {
  const p1 = baseline;
  const p2 = baseline * (1 + mde);
  if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1 || mde === 0) return Infinity;
  const za = normalQuantile(1 - (1 - confidence) / 2);
  const zb = normalQuantile(power);
  const pBar = (p1 + p2) / 2;
  const n =
    (za * Math.sqrt(2 * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 /
    (p2 - p1) ** 2;
  return Math.ceil(n);
}
