/**
 * Split URL tests: where to send a visitor bucketed into a variant with its own URL.
 * Keeps the current query string (UTM tags, QA force and preview params) and hash, with
 * the variant URL's own params winning. Returns null when the visitor is already on that
 * page, so a variant page that also matches the test's WHERE rules never loops.
 */
export function splitTarget(variantUrl: string, current: string): string | null {
  const to = new URL(variantUrl, current);
  const from = new URL(current);
  if (to.origin === from.origin && to.pathname === from.pathname) return null;
  from.searchParams.forEach((v, k) => {
    if (!to.searchParams.has(k)) to.searchParams.set(k, v);
  });
  to.hash ||= from.hash;
  return to.href;
}

/** Navigation, behind an object so tests can replace it (jsdom can't stub location). */
export const nav = { go: (url: string): void => location.replace(url) };
