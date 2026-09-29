import { injectStyles } from './helpers';

export const ANTIFLICKER_ID = 'splitly-antiflicker';
export const ANTIFLICKER_MAX_MS = 400;

/**
 * Hide the page while variants are applied, so visitors never see the original
 * flash first. The page is always shown again after `maxMs`, even if the SDK
 * stalls. Returns an idempotent `reveal` function.
 */
export function hidePage(maxMs = ANTIFLICKER_MAX_MS): () => void {
  const remove = injectStyles('body{opacity:0!important}', ANTIFLICKER_ID);
  let revealed = false;
  const reveal = (): void => {
    if (revealed) return;
    revealed = true;
    clearTimeout(timer);
    remove();
  };
  const timer = setTimeout(reveal, Math.min(maxMs, ANTIFLICKER_MAX_MS));
  return reveal;
}
