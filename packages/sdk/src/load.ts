/**
 * Load a separate SDK bundle with a script tag and wait for it to register itself on
 * `window[name]` (the QA panel and the metrics bundle).
 */
export function loadGlobal<T>(src: string, name: string): Promise<T> {
  const w = window as unknown as Record<string, T | undefined>;
  return new Promise((resolve, reject) => {
    if (w[name]) {
      resolve(w[name]!);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () =>
      w[name] ? resolve(w[name]!) : reject(new Error(`[splitcraft] ${src} did not register`));
    script.onerror = () => reject(new Error(`[splitcraft] Could not load ${src}`));
    document.head.appendChild(script);
  });
}
