// The extension's service worker: keeps a preview session per tab and injects the
// preview into the tab on every page load, before the page's own scripts run.
import {
  DASHBOARD_ORIGINS,
  type DashboardEvent,
  type DashboardRequest,
  type PageRequest,
  type PingReply,
  type PreviewState,
} from './protocol';
import { currentJs, hostAllowed, userScriptCode, type Session } from './sessions';

const key = (tabId: number) => `tab:${tabId}`;

async function getSession(tabId: number): Promise<Session | undefined> {
  const k = key(tabId);
  return (await chrome.storage.session.get(k))[k] as Session | undefined;
}
const setSession = (tabId: number, s: Session) => chrome.storage.session.set({ [key(tabId)]: s });
const dropSession = (tabId: number) => chrome.storage.session.remove(key(tabId));

async function allSessions(): Promise<Array<[number, Session]>> {
  const all = await chrome.storage.session.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith('tab:'))
    .map(([k, s]) => [Number(k.slice(4)), s as Session]);
}

/** chrome.userScripts works only after the user turns on "Allow user scripts". */
async function userScriptsReady(): Promise<boolean> {
  try {
    if (typeof chrome.userScripts?.execute !== 'function') return false;
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

async function inject(tabId: number, s: Session): Promise<void> {
  const target = { tabId };
  const external = await userScriptsReady();
  await chrome.scripting.executeScript({
    target,
    files: ['preview-bridge.js'],
    injectImmediately: true,
  });
  await chrome.scripting.executeScript({
    target,
    files: ['splitcraft-preview.iife.js'],
    world: 'MAIN',
    injectImmediately: true,
  });
  await chrome.scripting.executeScript({
    target,
    world: 'MAIN',
    injectImmediately: true,
    args: [s.state, external],
    func: (state: PreviewState, externalJs: boolean) => {
      const p = (
        window as unknown as { splitcraftPreview?: { start(s: unknown, o: unknown): void } }
      ).splitcraftPreview;
      p?.start(state, {
        externalJs,
        onAction: (a: object) =>
          window.postMessage({ source: 'splitcraft-preview', ...a }, location.origin),
      });
    },
  });
  const js = currentJs(s.state);
  if (external && js.trim()) {
    await chrome.userScripts.execute({
      target,
      js: [{ code: userScriptCode(js) }],
      world: 'MAIN',
      injectImmediately: true,
    });
  }
}

function tellDashboard(s: Session, event: DashboardEvent): void {
  void chrome.tabs.sendMessage(s.dashboardTabId, event).catch(() => {});
}

// Inject on every top-level page load of a previewed tab, while it stays on the site.
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId, url }) => {
  // Skip the new tab's about:blank and other non-web pages.
  if (frameId !== 0 || !/^https?:/.test(url)) return;
  void getSession(tabId).then((s) => {
    if (!s) return;
    if (!hostAllowed(url, s.hosts)) {
      void dropSession(tabId);
      tellDashboard(s, { type: 'stopped', experimentKey: s.state.experimentKey });
      return;
    }
    inject(tabId, s).catch((err: unknown) => console.warn('[splitcraft preview]', err));
  });
});

chrome.tabs.onRemoved.addListener((tabId) => void dropSession(tabId));

async function fromDashboard(msg: DashboardRequest, dashboardTabId: number): Promise<unknown> {
  switch (msg.type) {
    case 'ping':
      return {
        version: chrome.runtime.getManifest().version,
        userScripts: await userScriptsReady(),
      } satisfies PingReply;
    case 'open': {
      if (!hostAllowed(msg.url, msg.hosts))
        throw new Error('That page is not on this project’s domains.');
      const tab = await chrome.tabs.create({ url: 'about:blank', openerTabId: dashboardTabId });
      await setSession(tab.id!, { state: msg.state, hosts: msg.hosts, dashboardTabId });
      await chrome.tabs.update(tab.id!, { url: msg.url });
      return { tabId: tab.id };
    }
    case 'update': {
      for (const [tabId, s] of await allSessions()) {
        if (
          s.dashboardTabId !== dashboardTabId ||
          s.state.experimentKey !== msg.state.experimentKey
        )
          continue;
        // The panel's variant choice wins over the dashboard's selection.
        const state = { ...msg.state, variantKey: s.state.variantKey };
        await setSession(tabId, { ...s, state });
        const [res] = await chrome.scripting
          .executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [state],
            func: (next: PreviewState) =>
              (
                window as unknown as { splitcraftPreview?: { update(s: unknown): string } }
              ).splitcraftPreview?.update(next) ?? 'rerun',
          })
          .catch(() => [{ result: 'rerun' }]);
        // New JS needs a clean page: reload, and the preview is injected again.
        if (res?.result === 'rerun') await chrome.tabs.reload(tabId);
      }
      return {};
    }
    case 'stop': {
      for (const [tabId, s] of await allSessions()) {
        if (s.dashboardTabId !== dashboardTabId || s.state.experimentKey !== msg.experimentKey)
          continue;
        await dropSession(tabId);
        await chrome.tabs.reload(tabId);
      }
      return {};
    }
  }
}

async function fromPage(msg: PageRequest, tabId: number): Promise<void> {
  const s = await getSession(tabId);
  if (!s) return;
  if (msg.type === 'switch' && s.state.variants.some((v) => v.key === msg.variantKey)) {
    await setSession(tabId, { ...s, state: { ...s.state, variantKey: msg.variantKey } });
    tellDashboard(s, {
      type: 'switched',
      experimentKey: s.state.experimentKey,
      variantKey: msg.variantKey,
    });
    await chrome.tabs.reload(tabId);
  } else if (msg.type === 'stop') {
    await dropSession(tabId);
    tellDashboard(s, { type: 'stopped', experimentKey: s.state.experimentKey });
    await chrome.tabs.reload(tabId);
  }
}

chrome.runtime.onMessage.addListener((raw, sender, reply) => {
  const msg = raw as { from?: string; request?: unknown };
  const tabId = sender.tab?.id;
  if (sender.id !== chrome.runtime.id || tabId === undefined) return false;
  const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : '');
  const work =
    msg.from === 'dashboard' && DASHBOARD_ORIGINS.includes(origin)
      ? fromDashboard(msg.request as DashboardRequest, tabId)
      : msg.from === 'page'
        ? fromPage(msg.request as PageRequest, tabId)
        : Promise.reject(new Error('Unknown sender'));
  work.then(
    (result) => reply({ ok: true, result }),
    (err: unknown) => reply({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  );
  return true;
});
