// Content script on the Splitcraft dashboard: tells the page the extension is here and
// passes its requests to the service worker. Only runs on DASHBOARD_ORIGINS (manifest).
document.documentElement.dataset.splitcraftPreview = chrome.runtime.getManifest().version;

window.addEventListener('message', (e: MessageEvent) => {
  const d = e.data as { source?: string; id?: number; request?: unknown } | null;
  if (e.source !== window || d?.source !== 'splitcraft-dashboard' || typeof d.id !== 'number')
    return;
  chrome.runtime
    .sendMessage({ from: 'dashboard', request: d.request })
    .then(
      (reply: unknown) => reply,
      (err: unknown) => ({ ok: false, error: String(err) }),
    )
    .then((reply) =>
      window.postMessage({ source: 'splitcraft-extension', id: d.id, reply }, location.origin),
    );
});

chrome.runtime.onMessage.addListener((event: unknown) => {
  window.postMessage({ source: 'splitcraft-extension', event }, location.origin);
});
