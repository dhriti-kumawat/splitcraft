import { loadGlobal } from '../load';
import type { MetricsModule } from '../metrics/types';
import type { QaPanelModule } from './types';

declare global {
  interface Window {
    splitcraftQa?: QaPanelModule;
    splitcraftMetrics?: MetricsModule;
  }
}

/**
 * Load the QA panel bundle (`splitcraft-qa.iife.js`). It is a separate file so visitors
 * who are not in QA mode never download it.
 */
export function loadQaPanel(src: string): Promise<QaPanelModule> {
  return loadGlobal<QaPanelModule>(src, 'splitcraftQa');
}
