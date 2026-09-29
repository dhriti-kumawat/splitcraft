import type { QaPanelModule } from './types';

declare global {
  interface Window {
    splitcraftQa?: QaPanelModule;
  }
}

/**
 * Load the QA panel bundle (`splitcraft-qa.iife.js`) with a script tag. It is a
 * separate file so visitors who are not in QA mode never download it.
 */
export function loadQaPanel(src: string): Promise<QaPanelModule> {
  return new Promise((resolve, reject) => {
    if (window.splitcraftQa) {
      resolve(window.splitcraftQa);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () =>
      window.splitcraftQa
        ? resolve(window.splitcraftQa)
        : reject(new Error('[splitcraft] QA panel did not register'));
    script.onerror = () => reject(new Error(`[splitcraft] Could not load ${src}`));
    document.head.appendChild(script);
  });
}
