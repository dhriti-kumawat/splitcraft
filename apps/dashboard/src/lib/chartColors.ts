// Variant colours, used everywhere a variant appears (lists, bars, chips, charts), in fixed
// order: Control, B, C, D. They match --variant-{a,b,c,d} in design/tokens.css. Checked
// with the dataviz palette validator (lightness band, chroma floor, CVD separation,
// normal-vision separation, contrast):
//   node validate_palette.js "#6489C8,#0F8F6A,#C28718,#9A50AC" --mode light  → all PASS.
export const SERIES = ['#6489C8', '#0F8F6A', '#C28718', '#9A50AC'] as const;

/** Soft fill and dark text for each variant's chip, in the same order. */
export const SERIES_SOFT = ['#E8ECF3', '#E4F1EC', '#FBEFD9', '#F3E8F6'] as const;
export const SERIES_TEXT = ['#2C4268', '#0A4E40', '#6B4100', '#5E2A6B'] as const;

/** Rows past the fourth (MVT combinations) get a neutral swatch and stay out of charts. */
export const seriesColor = (i: number): string => SERIES[i] ?? '#8A918B';

/** A variant's strong colour, chip fill and chip text; past the fourth, neutral greys. */
export const variantColors = (i: number) => ({
  line: seriesColor(i),
  soft: SERIES_SOFT[i] ?? '#EEF0EB',
  text: SERIES_TEXT[i] ?? '#3F4540',
});

/**
 * Most variants an A/B or split URL test can have: Control plus keys b to z. Charts show
 * Control and the three leading variants, so every charted series keeps a validated colour.
 */
export const MAX_VARIANTS = 26;
