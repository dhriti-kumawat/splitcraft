// Series colours for variant charts, in fixed order (Control, B, C, D). Checked with the
// dataviz palette validator (lightness band, chroma floor, CVD separation, contrast):
//   node validate_palette.js "#355E9C,#D97A2B,#0B7A5E,#9C4FA8" --mode light  → all PASS.
// #355E9C is the nearest passing step to the brand's variant A (#3B5B8C), which reads
// grey in a chart (chroma below the floor).
export const SERIES = ['#355E9C', '#D97A2B', '#0B7A5E', '#9C4FA8'] as const;

/** Most variants an experiment can have, so every series keeps a validated colour. */
export const MAX_VARIANTS = SERIES.length;
