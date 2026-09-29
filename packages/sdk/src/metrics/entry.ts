// Entry for the separate metrics bundle (splitcraft-metrics.iife.js): browsing and Web
// Vitals goals. The runtime loads it only when a live experiment uses them, so most
// visitors never download it. The IIFE build assigns this to `window.splitcraftMetrics`.
import { trackBrowsing } from './browsing';
import type { MetricsModule } from './types';
import { trackVitals } from './vitals';

export const start: MetricsModule['start'] = ({ browsing, vitals, track, session }) => {
  const stops = [trackBrowsing(browsing, track, session), trackVitals(vitals, track)];
  return () => stops.forEach((s) => s());
};
