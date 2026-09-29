/** Push to `window.dataLayer`, creating it if needed, so GTM / GA4 see Splitly events too. */
export function pushDataLayer(entry: Record<string, unknown>): void {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    (w.dataLayer ??= []).push(entry);
  } catch {
    // A site that froze or replaced dataLayer must not break tracking.
  }
}
