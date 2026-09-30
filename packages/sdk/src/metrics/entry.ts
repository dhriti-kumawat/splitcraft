// Entry for the separate metrics bundle (splitcraft-metrics.iife.js): browsing, Web
// Vitals, dataLayer and transaction goals. The runtime loads it only when a live experiment uses them, so most
// visitors never download it. The IIFE build assigns this to `window.splitcraftMetrics`.
import { trackBrowsing } from './browsing';
import { trackDataLayer } from './dataLayerGoals';
import type { MetricsModule } from './types';
import { trackVitals } from './vitals';

export const start: MetricsModule['start'] = ({
  browsing,
  vitals,
  datalayer,
  transactions,
  track,
  session,
}) => {
  const stops = [
    trackBrowsing(browsing, track, session),
    trackVitals(vitals, track),
    trackDataLayer(datalayer, transactions, track),
  ];
  return () => stops.forEach((s) => s());
};
