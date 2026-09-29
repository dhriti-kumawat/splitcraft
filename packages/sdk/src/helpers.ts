import { waitForSelector } from './dom';

export { onRouteChange } from './router';

const DEFAULT_WAIT_MS = 10_000;

/** Run `fn` with the first element matching `selector`, as soon as it exists. */
export function waitForElement(
  selector: string,
  fn: (el: Element) => void,
  opts: { timeout?: number } = {},
): void {
  void waitForSelector(selector, opts.timeout ?? DEFAULT_WAIT_MS).then((el) => {
    if (el) safeCall(() => fn(el));
  });
}

/** Run `fn` once, the first time `el` enters the viewport. */
export function onceInView(el: Element, fn: () => void): void {
  if (typeof IntersectionObserver === 'undefined') {
    safeCall(fn);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      safeCall(fn);
    }
  });
  observer.observe(el);
}

/**
 * Add a <style> element. Calling again with the same `id` replaces its CSS.
 * Returns a function that removes it.
 */
export function injectStyles(css: string, id?: string): () => void {
  const existing = id ? document.getElementById(id) : null;
  const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  if (id) style.id = id;
  style.setAttribute('data-splitcraft', '');
  style.textContent = css;
  if (!style.isConnected) (document.head ?? document.documentElement).appendChild(style);
  return () => style.remove();
}

function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.error('[splitcraft]', err);
  }
}
