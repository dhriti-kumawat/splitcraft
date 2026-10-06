import { useEffect, useState, useSyncExternalStore } from 'react';
import type { VisualChange } from './visual';
import type { Experiment, Project } from '../data/api';
import { controlKey } from './experiments';

// Live preview on the site (decision #29). Two ways to reach the page:
// - the Splitcraft Preview extension (apps/extension), through its content script on
//   this page; messages match apps/extension/src/protocol.ts;
// - the preview bookmark, in a tab this page opened, through window.postMessage.
// Either way the page gets the variants as they are in the editor, saved or not.

/** What the preview bundle shows (packages/sdk/src/preview/types.ts). */
export interface PreviewState {
  experimentKey: string;
  experimentName: string;
  variants: Array<{ key: string; name: string; js?: string; css?: string; url?: string | null }>;
  variantKey: string;
  source: 'live' | 'saved';
  /** Start the visual editor on this variant when the preview opens. */
  visual?: boolean;
}

export interface ExtensionInfo {
  version: string;
  userScripts: boolean;
}

type Session = { experimentKey: string; mode: 'extension' | 'bookmark'; variantKey: string };

// ------------------------------------------------------------------ session store

let session: Session | null = null;
const listeners = new Set<() => void>();
const setSession = (next: Session | null) => {
  session = next;
  for (const fn of listeners) fn();
};

/** The preview this dashboard tab has open, if any. */
export function usePreviewSession(): Session | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => session,
  );
}

// ------------------------------------------------------------------ state

/** The preview state for an experiment, with unsaved editor changes if given. */
export function previewState(
  experiment: Experiment,
  variants: PreviewState['variants'] = experiment.variants,
  variantKey?: string,
): PreviewState {
  const control = controlKey(experiment);
  return {
    experimentKey: experiment.key,
    experimentName: experiment.name,
    variants: variants.map(({ key, name, js, css, url }) => ({ key, name, js, css, url })),
    variantKey:
      variantKey ??
      (session?.experimentKey === experiment.key ? session.variantKey : undefined) ??
      variants.find((v) => v.key !== control)?.key ??
      control,
    source: 'live',
  };
}

/** The project's domains, which the extension keeps the preview within. */
export const projectHosts = (p: Pick<Project, 'mainDomain' | 'allowedDomains'>) => [
  p.mainDomain,
  ...p.allowedDomains,
];

// ------------------------------------------------------------------ extension

/** The extension's version when its content script is on this page. */
export function extensionVersion(): string | null {
  return document.documentElement.dataset.splitcraftPreview ?? null;
}

let nextId = 1;
function request<T>(req: unknown, timeoutMs = 4000): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      removeEventListener('message', onReply);
      reject(new Error('The Splitcraft Preview extension did not answer. Reload this page.'));
    }, timeoutMs);
    const onReply = (e: MessageEvent) => {
      const d = e.data as {
        source?: string;
        id?: number;
        reply?: { ok: boolean; result?: T; error?: string };
      };
      if (e.source !== window || d?.source !== 'splitcraft-extension' || d.id !== id) return;
      clearTimeout(timer);
      removeEventListener('message', onReply);
      if (d.reply?.ok) resolve(d.reply.result as T);
      else reject(new Error(d.reply?.error ?? 'The extension could not do that.'));
    };
    addEventListener('message', onReply);
    postMessage({ source: 'splitcraft-dashboard', id, request: req }, location.origin);
  });
}

export function pingExtension(): Promise<ExtensionInfo | null> {
  if (!extensionVersion()) return Promise.resolve(null);
  return request<ExtensionInfo>({ type: 'ping' }, 1500).catch(() => null);
}

/** Whether the Splitcraft Preview extension is on this page: checking, missing or its info. */
export function useExtension(): ExtensionInfo | null | undefined {
  const [info, setInfo] = useState<ExtensionInfo | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void pingExtension().then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, []);
  return info;
}

/** Open `url` in a new tab with the extension previewing `state` there. */
export async function openWithExtension(
  url: string,
  hosts: string[],
  state: PreviewState,
): Promise<void> {
  await request({ type: 'open', url, hosts, state });
  setSession({
    experimentKey: state.experimentKey,
    mode: 'extension',
    variantKey: state.variantKey,
  });
}

/** Changes made with "Edit visually" in the previewed tab, for one variant. */
export interface VisualEdit {
  experimentKey: string;
  variantKey: string;
  changes: VisualChange[];
}

const visualListeners = new Set<(edit: VisualEdit) => void>();

