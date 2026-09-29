const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** 56400 → "56.4K" style, lower-cased like the designs ("56.4k"). */
export function compactNumber(n: number): string {
  return compact.format(n).replace('K', 'k');
}
