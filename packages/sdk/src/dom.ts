/**
 * Resolve with the first element matching `selector`, waiting up to `timeoutMs`
 * for it to be added. Resolves `null` on timeout or an invalid selector.
 */
export function waitForSelector(selector: string, timeoutMs: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = query(selector);
    if (existing || timeoutMs <= 0 || typeof MutationObserver === 'undefined') {
      resolve(existing);
      return;
    }

    const finish = (el: Element | null): void => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };
    const observer = new MutationObserver(() => {
      const el = query(selector);
      if (el) finish(el);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

function query(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