/** Get the visual editor's changes as they arrive. Returns an unsubscribe. */
export function onVisualEdit(fn: (edit: VisualEdit) => void): () => void {
  visualListeners.add(fn);
  return () => visualListeners.delete(fn);
}

function emitVisual(experimentKey: string, variantKey: unknown, changes: unknown): void {
  if (typeof variantKey !== 'string' || !Array.isArray(changes)) return;
  for (const fn of visualListeners) fn({ experimentKey, variantKey, changes });
}

// Panel actions in the previewed tab come back as events.
if (typeof window !== 'undefined') {
  addEventListener('message', (e: MessageEvent) => {
    const d = e.data as {
      source?: string;
      event?: { type: string; experimentKey: string; variantKey?: string; changes?: unknown };
    };
    if (e.source !== window || d?.source !== 'splitcraft-extension' || !d.event) return;
    if (session?.experimentKey !== d.event.experimentKey) return;
    if (d.event.type === 'visual')
      emitVisual(d.event.experimentKey, d.event.variantKey, d.event.changes);
    else if (d.event.type === 'stopped') setSession(null);
    else if (d.event.type === 'switched' && d.event.variantKey)
      setSession({ ...session, variantKey: d.event.variantKey });
  });
}

// ------------------------------------------------------------------ bookmark

let bookmarkTab: { win: Window; origin: string | null; state: PreviewState } | null = null;

/**
 * Open `url` in a new tab this page can talk to. After the preview bookmark is clicked
 * there, it says hello and gets the state, then every edit.
 */
export function openForBookmark(url: string, state: PreviewState): boolean {
  // Not `noopener`: the bookmark needs window.opener to reach this tab.
  const win = window.open(url, '_blank');
  if (!win) return false;
  bookmarkTab = { win, origin: null, state };
  setSession({
    experimentKey: state.experimentKey,
    mode: 'bookmark',
    variantKey: state.variantKey,
  });
  return true;
}

if (typeof window !== 'undefined') {
  addEventListener('message', (e: MessageEvent) => {
    const d = e.data as {
      source?: string;
      type?: string;
      variantKey?: string;
      changes?: unknown;
    } | null;
    if (!bookmarkTab || e.source !== bookmarkTab.win || d?.source !== 'splitcraft-preview') return;
    if (d.type === 'visual') {
      emitVisual(bookmarkTab.state.experimentKey, d.variantKey, d.changes);
      return;
    }
    if (d.type === 'hello') {
      // Reply only to the page that answered, at its own origin.
      bookmarkTab.origin = e.origin;
      sendToBookmark();
    } else if (d.type === 'switch' && d.variantKey) {
      bookmarkTab.state = { ...bookmarkTab.state, variantKey: d.variantKey };
      if (session) setSession({ ...session, variantKey: d.variantKey });
      sendToBookmark();
    } else if (d.type === 'stop') {
      bookmarkTab = null;
      setSession(null);
    }
  });
}

function sendToBookmark(): void {
  if (!bookmarkTab?.origin) return;
  try {
    bookmarkTab.win.postMessage(
      { source: 'splitcraft-dashboard', type: 'state', state: bookmarkTab.state },
      bookmarkTab.origin,
    );
  } catch {
    // The tab was closed or went elsewhere.
  }
}

// ------------------------------------------------------------------ edits

/**
 * Send the editor's current variants to the open preview, if it shows this experiment.
 * With `select`, the preview also switches to `state.variantKey` (the variant picked in
 * the editor); otherwise it keeps the variant it shows.
 */
export function updatePreview(state: PreviewState, select = false): void {
  if (!session || session.experimentKey !== state.experimentKey) return;
  if (select) setSession({ ...session, variantKey: state.variantKey });
  const next = { ...state, variantKey: session.variantKey };
  if (session.mode === 'extension')
    void request({ type: 'update', state: next, select }).catch(() => {});
  else if (bookmarkTab) {
    // Until the page has said hello, keep a pending "start the visual editor".
    const visual = next.visual || (!bookmarkTab.origin && bookmarkTab.state.visual);
    bookmarkTab.state = visual ? { ...next, visual } : next;
    sendToBookmark();
  }
}

export function stopPreview(): void {
  if (session?.mode === 'extension')
    void request({ type: 'stop', experimentKey: session.experimentKey }).catch(() => {});
  if (bookmarkTab?.origin) {
    try {
      bookmarkTab.win.postMessage(
        { source: 'splitcraft-dashboard', type: 'stop' },
        bookmarkTab.origin,
      );
    } catch {
      // The tab is gone.
    }
  }
  bookmarkTab = null;
  setSession(null);
}
