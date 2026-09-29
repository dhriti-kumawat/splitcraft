import type { QaPanelModule } from './types';

declare global {
  interface Window {
    splitlyQa?: QaPanelModule;
  }
}

/**
 * Load the QA panel bundle (`splitly-qa.iife.js`) with a script tag. It is a
 * separate file so visitors who are not in QA mode never download it.
 */
export function loadQaPanel(src: string): Promise<QaPanelModule> {
  return new Promise((resolve, reject) => {
    if (window.splitlyQa) {
      resolve(window.splitlyQa);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () =>
      window.splitlyQa
        ? resolve(window.splitlyQa)
        : reject(new Error('[splitly] QA panel did not register'));
    script.onerror = () => reject(new Error(`[splitly] Could not load ${src}`));
    document.head.appendChild(script);
  });
}
