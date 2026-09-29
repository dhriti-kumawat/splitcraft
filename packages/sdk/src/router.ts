type RouteListener = (url: string) => void;

const listeners = new Set<RouteListener>();
let installed = false;
let lastUrl = '';

/**
 * Call `fn` with the new URL after every SPA navigation (pushState, replaceState,
 * back/forward). Returns an unsubscribe function. Same-URL updates are ignored.
 */
export function onRouteChange(fn: RouteListener): () => void {
  install();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function install(): void {
  if (installed) return;
  installed = true;
  lastUrl = location.href;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  }
  addEventListener('popstate', notify);
}

function notify(): void {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;
  for (const fn of [...listeners]) {
    try {
      fn(url);
    } catch {
      // One broken listener must not stop the others.
    }
  }
}
