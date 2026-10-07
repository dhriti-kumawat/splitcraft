// Messages between the dashboard, this extension and previewed pages. The dashboard's
// copy is apps/dashboard/src/lib/previewBridge.ts; keep them in step.

/** What to preview, as the preview bundle takes it (packages/sdk/src/preview/types.ts). */
export interface PreviewState {
  experimentKey: string;
  experimentName: string;
  variants: Array<{ key: string; name: string; js?: string; css?: string; url?: string | null }>;
  variantKey: string;
  source: 'live' | 'saved';
  visual?: boolean;
}

/** From the dashboard page, through dashboard-bridge.ts. */
export type DashboardRequest =
  | { type: 'ping' }
  | { type: 'open'; url: string; hosts: string[]; state: PreviewState }
  | { type: 'update'; state: PreviewState; select?: boolean }
  | { type: 'stop'; experimentKey: string };

/** A visual editor change: data only; the dashboard builds the code from it. */
export interface VisualChange {
  selector: string;
  kind: 'text' | 'hide' | 'color' | 'background';
  value?: string;
}

/**
 * From a previewed page's panel, through preview-bridge.ts. Never carries code: visual
 * changes are checked data, and the dashboard shows the code they make before saving.
 */
export type PageRequest =
  | { type: 'switch'; variantKey: string }
  | { type: 'stop' }
  | { type: 'visual'; variantKey: string; changes: VisualChange[] };

/** Keeps only well-formed visual changes (at most 50), or null when there are none. */
export function visualChanges(raw: unknown): VisualChange[] | null {
  if (!Array.isArray(raw)) return null;
  const kinds = ['text', 'hide', 'color', 'background'];
  const ok = raw
    .filter(
      (c): c is VisualChange =>
        typeof c === 'object' &&
        c !== null &&
        typeof c.selector === 'string' &&
        c.selector.length > 0 &&
        c.selector.length <= 300 &&
        kinds.includes(c.kind) &&
        (c.value === undefined || (typeof c.value === 'string' && c.value.length <= 2000)),
    )
    .slice(0, 50)
    .map((c) => ({
      selector: c.selector,
      kind: c.kind,
      ...(c.value !== undefined && { value: c.value }),
    }));
  return ok.length ? ok : null;
}

/** To the dashboard page when the panel changes the preview. */
export type DashboardEvent =
  | { type: 'switched'; experimentKey: string; variantKey: string }
  | { type: 'stopped'; experimentKey: string }
  | { type: 'visual'; experimentKey: string; variantKey: string; changes: VisualChange[] };

export interface PingReply {
  version: string;
  /** chrome.userScripts is allowed: JS runs even on pages whose CSP blocks eval. */
  userScripts: boolean;
}

/** The dashboards allowed to send code (manifest content_scripts match these too). */
export const DASHBOARD_ORIGINS = [
  'https://splitcraft-app.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
