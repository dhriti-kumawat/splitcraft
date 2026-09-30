import type { ExperimentType } from '../../data/api';

/** Labels and descriptions for the three test types, shared by the picker and badges. */
export const EXPERIMENT_TYPES: Record<
  ExperimentType,
  { label: string; short: string; description: string; example: string }
> = {
  ab: {
    label: 'A/B test',
    short: 'A/B',
    description: 'Change parts of a page with code and compare the versions against the original.',
    example: 'A new headline or a sticky Book button',
  },
  split_url: {
    label: 'Split URL test',
    short: 'Split URL',
    description:
      'Send visitors to different pages. Each variant is its own URL; the snippet redirects to it.',
    example: 'An old and a redesigned landing page',
  },
  mvt: {
    label: 'Multivariate test',
    short: 'MVT',
    description:
      'Change several sections at once. Every combination of their versions becomes a variant, so you see which mix wins.',
    example: '2 headlines × 3 hero images = 6 combinations',
  },
};
