// Content script in a previewed tab (isolated world): passes the preview panel's
// "switch variant" and "stop" to the service worker. Nothing else is accepted from the
// page, so a site can't send code through it.
if (!(window as unknown as { __splitcraftBridge?: boolean }).__splitcraftBridge) {
  (window as unknown as { __splitcraftBridge?: boolean }).__splitcraftBridge = true;
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { source?: string; type?: string; variantKey?: unknown } | null;
    if (e.source !== window || d?.source !== 'splitcraft-preview') return;
    if (d.type === 'switch' && typeof d.variantKey === 'string')
      void chrome.runtime.sendMessage({
        from: 'page',
        request: { type: 'switch', variantKey: d.variantKey },
      });
    else if (d.type === 'stop')
      void chrome.runtime.sendMessage({ from: 'page', request: { type: 'stop' } });
  });
}
